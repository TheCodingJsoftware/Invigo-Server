import asyncio
import os
import platform
import shutil
import threading
import time
import zipfile
from datetime import datetime, timedelta
from functools import partial

import schedule
import tornado
import tornado.log
from tornado.ioloop import IOLoop, PeriodicCallback

import config.variables as variables
from config.environments import Environment
from config.logging_config import setup_logging
from handlers.base import BaseHandler
from routes import route_map
from utils.sheet_report import generate_sheet_report

setup_logging()
tornado.log.enable_pretty_logging()

if platform.system() == "Windows":
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


def check_production_plan_for_jobs() -> None:  # TODO: Make compatible with WorkorderDB
    return
    # jobs_added = False
    # components_inventory = ComponentsInventory()
    # sheet_settings = SheetSettings()
    # structural_steel_settings = StructuralSteelSettings()
    # workspace_settings = WorkspaceSettings()
    # paint_inventory = PaintInventory(components_inventory)
    # sheets_inventory = SheetsInventory(sheet_settings)
    # laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
    # structural_steel_inventory = StructuralSteelInventory(
    #     structural_steel_settings, workspace_settings
    # )
    # job_manager = JobManager(
    #     sheet_settings,
    #     sheets_inventory,
    #     workspace_settings,
    #     components_inventory,
    #     laser_cut_inventory,
    #     paint_inventory,
    #     structural_steel_inventory,
    #     None,
    # )
    # workspace = Workspace(workspace_settings, job_manager)
    # production_plan = ProductionPlan(workspace_settings, job_manager)

    # today = datetime.today().date()

    # for job in production_plan.jobs:
    #     if job.moved_job_to_workspace:
    #         continue

    #     job_starting_date = datetime.strptime(
    #         job.starting_date, "%Y-%m-%d %I:%M %p"
    #     ).date()
    #     job_ending_date = datetime.strptime(job.ending_date, "%Y-%m-%d %I:%M %p").date()

    #     if job_starting_date <= today <= job_ending_date:
    #         jobs_added = True
    #         new_job = workspace.add_job(job)
    #         job.moved_job_to_workspace = True
    #         new_job.moved_job_to_workspace = True

    #         for assembly in new_job.get_all_assemblies():
    #             if (
    #                 assembly.all_laser_cut_parts_complete()
    #                 and not assembly.timer.has_started_timer()
    #             ):
    #                 assembly.timer.start_timer()
    #         for laser_cut_part in new_job.get_all_laser_cut_parts():
    #             laser_cut_part.timer.start_timer()

    #         CustomPrint.print(
    #             f"Job, '{job.name}' added to workspace from production plan and started timers.",
    #         )

    # if jobs_added:
    #     laser_cut_inventory.save()
    #     workspace.save()
    #     production_plan.save()
    #     CustomPrint.print(
    #         "Workspace and production plan updated, signaling clients to update files.",
    #     )
    #     signal_clients_for_changes(
    #         client_to_ignore=None,
    #         changed_files=[
    #             f"{workspace.filename}.json",
    #             f"{production_plan.filename}.json",
    #         ],
    #         client_type="web",
    #     )
    #     signal_clients_for_changes(
    #         client_to_ignore=None,
    #         changed_files=[
    #             f"{workspace.filename}.json",
    #             f"{laser_cut_inventory.filename}.json",
    #         ],
    #         client_type="software",
    #     )
    # else:
    #     CustomPrint.print(
    #         "No jobs were added to workspace from production plan.",
    #     )


def check_if_jobs_are_complete() -> None:  # TODO: Make compatible with WorkorderDB
    return
    # components_inventory = ComponentsInventory()
    # sheet_settings = SheetSettings()
    # structural_steel_settings = StructuralSteelSettings()
    # workspace_settings = WorkspaceSettings()
    # paint_inventory = PaintInventory(components_inventory)
    # sheets_inventory = SheetsInventory(sheet_settings)
    # laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
    # structural_steel_inventory = StructuralSteelInventory(
    #     structural_steel_settings, workspace_settings
    # )
    # job_manager = JobManager(
    #     sheet_settings,
    #     sheets_inventory,
    #     workspace_settings,
    #     components_inventory,
    #     laser_cut_inventory,
    #     paint_inventory,
    #     structural_steel_inventory,
    #     None,
    # )
    # workspace = Workspace(workspace_settings, job_manager)
    # workspace_history = WorkspaceHistory(job_manager)

    # completed_jobs: list[Job] = []

    # for job in workspace.jobs:
    #     if job.is_job_finished():
    #         CustomPrint.print(
    #             f"Job, '{job.name}' is finished and will be moved from workspace to workspace history.",
    #         )
    #         workspace_history.add_job(job)
    #         CustomPrint.print(
    #             f"Added '{job.name}' to workspace history.",
    #         )
    #         completed_jobs.append(job)

    # if completed_jobs:
    #     for job in completed_jobs:
    #         workspace.remove_job(job)
    #         CustomPrint.print(
    #             f"Removed '{job.name}' from workspace.",
    #         )
    #     workspace_history.save()
    #     workspace.save()
    #     CustomPrint.print(
    #         "Workspace and workspace history updated, signaling clients to update files.",
    #     )
    #     signal_clients_for_changes(
    #         client_to_ignore=None,
    #         changed_files=[
    #             f"{workspace.filename}.json",
    #             f"{workspace_history.filename}.json",
    #         ],
    #         client_type="web",
    #     )
    #     signal_clients_for_changes(
    #         client_to_ignore=None,
    #         changed_files=[
    #             f"{workspace.filename}.json",
    #             f"{laser_cut_inventory.filename}.json",
    #         ],
    #         client_type="software",
    #     )


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
    IOLoop.current().call_later(
        delay + 86400, lambda: schedule_daily_task_at(hour, minute, task)
    )  # Reschedule for the next day


def copy_server_log_file():
    shutil.copyfile(
        f"{Environment.DATA_PATH}/server.log",
        f"{Environment.DATA_PATH}/logs/Server Log - {datetime.now().strftime('%A %B %d %Y')}.log",
    )


def make_app():
    return tornado.web.Application(
        route_map.routes,
    )


if __name__ == "__main__":
    # Does not need to be thread safe
    schedule.every().monday.at("04:00").do(
        partial(generate_sheet_report, variables.software_connected_clients)
    )
    schedule.every().hour.do(hourly_backup_inventory_files)
    schedule.every().day.at("04:00").do(copy_server_log_file)
    schedule.every().day.at("04:00").do(daily_backup_inventory_files)
    schedule.every().week.do(weekly_backup_inventory_files)

    # For thread safety
    schedule_daily_task_at(4, 0, check_production_plan_for_jobs)
    periodic_callback = PeriodicCallback(
        check_if_jobs_are_complete, 60000
    )  # 60000 ms = 1 minute
    periodic_callback.start()

    thread = threading.Thread(target=schedule_thread)
    thread.start()

    app = tornado.httpserver.HTTPServer(make_app())
    IOLoop.current().add_callback(
        BaseHandler.workspace_db.start_background_cache_worker
    )

    # executor = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    # app.executor = executor
    app.listen(int(Environment.PORT))
    tornado.ioloop.IOLoop.current().start()
