import asyncio
import os
import shutil
import signal
import sys
import zipfile
from datetime import datetime
from functools import partial
from typing import Literal

import msgspec
import tornado
from tornado.ioloop import IOLoop, PeriodicCallback
from tornado.httpserver import HTTPServer

import config.variables as variables
from config.environments import Environment
from config.logging_config import setup_logging
from handlers.base import BaseHandler
from handlers.websocket.workspace import WebSocketWorkspaceHandler
from routes import route_map
from utils.sheet_report import generate_sheet_report

workspace_db = BaseHandler.workspace_db

WORKSPACE_TABLE_CHANNELS = [
    "jobs",
    "assemblies",
    "assembly_laser_cut_parts",
    "components",
    "nests",
    "view_grouped_laser_cut_parts_by_job",
]

shutdown_event = asyncio.Event()

# -------------------------
# DATABASE LISTENER (ROBUST)
# -------------------------
async def start_workspace_services():
    while not shutdown_event.is_set():
        try:
            await workspace_db.connect()

            async with workspace_db.db_pool.acquire() as conn:
                for channel in WORKSPACE_TABLE_CHANNELS:
                    await conn.add_listener(channel, workspace_notify_handler)

                # Block until connection dies or shutdown
                await shutdown_event.wait()

        except asyncio.CancelledError:
            break
        except Exception:
            tornado.log.app_log.exception(
                "Workspace DB listener crashed, retrying in 5s"
            )
            await asyncio.sleep(5)


async def workspace_notify_handler(conn, pid, channel, payload):
    try:
        msg = msgspec.json.decode(payload)
    except Exception:
        tornado.log.app_log.warning("Invalid NOTIFY payload: %r", payload)
        return

    try:
        await _handle_workspace_message(channel, msg)
    except Exception:
        tornado.log.app_log.exception("Error processing workspace notification")


async def _handle_workspace_message(channel: str, msg: dict):
    op: Literal["INSERT", "UPDATE", "DELETE"] = msg.get("type")
    job_id = msg.get("job_id")
    part_name = msg.get("part_name")

    if channel == "jobs":
        if op in ("INSERT", "UPDATE"):
            job = await workspace_db.get_job_by_id(job_id)
            WebSocketWorkspaceHandler.broadcast(
                {"type": f"job_{op.lower()}", "job": job}
            )
        elif op == "DELETE":
            WebSocketWorkspaceHandler.broadcast(
                {"type": "job_deleted", "job_id": job_id}
            )

    elif channel == "view_grouped_laser_cut_parts_by_job":
        WebSocketWorkspaceHandler.broadcast(
            {
                "type": "grouped_parts_job_view_changed",
                "operation": op.lower(),
                "job_id": job_id,
                "part_name": part_name,
                "flowtag": msg.get("flowtag"),
                "flowtag_index": msg.get("flowtag_index"),
            }
        )


# -------------------------
# BACKUPS (SAFE)
# -------------------------
def zip_files(zip_path: str):
    data_dir = os.path.join(Environment.DATA_PATH, "data")
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)

    if not os.path.isdir(data_dir):
        return

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for name in os.listdir(data_dir):
            full = os.path.join(data_dir, name)
            if os.path.isfile(full):
                z.write(full, name)


def hourly_backup():
    zip_files(
        f"{Environment.DATA_PATH}/backups/Hourly Backup - "
        f"{datetime.now().strftime('%I %p')}.zip"
    )


def daily_backup():
    zip_files(
        f"{Environment.DATA_PATH}/backups/Daily Backup - "
        f"{datetime.now().strftime('%d %B')}.zip"
    )


def weekly_backup():
    zip_files(
        f"{Environment.DATA_PATH}/backups/Weekly Backup - "
        f"{datetime.now().strftime('%W')}.zip"
    )


def copy_server_log():
    src = f"{Environment.DATA_PATH}/server.log"
    dst_dir = f"{Environment.DATA_PATH}/logs"
    os.makedirs(dst_dir, exist_ok=True)

    if os.path.exists(src):
        shutil.copyfile(
            src,
            f"{dst_dir}/Server Log - {datetime.now().strftime('%A %B %d %Y')}.log",
        )


# -------------------------
# APP
# -------------------------
def make_app():
    return tornado.web.Application(
        route_map.routes,
        cookie_secret=Environment.COOKIE_SECRET,
        websocket_ping_interval=25,
        websocket_ping_timeout=25,
    )


# -------------------------
# SHUTDOWN
# -------------------------
async def shutdown():
    tornado.log.app_log.info("Shutting down cleanly...")
    shutdown_event.set()

    if workspace_db.db_pool:
        await workspace_db.db_pool.close()

    IOLoop.current().stop()


def signal_handler(sig, frame):
    IOLoop.current().add_callback_from_signal(shutdown)


# -------------------------
# MAIN
# -------------------------
if __name__ == "__main__":
    setup_logging()

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # HTTP server
    app = HTTPServer(make_app(), xheaders=True)
    app.listen(int(Environment.PORT), address="0.0.0.0")

    # Schedulers (Tornado-native)
    PeriodicCallback(hourly_backup, 60 * 60 * 1000).start()
    PeriodicCallback(daily_backup, 24 * 60 * 60 * 1000).start()
    PeriodicCallback(weekly_backup, 7 * 24 * 60 * 60 * 1000).start()
    PeriodicCallback(copy_server_log, 24 * 60 * 60 * 1000).start()

    # Weekly report
    PeriodicCallback(
        partial(generate_sheet_report, variables.software_connected_clients),
        7 * 24 * 60 * 60 * 1000,
    ).start()

    # DB listeners
    IOLoop.current().spawn_callback(start_workspace_services)

    tornado.log.app_log.info("Invigo server started")
    IOLoop.current().start()
