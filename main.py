import asyncio
import os
import shutil
import signal
import sys
import threading
import time
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from functools import partial
from typing import Literal

import msgspec
import schedule
import tornado
from tornado.ioloop import IOLoop

import config.variables as variables
from config.environments import Environment
from config.logging_config import setup_logging
from handlers.base import BaseHandler
from handlers.websocket.workspace import WebSocketWorkspaceHandler
from routes import route_map
from utils.sheet_report import generate_sheet_report

workspace_db = BaseHandler.workspace_db

# A buffer to collect notifications briefly
_notify_buffer = defaultdict(list)
_notify_tasks = {}

WORKSPACE_TABLE_CHANNELS = [
    "jobs",
    "assemblies",
    "assembly_laser_cut_parts",
    "components",
    "nests",
    "view_grouped_laser_cut_parts_by_job",
]


async def start_workspace_services():
    await workspace_db.connect()
    if workspace_db.db_pool:
        conn = await workspace_db.db_pool.acquire()
        for channel in WORKSPACE_TABLE_CHANNELS:
            await conn.add_listener(channel, workspace_notify_handler)


async def workspace_notify_handler(conn, pid, channel, payload):
    msg = msgspec.json.decode(payload)

    # Dynamic mapping
    table = channel
    op: Literal["INSERT", "UPDATE", "DELETE"] = msg.get("type")
    job_id = msg.get("job_id")
    part_id = msg.get("id")
    delta = msg.get("delta")

    if table == "jobs":
        if op == "INSERT":
            job = await workspace_db.get_job_by_id(job_id)
            WebSocketWorkspaceHandler.broadcast({"type": "job_created", "job": job})
        elif op == "UPDATE":
            job = await workspace_db.get_job_by_id(job_id)
            WebSocketWorkspaceHandler.broadcast({"type": "job_updated", "job": job})
        elif op == "DELETE":
            WebSocketWorkspaceHandler.broadcast({"type": "job_deleted", "job_id": job_id})
    elif table == "view_grouped_laser_cut_parts_by_job":
        # This notification means the grouped view for a specific job changed
        part_name = msg.get("part_name")
        flowtag = msg.get("flowtag")
        flowtag_index = msg.get("flowtag_index")

        WebSocketWorkspaceHandler.broadcast(
            {
                "type": "grouped_parts_job_view_changed",
                "operation": op.lower(),
                "job_id": job_id,
                "part_name": part_name,
                "flowtag": flowtag,
                "flowtag_index": flowtag_index,
            }
        )


setup_logging()
# tornado.log.enable_pretty_logging()

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


def hourly_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{Environment.DATA_PATH}/data")
    path_to_zip_file: str = f"{Environment.DATA_PATH}/backups/Hourly Backup - {datetime.now().strftime('%I %p')}.zip"
    zip_files(path_to_zip_file, files_to_backup)


def daily_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{Environment.DATA_PATH}/data")
    path_to_zip_file: str = f"{Environment.DATA_PATH}/backups/Daily Backup - {datetime.now().strftime('%d %B')}.zip"
    zip_files(path_to_zip_file, files_to_backup)


def weekly_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{Environment.DATA_PATH}/data")
    path_to_zip_file: str = f"{Environment.DATA_PATH}/backups/Weekly Backup - {datetime.now().strftime('%W')}.zip"
    zip_files(path_to_zip_file, files_to_backup)


def zip_files(path_to_zip_file: str, files_to_backup: list[str]) -> None:
    os.makedirs(f"{Environment.DATA_PATH}/backups", exist_ok=True)
    file = zipfile.ZipFile(path_to_zip_file, mode="w")
    for file_path in files_to_backup:
        file.write(
            f"{Environment.DATA_PATH}/data/{file_path}",
            file_path,
            compress_type=zipfile.ZIP_DEFLATED,
        )
    file.close()


def schedule_thread():
    while True:
        schedule.run_pending()
        time.sleep(5)


def schedule_daily_task_at(hour, minute, task):
    now = datetime.now()
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if next_run < now:
        next_run += timedelta(days=1)
    delay = (next_run - now).total_seconds()

    IOLoop.current().call_later(delay, task)
    IOLoop.current().call_later(delay + 86400, lambda: schedule_daily_task_at(hour, minute, task))  # Reschedule for the next day


def copy_server_log_file():
    shutil.copyfile(
        f"{Environment.DATA_PATH}/server.log",
        f"{Environment.DATA_PATH}/logs/Server Log - {datetime.now().strftime('%A %B %d %Y')}.log",
    )


def make_app():
    return tornado.web.Application(
        route_map.routes,
        cookie_secret=Environment.COOKIE_SECRET,
    )


def shutdown():
    print("Shutting down cleanly...")
    IOLoop.current().stop()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda s, f: shutdown())
    signal.signal(signal.SIGTERM, lambda s, f: shutdown())
    # Does not need to be thread safe
    schedule.every().monday.at("04:00").do(partial(generate_sheet_report, variables.software_connected_clients))
    schedule.every().hour.do(hourly_backup_inventory_files)
    schedule.every().day.at("04:00").do(copy_server_log_file)
    schedule.every().day.at("04:00").do(daily_backup_inventory_files)
    schedule.every().week.do(weekly_backup_inventory_files)

    # For thread safety
    # schedule_daily_task_at(4, 0, check_production_plan_for_jobs)
    # periodic_callback = PeriodicCallback(check_if_jobs_are_complete, 60000)  # 60000 ms = 1 minute
    # periodic_callback.start()

    thread = threading.Thread(target=schedule_thread)
    thread.start()

    IOLoop.current().run_sync(start_workspace_services)

    app = tornado.httpserver.HTTPServer(make_app(), xheaders=True)
    # IOLoop.current().add_callback(BaseHandler.workspace_db.start_background_cache_worker)

    # executor = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    # app.executor = executor
    app.listen(int(Environment.PORT), address="0.0.0.0")
    tornado.ioloop.IOLoop.current().start()
