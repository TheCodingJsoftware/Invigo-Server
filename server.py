import asyncio
import csv
import os
import re
import shutil
import sys
import threading
import time
import zipfile
from filelock import FileLock, Timeout
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from functools import partial
from io import StringIO
from pathlib import Path
from typing import Literal, Union
from urllib.parse import quote

import coloredlogs
import jinja2
import msgspec
import schedule
import tornado.ioloop
import tornado.web
import tornado.websocket
from tornado.ioloop import IOLoop, PeriodicCallback
from ansi2html import Ansi2HTMLConverter
from markupsafe import Markup
from natsort import natsorted

from utils.custom_print import CustomPrint, print_clients
from utils.inventory.components_inventory import ComponentsInventory
from utils.inventory.laser_cut_inventory import LaserCutInventory
from utils.inventory.laser_cut_part import LaserCutPart
from utils.inventory.order import Order
from utils.inventory.paint_inventory import PaintInventory
from utils.inventory.sheets_inventory import SheetsInventory
from utils.inventory_updater import (
    add_sheet,
    get_cutoff_sheets,
    get_sheet_pending_data,
    get_sheet_quantity,
    remove_cutoff_sheet,
    set_sheet_quantity,
    sheet_exists,
)
from utils.send_email import send, send_error_log
from utils.sheet_report import generate_sheet_report
from utils.sheet_settings.sheet_settings import SheetSettings
from utils.workspace.job import JobStatus
from utils.workspace.workspace_settings import WorkspaceSettings
from utils.workspace.workspace import Workspace
from utils.workspace.workspace_item_group import WorkspaceItemGroup
from utils.inventory.nest import Nest
from utils.workspace.job_manager import JobManager
from utils.workspace.workorder import Workorder
from utils.workspace.workspace_history import WorkspaceHistory
from utils.workspace.job import Job
from utils.workspace.generate_printout import WorkspaceJobPrintout
from utils.workspace.production_plan import ProductionPlan


# Store connected clients
connected_clients: set[tornado.websocket.WebSocketHandler] = set()
web_connected_clients: set[tornado.websocket.WebSocketHandler] = set()

# Configure Jinja2 template environment
loader = jinja2.FileSystemLoader("templates")
env = jinja2.Environment(loader=loader)


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("index.html")
        rendered_template = template.render()
        self.write(rendered_template)


class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        connected_clients.add(self)

        CustomPrint.print(
            f"INFO - Software connection established with: {self.request.remote_ip}",
            connected_clients=connected_clients,
        )

    def on_close(self):
        connected_clients.remove(self)
        CustomPrint.print(
            f"INFO - Software connection ended with: {self.request.remote_ip}",
            connected_clients=connected_clients,
        )


class WebSocketWebHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        web_connected_clients.add(self)
        CustomPrint.print(
            f"INFO - Web connection established with: {self.request.remote_ip}",
            connected_clients=web_connected_clients,
        )

    def on_close(self):
        web_connected_clients.remove(self)
        CustomPrint.print(
            f"INFO - Web connection ended with: {self.request.remote_ip}",
            connected_clients=web_connected_clients,
        )


class ThemeFileHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "text/css")
        with open("static/css/theme.css", "rb") as file:
            data = file.read()
            self.write(data)


class WorkspaceScriptHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/javascript")
        with open("static/js/workspace_dashboard.js", "rb") as file:
            data = file.read()
            self.write(data)


class WorkspaceArchivesScriptHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/javascript")
        with open("static/js/workspace_archives.js", "rb") as file:
            data = file.read()
            self.write(data)


class ProductionPlannerScriptHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/javascript")
        with open("static/js/production_planner.js", "rb") as file:
            data = file.read()
            self.write(data)


class ProductionPlanJsonHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/json")
        with open("data/production_plan.json", "rb") as file:
            data = msgspec.json.decode(file.read())
            self.write(data)


class WorkspaceJsonHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/json")
        with open("data/workspace.json", "rb") as file:
            data = msgspec.json.decode(file.read())
            self.write(data)


class WorkspaceSettingsJsonHandler(tornado.web.RequestHandler):
    def get(self):
        self.set_header("Content-Type", "application/json")
        with open("data/workspace_settings.json", "rb") as file:
            data = msgspec.json.decode(file.read())
            self.write(data)


class ServerLogsHandler(tornado.web.RequestHandler):
    def get(self):
        logs = print_clients() + sys.stdout.getvalue()
        converter = Ansi2HTMLConverter()
        logs = converter.convert(logs)
        logs = Markup(logs)  # Mark the logs as safe HTML
        self.write(logs)


class LogsHandler(tornado.web.RequestHandler):
    def get(self):
        log_dir = "logs/"

        server_logs = []
        error_logs = []

        for file in os.listdir(log_dir):
            if os.path.isfile(os.path.join(log_dir, file)):
                file_path = os.path.join(log_dir, file)
                file_info = {
                    "name": file,
                    "mtime": os.path.getmtime(file_path),
                }  # Get the modification time
                if file.startswith("Server Log"):
                    server_logs.append(file_info)
                elif file.startswith("Error Log"):
                    error_logs.append(file_info)

        # Sort logs by modification time (newest first)
        server_logs.sort(key=lambda x: x["mtime"], reverse=True)
        error_logs.sort(key=lambda x: x["mtime"], reverse=True)

        template = env.get_template("logs.html")
        rendered_template = template.render(
            server_logs=[log["name"] for log in server_logs],
            error_logs=[log["name"] for log in error_logs],
        )
        self.write(rendered_template)


class LogDeleteHandler(tornado.web.RequestHandler):
    def post(self):
        log_file_name = self.get_argument("log_file_name")
        log_dir = "logs/"
        log_file_path = os.path.join(log_dir, log_file_name)

        if os.path.isfile(log_file_path):
            os.remove(log_file_path)
            self.write(f"Log file {log_file_name} deleted")
        else:
            self.set_status(404)
            self.write("Log file not found")


class LogContentHandler(tornado.web.RequestHandler):
    def post(self):
        log_file_name = self.get_argument("log_file_name")
        log_dir = "logs/"
        log_file_path = os.path.join(log_dir, log_file_name)

        if os.path.isfile(log_file_path):
            with open(log_file_path, "r", encoding="utf-8") as log_file:
                lines = log_file.readlines()

                formatted_lines = []
                ip_regex = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
                string_regex = re.compile(r'(["\'])(?:(?=(\\?))\2.)*?\1')
                keywords = {
                    "INFO": "#2ead65",
                    "ERROR": "#bf382f",
                    "Error": "#bf382f",
                    "ERRNO": "#bf382f",
                    "WARN": "#f1c234",
                    "INVIGO SERVER STARTED": "#3daee9",
                    "HOURLY BACKUP COMPLETE": "#f1c234",
                    "DAILY BACKUP COMPLETE": "#f1c234",
                    "WEEKLY BACKUP COMPLETE": "#f1c234",
                    "LOCK": "#0057ea",
                    "UPLOADED": "#0057ea",
                    "DOWNLOADED": "#0057ea",
                    "SENT": "#0057ea",
                    "UPLOAD": "#0057ea",
                    "DOWNLOAD": "#0057ea",
                    "LOADED": "#0057ea",
                    "PINECONE": "#25bc9d",
                }

                def keyword_replacer(match):
                    keyword = match.group(0)
                    color = keywords[keyword.upper()]
                    return f'<span style="color: {color}">{keyword}</span>'

                for line in lines:
                    match = re.match(
                        r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+) - (INFO|ERROR) - (.*)",
                        line,
                        re.IGNORECASE,
                    )
                    if match:
                        date, level, message = match.groups()
                        level_color = "#2ead65" if level.upper() == "INFO" else "#bf382f"
                        message = string_regex.sub(r'<span style="color: #c3705d;">\g<0></span>', message)
                        message = ip_regex.sub(r'<span style="color: #8d48aa;">\g<0></span>', message)

                        for keyword in keywords:
                            message = re.sub(
                                r"\b" + re.escape(keyword) + r"\b",
                                keyword_replacer,
                                message,
                                flags=re.IGNORECASE,
                            )

                        formatted_line = f"<b>{date}</b> - <span style='color: {level_color}'>{level}</span> - <span style='color: #EAE9FC'>{message}</span>"
                        formatted_lines.append(formatted_line)
                    else:
                        formatted_lines.append(line)

                self.write("<br>".join(formatted_lines))
        else:
            self.set_status(404)
            self.write("Log file not found")


class WayBackMachineHandler(tornado.web.RequestHandler):
    def get(self):
        data: dict[str, list[str]] = {}
        with open("data/components_inventory.json", "rb") as f:
            data["components_inventory"] = []
            for component_data in msgspec.json.decode(f.read())["components"]:
                data["components_inventory"].append(component_data["part_name"])
        with open("data/laser_cut_inventory.json", "rb") as f:
            data["laser_cut_inventory"] = []
            for laser_cut_part_data in msgspec.json.decode(f.read())["laser_cut_parts"]:
                data["laser_cut_inventory"].append(laser_cut_part_data["name"])
        with open("data/sheets_inventory.json", "rb") as f:
            data["sheets_inventory"] = []
            for sheet_data in msgspec.json.decode(f.read())["sheets"]:
                data["sheets_inventory"].append(sheet_data["name"])

        template = env.get_template("way_back_machine.html")
        rendered_template = template.render(inventory=data)
        self.write(rendered_template)


class FetchDataHandler(tornado.web.RequestHandler):
    def get(self):
        inventory_type = self.get_argument("inventory")
        item_name = self.get_argument("item")
        dates, quantities, prices, latest_changes = [], [], [], []

        for root, _, files in sorted(os.walk("backups"), reverse=True):
            for file in sorted(files, reverse=True):
                if file.startswith("Daily Backup") and file.endswith(".zip"):
                    file_path = os.path.join(root, file)
                    creation_time = os.path.getctime(file_path)
                    date = datetime.fromtimestamp(creation_time)
                    with zipfile.ZipFile(file_path, "r") as zip_ref:
                        with zip_ref.open(f"{inventory_type}.json") as f:
                            inventory = msgspec.json.decode(f.read())
                            try: # Old inventory format
                                if inventory_type == "components_inventory":
                                    item = inventory["components"][item_name]
                                elif inventory_type == "laser_cut_inventory":
                                    item = inventory["laser_cut_parts"][item_name]
                                elif inventory_type == "sheets_inventory":
                                    item = inventory["sheets"][item_name]
                            except TypeError: # New inventory format
                                if inventory_type == "components_inventory":
                                    for component_data in inventory["components"]:
                                        if item_name == component_data["part_name"]:
                                            item = component_data
                                elif inventory_type == "laser_cut_inventory":
                                    for laser_cut_part_data in inventory["laser_cut_parts"]:
                                        if item_name == laser_cut_part_data["name"]:
                                            item = laser_cut_part_data
                                elif inventory_type == "sheets_inventory":
                                    for sheet_data in inventory["sheets"]:
                                        try:
                                            if item_name == sheet_data["name"]:
                                                item = sheet_data
                                        except KeyError: # Have to generate name
                                            if item_name == f"{sheet_data['thickness']} {sheet_data['material']} {sheet_data['length']:.3f}x{sheet_data['width']:.3f}":
                                                item = sheet_data
                            except KeyError: # The part might not exist yet in older backups
                                continue
                            try:
                                if item:
                                    dates.append(date)
                                    quantities.append(item["quantity"])
                                    try:
                                        prices.append(item["price"])
                                    except KeyError:  # Sheets don't have prices
                                        prices.append(None)
                            except UnboundLocalError: # Item has not been found
                                continue

        # Combine lists into a list of tuples and sort by date
        combined = list(zip(dates, quantities, prices))
        combined.sort(reverse=True, key=lambda x: x[0])

        # Unpack sorted tuples back into separate lists
        dates, quantities, prices = zip(*combined) if combined else ([], [], [])

        dates = [date.strftime("%Y-%m-%d") for date in dates]

        self.write({"dates": dates, "quantities": quantities, "prices": prices})



class FileReceiveHandler(tornado.web.RequestHandler):
    def get(self, filename: str):
        file_path = self.get_file_path(filename)
        lock = FileLock(f"{file_path}.lock", timeout=10)  # Set a timeout for acquiring the lock
        try:
            with lock:
                with open(file_path, "rb") as file:
                    data = file.read()
                    self.set_header("Content-Type", "application/json")
                    self.set_header("Content-Disposition", f'attachment; filename="{filename}"')
                    self.write(data)
                CustomPrint.print(f'INFO - {self.request.remote_ip} downloaded "{filename}"', connected_clients=connected_clients)
        except FileNotFoundError:
            CustomPrint.print(f'ERROR - File "{filename}" not found.', connected_clients=connected_clients)
            self.set_status(404)
            self.write(f'File "{filename}" not found.')
        except Timeout:
            CustomPrint.print(f'WARN - {self.request.remote_ip} Could not acquire lock for "{filename}".', connected_clients=connected_clients)
            self.set_status(503)
            self.write(f'Could not acquire lock for {filename}. Try again later.')

    def get_file_path(self, filename: str) -> str:
        if filename.endswith(".job"):
            return f"data/jobs/{filename}"
        elif filename.endswith(".json"):
            return f"data/{filename}"
        return f"data/{filename}"


def update_inventory_file_to_pinecone(file_name: str):
    try:
        shutil.copy2(f"data\\{file_name}", f"Z:\\Invigo\\{file_name}")
        CustomPrint.print(
            f'INFO - Uploaded "{file_name}" to Pinecone',
            connected_clients=connected_clients,
        )
    except Exception as e:
        CustomPrint.print(
            f"ERROR - Upload to Pinecone error: {e}",
            connected_clients=connected_clients,
        )



class FileUploadHandler(tornado.web.RequestHandler):
    async def post(self):
        file_info = self.request.files.get("file")
        should_signal_connect_clients = False
        if file_info:
            file_data = file_info[0]["body"]
            filename: str = file_info[0]["filename"]

            if filename.lower().endswith(".json"):
                file_path = f"data/{filename}"
                lock_path = f"{file_path}.lock"
                lock = FileLock(lock_path, timeout=10)
                try:
                    with lock:
                        with open(file_path, "wb") as file:
                            file.write(file_data)
                        threading.Thread(target=update_inventory_file_to_pinecone, args=(filename,)).start()
                        should_signal_connect_clients = True

                    CustomPrint.print(f'INFO - {self.request.remote_ip} uploaded "{filename}"', connected_clients=connected_clients)

                    if should_signal_connect_clients:
                        signal_clients_for_changes(self.request.remote_ip, [filename], client_type='software')
                        signal_clients_for_changes(None, [filename], client_type='web')
                except Timeout:
                    CustomPrint.print(f'WARN - {self.request.remote_ip} Could not acquire lock for "{filename}".', connected_clients=connected_clients)
                    self.set_status(503)
                    self.write(f'Could not acquire lock for {filename}. Try again later.')
            elif filename.lower().endswith((".jpeg", ".jpg", '.png')):
                filename = os.path.basename(filename)
                with open(f"images/{filename}", "wb") as file:
                    file.write(file_data)
        else:
            self.write("No file received.")
            CustomPrint.print(f"ERROR - No file received from {self.request.remote_ip}.", connected_clients=connected_clients)


class ProductionPlannerFileUploadHandler(tornado.web.RequestHandler):
    async def post(self):
        file_info = self.request.files.get("file")
        if file_info:
            file_data = file_info[0]["body"]
            filename: str = file_info[0]["filename"]

            file_path = f"data/{filename}"
            lock_path = f"{file_path}.lock"
            lock = FileLock(lock_path, timeout=10)

            try:
                with lock:
                    with open(file_path, "wb") as file:
                        file.write(file_data)
                    threading.Thread(target=update_inventory_file_to_pinecone, args=(filename,)).start()
            except Timeout:
                CustomPrint.print(f'WARN - {self.request.remote_ip} Could not acquire lock for "{filename}".', connected_clients=connected_clients)
                self.write(f"Could not acquire lock for {filename}. Try again later.")
                return

            CustomPrint.print(
                f'INFO - Web {self.request.remote_ip} uploaded "{filename}"',
                connected_clients=connected_clients,
            )
            signal_clients_for_changes(None, [filename], client_type='web')
        else:
            self.write("No file received.")
            CustomPrint.print(
                f"ERROR - No file received from  {self.request.remote_ip}.",
                connected_clients=connected_clients,
            )


class WorkspaceFileUploader(tornado.web.RequestHandler):
    async def post(self):
        if file_info := self.request.files.get("file"):
            file_data = file_info[0]["body"]
            file_name: str = os.path.basename(file_info[0]["filename"])
            file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
            Path(f"data/workspace/{file_ext}").mkdir(parents=True, exist_ok=True)
            with open(f"data/workspace/{file_ext}/{file_name}", "wb") as file:
                file.write(file_data)
            CustomPrint.print(
                f'INFO - {self.request.remote_ip} uploaded "{file_name}"',
                connected_clients=connected_clients,
            )
            self.write("File uploaded successfully.")
        else:
            self.write("No file received.")
            CustomPrint.print("ERROR - No file received.", connected_clients=connected_clients)


class WorkspaceFileHandler(tornado.web.RequestHandler):
    def get(self, file_name: str):
        file_name = os.path.basename(file_name)
        file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
        filepath = os.path.join("data\\workspace", file_ext, file_name)
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                self.write(f.read())
            CustomPrint.print(
                f'INFO - Sent "{file_name}" to {self.request.remote_ip}',
                connected_clients=connected_clients,
            )
        else:
            self.set_status(404)


class ImageHandler(tornado.web.RequestHandler):
    def get(self, image_name: str):
        try:
            image_name = os.path.basename(image_name)
            filepath = os.path.join("images", image_name)
            if not filepath.endswith(".png") and not filepath.endswith(".jpeg"):
                filepath += ".jpeg"
            if os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    self.set_header("Content-Type", "image/jpeg")
                    self.write(f.read())
                CustomPrint.print(
                    f'INFO - Sent "{image_name}" to {self.request.remote_ip}',
                    connected_clients=connected_clients,
                )
            else:
                self.set_status(404)
        except FileNotFoundError:
            self.set_status(404)


class CommandHandler(tornado.web.RequestHandler):
    def post(self):
        command = self.get_argument("command")
        CustomPrint.print(
            f'INFO - Command "{command}" from {self.request.remote_ip}',
            connected_clients=connected_clients,
        )
        if command == "send_sheet_report":
            generate_sheet_report(connected_clients)


class SetOrderNumberHandler(tornado.web.RequestHandler):
    def post(self, order_number):
        try:
            order_number = int(order_number)
            file_path = "order_number.json"
            if os.path.exists(file_path):
                with open(file_path, "rb") as file:
                    json_file = msgspec.json.decode(file.read())
            else:
                json_file = {}

            json_file["order_number"] = order_number
            with open(file_path, "wb") as file:
                file.write(msgspec.json.encode(json_file))

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} set order number to {order_number})",
                connected_clients=connected_clients,
            )
            self.write("Order number updated successfully.")
        except Exception as e:
            self.set_status(500)
            self.write(f"Failed to set order number: {str(e)}")


class GetOrderNumberHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_job_directories_info(
            base_directory="saved_jobs",
            specific_dirs=[
                "planning",
                "quoting",
                "quoted",
                "template",
            ],
        )

        max_order_number = 0
        for _, job_data in directories_info.items():
            max_order_number = max(max_order_number, job_data["order_number"])

        next_order_number = max_order_number + 1

        CustomPrint.print(
            f"INFO - Sent order number ({next_order_number}) to {self.request.remote_ip}",
            connected_clients=connected_clients,
        )
        self.write({"order_number": next_order_number})


class SheetQuantityHandler(tornado.web.RequestHandler):
    def get(self, sheet_name: str):
        sheet_name = sheet_name.replace("_", " ")
        if sheet_exists(sheet_name=sheet_name):
            self.load_page(sheet_name)
        else:
            self.set_status(404)
            self.write("Sheet not found")

    def load_trusted_users(self, file_path: str):
        with open(file_path, 'r', encoding="utf-8") as file:
            return [line.strip() for line in file if line.strip()]

    def load_page(self, sheet_name):

        trusted_users = self.load_trusted_users('trusted_users.txt')

        quantity = get_sheet_quantity(sheet_name=sheet_name)
        pending_data = get_sheet_pending_data(sheet_name=sheet_name)
        template = (
            env.get_template("sheet_template.html")
            if self.request.remote_ip in trusted_users
            else env.get_template("sheet_template_read_only.html")
        )

        rendered_template = template.render(sheet_name=sheet_name, quantity=quantity, pending_data=pending_data)

        self.set_status(200)
        self.write(rendered_template)

    def post(self, sheet_name):
        new_quantity = float(self.get_argument("new_quantity"))
        try:
            order_pending_quantity = float(self.get_argument("order_pending_quantity"))
        except ValueError:  # Add Incoming Quantity was NOT used
            order_pending_quantity = 0.0
        order_pending_date = self.get_argument("order_pending_date")
        expected_arrival_time = self.get_argument("expected_arrival_time")
        notes = self.get_argument("notes")

        order = Order(
            {
                "expected_arrival_time": expected_arrival_time,
                "order_pending_quantity": order_pending_quantity,
                "order_pending_date": order_pending_date,
                "notes": notes,
            }
        )

        set_sheet_quantity(sheet_name, new_quantity, order, connected_clients)

        self.redirect(f"/sheets_in_inventory/{sheet_name}")


class AddCutoffSheetHandler(tornado.web.RequestHandler):
    def get(self):
        sheet_settings = SheetSettings()
        template = env.get_template("add_cutoff_sheet.html")
        rendered_template = template.render(
            thicknesses=sheet_settings.get_thicknesses(),
            materials=sheet_settings.get_materials(),
            cutoff_sheets=get_cutoff_sheets(),
        )
        CustomPrint.print(
            f"INFO - {self.request.remote_ip} visited /add_cutoff_sheet",
            connected_clients=connected_clients,
        )
        self.write(rendered_template)

    def post(self):
        length = float(self.get_argument("length"))
        width = float(self.get_argument("width"))
        material = self.get_argument("material")
        thickness = self.get_argument("thickness")
        quantity = int(self.get_argument("quantity"))

        add_sheet(
            thickness=thickness,
            material=material,
            sheet_dim=f"{length:.3f}x{width:.3f}",
            sheet_count=quantity,
            _connected_clients=connected_clients,
        )

        CustomPrint.print(
            f"INFO - {self.request.remote_ip} added cutoff sheet",
            connected_clients=connected_clients,
        )

        self.redirect("/add_cutoff_sheet")


class DeleteCutoffSheetHandler(tornado.web.RequestHandler):
    def post(self):
        sheet_id = self.get_argument("sheet_id")

        remove_cutoff_sheet(sheet_id, connected_clients)

        self.redirect("/add_cutoff_sheet")


executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="file_directory_gatherer")


async def gather_quote_directories_info(base_directory: str, specific_dirs: list[str]):
    directories: dict[str, dict[str, str]] = {}

    def blocking_io():
        gathered_data: dict[str, dict[str, str]] = {}
        for specific_dir in specific_dirs:
            specific_path: str = os.path.join(base_directory, specific_dir)
            for root, dirs, _ in os.walk(specific_path):
                for dirname in dirs:
                    dir_path = os.path.join(root, dirname)
                    quote_data_path = os.path.join(dir_path, "data.json")
                    try:
                        with open(quote_data_path, "rb") as f:
                            quote_data = msgspec.json.decode(f.read())
                        dir_info = {
                            "name": dirname,
                            "modified_date": os.path.getmtime(quote_data_path),
                            "status": quote_data["settings"]["status"],
                            "order_number": quote_data["settings"]["order_number"],
                            "date_shipped": quote_data["settings"]["date_shipped"],
                            "date_expected": quote_data["settings"]["date_expected"],
                            "ship_to": quote_data["settings"]["ship_to"],
                        }
                        dir_path = dir_path.replace(f"{base_directory}\\", "")
                        gathered_data[dir_path] = dir_info
                    except Exception as e:
                        print(f"Error processing {dir_path}: {str(e)}")
        return gathered_data

    directories = await tornado.ioloop.IOLoop.current().run_in_executor(executor, blocking_io)
    return directories


class GetPreviousQuotesHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_quote_directories_info(
            base_directory="previous_quotes",
            specific_dirs=["quotes", "workorders", "packing_slips"],
        )
        self.write(msgspec.json.encode(directories_info))


class GetSavedQuotesHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_quote_directories_info(
            base_directory="saved_quotes",
            specific_dirs=["quotes", "workorders", "packing_slips"],
        )
        self.write(msgspec.json.encode(directories_info))


async def gather_job_directories_info(base_directory: str, specific_dirs: list[str]):
    directories: dict[str, dict[str, str]] = {}

    def blocking_io():
        gathered_data: dict[str, dict[str, str]] = {}
        for specific_dir in specific_dirs:
            specific_path: str = os.path.join(base_directory, specific_dir)
            for root, dirs, _ in os.walk(specific_path):
                for dirname in dirs:
                    dir_path = os.path.join(root, dirname)
                    job_data_path = os.path.join(dir_path, "data.json")
                    try:
                        with open(job_data_path, "rb") as f:
                            job_data = msgspec.json.decode(f.read())

                        modified_timestamp = os.path.getmtime(job_data_path)
                        formatted_modified_date = datetime.fromtimestamp(modified_timestamp).strftime('%Y-%m-%d %I:%M:%S %p')

                        dir_info = {
                            "dir": root.replace("\\", '/'),
                            "name": dirname,
                            "modified_date": modified_timestamp,
                            "formated_modified_date": formatted_modified_date,
                            "type": job_data["job_data"].get("type", 0),
                            "order_number": job_data["job_data"].get("order_number", 0),
                            "ship_to": job_data["job_data"].get("ship_to", ""),
                            "date_shipped": job_data["job_data"].get("starting_date", ""),
                            "date_expected": job_data["job_data"].get("ending_date", ""),
                            "color": job_data["job_data"].get("color", ""),
                        }
                        dir_path = dir_path.replace(f"{base_directory}\\", "")
                        gathered_data[dir_path] = dir_info
                    except Exception as e:
                        print(f"Gather Job Info - Error processing {dir_path}: {str(e)}")
        return gathered_data

    directories = await tornado.ioloop.IOLoop.current().run_in_executor(executor, blocking_io)
    return directories


class GetJobsHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_job_directories_info(
            base_directory="saved_jobs",
            specific_dirs=[
                "planning",
                "quoting",
                "quoted",
                "template",
            ],
        )
        self.write(msgspec.json.encode(directories_info))


class JobPrintoutsHandler(tornado.web.RequestHandler):
    async def get(self):
        specific_dirs = [
            "planning",
            "quoting",
            "quoted",
            "template",
        ]
        directories_info = await gather_job_directories_info(
            base_directory="saved_jobs",
            specific_dirs=specific_dirs,
        )
        template = env.get_template("job_printouts.html")
        rendered_template = template.render(
            directories_info=directories_info,
            specific_dirs=specific_dirs,
        )
        self.write(rendered_template)


class LoadJobHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        html_file_path = os.path.join(folder_name, "page.html")

        if os.path.exists(html_file_path):
            with open(html_file_path, "r", encoding="utf-8") as file:
                html_content = file.read()

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} loaded job: {folder_name}",
                connected_clients=connected_clients,
            )

            self.write(html_content)
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")


class SendErrorReportHandler(tornado.web.RequestHandler):
    def post(self):
        error_log = self.get_argument("error_log")
        CustomPrint.print(
            f"INFO - {self.request.remote_ip} sent error_log",
            connected_clients=connected_clients,
        )
        if error_log is not None:
            log_file_name = f'Error Log - {datetime.now().strftime("%B %d %A %Y %I_%M_%S %p")}.log'
            error_log_url = f"http://invi.go/logs#{quote(log_file_name, safe='')}"
            html_error_log_url = f'<a href="{error_log_url}">Error Log</a>'
            with open(
                f"{os.path.dirname(os.path.realpath(__file__))}/logs/{log_file_name}",
                "w",
                encoding="utf-8",
            ) as error_file:
                error_file.write(error_log)

            send_error_log(
                body=f"{html_error_log_url}\n{error_log}",
                connected_clients=connected_clients,
            )
        else:
            self.set_status(400)


class SendEmailHandler(tornado.web.RequestHandler):
    def post(self):
        message = self.get_argument("message", default=None)
        title = self.get_argument("title", default="No Title Provided")
        emails = self.get_argument("emails", default=None)

        email_list = emails.split(",")
        try:
            send(title, message, email_list, connected_clients=connected_clients)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} initiated send email: {title}",
                connected_clients=connected_clients,
            )

            self.write("Email sent successfully.")
        except Exception as e:
            self.set_status(500, "Failed to send email")
            self.finish(f"Error sending email: {str(e)}")


class UploadJobHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            folder = self.get_argument("folder")

            job_data_json = self.request.files["job_data"][0]["body"]
            job_data = msgspec.json.decode(job_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            job_file_path = os.path.join(folder, "data.json")
            with open(job_file_path, "wb") as f:
                f.write(msgspec.json.encode(job_data))

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            print(folder, job_file_path, html_file_path)

            signal_clients_for_changes(
                client_to_ignore=self.request.remote_ip,
                changed_files=["reload_saved_jobs"],
            )

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} uploaded job: {folder}",
                connected_clients=connected_clients,
            )

            self.write(
                {
                    "status": "success",
                    "message": "Job and HTML file uploaded successfully.",
                }
            )
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class DownloadJobHandler(tornado.web.RequestHandler):
    def get(self, folder_name: str):
        folder_name = folder_name.replace("\\", "/")
        json_file_path = os.path.join(folder_name, "data.json")

        if os.path.exists(json_file_path):
            self.set_header("Content-Type", "application/octet-stream")
            self.set_header("Content-Disposition", f'attachment; filename="{folder_name}_job.json"')

            with open(json_file_path, "rb") as file:
                while True:
                    if data := file.read(16384):
                        self.write(data)
                    else:
                        break
            CustomPrint.print(
                f"INFO - {self.request.remote_ip} downloaded job: {folder_name}",
                connected_clients=connected_clients,
            )
            self.finish()
        else:
            self.set_status(404)
            self.write("404: File not found")


class AddJobToProductionPlannerHandler(tornado.web.RequestHandler):
    def post(self, job_path: str):
        try:
            self.components_inventory = ComponentsInventory()
            self.sheet_settings = SheetSettings()
            self.workspace_settings = WorkspaceSettings()
            self.paint_inventory = PaintInventory(self.components_inventory)
            self.sheets_inventory = SheetsInventory(self.sheet_settings)
            self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
            self.job_manager = JobManager(self.sheet_settings, self.sheets_inventory, self.workspace_settings, self.components_inventory, self.laser_cut_inventory, self.paint_inventory, None)
            self.workspace = Workspace(self.workspace_settings, self.job_manager)
            self.production_plan = ProductionPlan(self.workspace_settings, self.job_manager)

            job_path = job_path.replace("\\", "/")
            json_file_path = os.path.join(job_path, "data.json")
            with open(json_file_path, "rb") as file:
                data = msgspec.json.decode(file.read())
                job = Job(data, self.job_manager)
                self.production_plan.add_job(job)
                self.production_plan.save()

            signal_clients_for_changes(None, [f"{self.production_plan.filename}.json"], "web")

            self.write({"status": "success", "message": f"Job added successfully: {job.name}"})
            self.set_status(200)
        except Exception as e:
            self.write({"status": "error", "message": str(e)})
            self.set_status(500)


class UpdateJobSettingsHandler(tornado.web.RequestHandler):
    def post(self):
        folder = self.get_argument("folder")
        folder = folder.replace("\\", "/")
        job_name = os.path.basename(folder)
        key_to_change = self.get_argument("key")
        new_value = self.get_argument("value")

        if key_to_change == "type":  # For some reason it gets parsed as a string
            new_value = int(new_value)

        file_path = os.path.join(folder, "data.json")

        try:
            if os.path.exists(file_path):
                with open(file_path, "rb") as file:
                    data = msgspec.json.decode(file.read())

                data["job_data"][key_to_change] = new_value

                with open(file_path, "wb") as file:
                    file.write(msgspec.json.encode(data))
                if key_to_change == "type":
                    destination = f"saved_jobs\\{JobStatus(new_value).name.lower()}\\{job_name}"
                    if os.path.exists(destination):
                        shutil.rmtree(destination)
                    shutil.move(folder, destination)

                signal_clients_for_changes(
                    client_to_ignore=self.request.remote_ip,
                    changed_files=["reload_saved_jobs"],
                )

                CustomPrint.print(
                    f"INFO - {self.request.remote_ip} changed job setting '{key_to_change}' to '{new_value}': {folder}",
                    connected_clients=connected_clients,
                )

                self.write(
                    {
                        "status": "success",
                        "message": "Job settings updated successfully.",
                    }
                )
            else:
                self.set_status(404)
                self.write({"status": "error", "message": "File not found."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class DeleteJobHandler(tornado.web.RequestHandler):
    def post(self, folder_name: str):  # saved_jobs/[PATH]/[JOB_NAME]
        CustomPrint.print(
            f"INFO - Deleting - {folder_name}",
            connected_clients=connected_clients,
        )

        folder_name = folder_name.replace("\\", "/")
        json_file_path = os.path.join(folder_name, "data.json")
        html_file_path = os.path.join(folder_name, "page.html")

        try:
            self.delete_data(json_file_path, folder_name, html_file_path)
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})

    def delete_data(self, json_file_path, folder_name, html_file_path):
        if os.path.exists(json_file_path):
            os.remove(json_file_path)
        else:
            raise FileNotFoundError(f"No JSON file found for {folder_name}.")

        if os.path.exists(html_file_path):
            os.remove(html_file_path)

        if not os.listdir(folder_name):
            os.rmdir(folder_name)

        signal_clients_for_changes(
            client_to_ignore=self.request.remote_ip,
            changed_files=["reload_saved_jobs"],
        )

        CustomPrint.print(
            f"INFO - {self.request.remote_ip} deleted job: {folder_name}",
            connected_clients=connected_clients,
        )

        self.write({"status": "success", "message": "Quote deleted successfully."})


class ProductionPlannerHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("production_planner.html")
        rendered_template = template.render()
        self.write(rendered_template)


class ProductionPlannerJobPrintoutHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            data = msgspec.json.decode(self.request.body)

            self.components_inventory = ComponentsInventory()
            self.sheet_settings = SheetSettings()
            self.workspace_settings = WorkspaceSettings()
            self.paint_inventory = PaintInventory(self.components_inventory)
            self.sheets_inventory = SheetsInventory(self.sheet_settings)
            self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
            self.job_manager = JobManager(self.sheet_settings, self.sheets_inventory, self.workspace_settings, self.components_inventory, self.laser_cut_inventory, self.paint_inventory, self)

            job = Job(data, self.job_manager)
            printout = WorkspaceJobPrintout(job, "WORKORDER")
            html_content = printout.generate()

            self.set_header("Content-Type", "text/html")
            self.write(html_content)
        except msgspec.DecodeError:
            self.write({"status": "error", "message": "Invalid JSON"})
            self.set_status(400)
        except Exception as e:
            self.write({"status": "error", "message": str(e)})
            self.set_status(500)


class WorkspaceDashboardHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("workspace_dashboard.html")
        rendered_template = template.render()
        self.write(rendered_template)


class WorkspaceArchivesDashboardHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("workspace_archives.html")
        rendered_template = template.render()
        self.write(rendered_template)


class UploadWorkorderHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            folder = os.path.join("workorders", self.get_argument("folder"))

            workorder_data_json = self.request.files["workorder_data"][0]["body"]
            workorder_data = msgspec.json.decode(workorder_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            workorder_file_path = os.path.join(folder, "data.json")
            with open(workorder_file_path, "wb") as f:
                f.write(msgspec.json.encode(workorder_data))

            workorder_backup_file_path = os.path.join(folder, "data_backup.json")
            with open(workorder_backup_file_path, "wb") as f:
                f.write(msgspec.json.encode(workorder_data))

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} uploaded workorder: {folder}",
                connected_clients=connected_clients,
            )

            self.write(
                {
                    "status": "success",
                    "message": "Workorder and HTML file uploaded successfully.",
                }
            )
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class LoadWorkorderHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        html_file_path = os.path.join("workorders", folder_name, "page.html")

        if os.path.exists(html_file_path):
            with open(html_file_path, "r", encoding="utf-8") as file:
                html_content = file.read()

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} loaded workorder printout: {folder_name}",
                connected_clients=connected_clients,
            )

            self.write(html_content)
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")


class WorkorderHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        data_file_path = os.path.join("workorders", folder_name, "data.json")

        if os.path.exists(data_file_path):
            with open(data_file_path, "rb") as file:
                data = msgspec.json.decode(file.read())

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} loaded workorder: {folder_name}",
                connected_clients=connected_clients,
            )

            template = env.get_template("workorder.html")
            rendered_template = template.render(
                workorder_id=folder_name,
                workorder_data=data,
            )
            self.write(rendered_template)
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")


def check_if_assemblies_are_ready_to_start_timer(workspace: Workspace):
    for assembly in workspace.get_all_assemblies():
        if assembly.all_laser_cut_parts_complete() and not assembly.timer.has_started_timer():
            assembly.timer.start_timer()


async def update_laser_cut_parts_process(nest_or_workorder: Union[Workorder, Nest], workspace: Workspace):
    if isinstance(nest_or_workorder, Workorder):
        nests_to_update = nest_or_workorder.nests
    elif isinstance(nest_or_workorder, Nest):
        nests_to_update = [nest_or_workorder]

    if workspace_part_groups := workspace.get_grouped_laser_cut_parts(workspace.get_all_laser_cut_parts_with_similar_tag("picking")):
        for nest in nests_to_update:
            for workspace_part_group in workspace_part_groups:
                for nested_laser_cut_part in nest.laser_cut_parts:
                    if workspace_part_group.base_part.name == nested_laser_cut_part.name:
                        workspace_part_group.move_to_next_process(nest.sheet_count * nested_laser_cut_part.quantity_in_nest)
                        break

    check_if_assemblies_are_ready_to_start_timer(workspace)

    workspace.save()
    workspace.laser_cut_inventory.save()

    signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{workspace.filename}.json", f"{workspace.laser_cut_inventory.filename}.json"])


class MarkWorkorderDoneHandler(tornado.web.RequestHandler):
    lock = asyncio.Lock()

    async def post(self, workorder_id: str):
        async with self.lock:
            try:
                self.workorder_data = msgspec.json.decode(self.request.body)

                self.components_inventory = ComponentsInventory()
                self.sheet_settings = SheetSettings()
                self.workspace_settings = WorkspaceSettings()
                self.paint_inventory = PaintInventory(self.components_inventory)
                self.sheets_inventory = SheetsInventory(self.sheet_settings)
                self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
                self.job_manager = JobManager(self.sheet_settings, self.sheets_inventory, self.workspace_settings, self.components_inventory, self.laser_cut_inventory, self.paint_inventory, self)
                self.workspace = Workspace(self.workspace_settings, self.job_manager)

                self.workorder = Workorder(self.workorder_data, self.sheet_settings, self.laser_cut_inventory)

                await update_laser_cut_parts_process(self.workorder, self.workspace)

                self.workorder.nests = []

                workorder_data_path = os.path.join("workorders", workorder_id, "data.json")

                with open(workorder_data_path, 'wb') as f:
                    f.write(msgspec.json.encode(self.workorder.to_dict()))

                self.write({"status": "success", "message": "Workorder marked as done."})
            except Exception as e:
                self.set_status(500)
                self.write({"status": "error", "message": str(e)})


class MarkNestDoneHandler(tornado.web.RequestHandler):
    lock = asyncio.Lock()

    async def post(self, workorder_id: str):
        async with self.lock:
            try:
                self.nest_data = msgspec.json.decode(self.request.body)

                self.components_inventory = ComponentsInventory()
                self.sheet_settings = SheetSettings()
                self.workspace_settings = WorkspaceSettings()
                self.paint_inventory = PaintInventory(self.components_inventory)
                self.sheets_inventory = SheetsInventory(self.sheet_settings)
                self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
                self.job_manager = JobManager(self.sheet_settings, self.sheets_inventory, self.workspace_settings, self.components_inventory, self.laser_cut_inventory, self.paint_inventory, self)
                self.workspace = Workspace(self.workspace_settings, self.job_manager)

                self.nest = Nest(self.nest_data, self.sheet_settings, self.laser_cut_inventory)

                await update_laser_cut_parts_process(self.nest, self.workspace)

                workorder_data_path = os.path.join("workorders", workorder_id, "data.json")

                with open(workorder_data_path, "rb") as f:
                    workorder_data: dict = msgspec.json.decode(f.read())

                self.workorder = Workorder(workorder_data, self.sheet_settings, self.laser_cut_inventory)
                new_nests: list[Nest] = []

                for nest in self.workorder.nests:
                    if nest.get_name() != self.nest.get_name():
                        new_nests.append(nest)

                self.workorder.nests = new_nests

                with open(workorder_data_path, 'wb') as f:
                    f.write(msgspec.json.encode(self.workorder.to_dict()))

                self.write({"status": "success", "message": "Nest marked as done."})
            except Exception as e:
                self.set_status(500)
                self.write({"status": "error", "message": str(e)})


class RecutPartHandler(tornado.web.RequestHandler):
    lock = asyncio.Lock()

    async def post(self, workorder_id: str):
        async with self.lock:
            try:
                self.recut_data = msgspec.json.decode(self.request.body)

                self.components_inventory = ComponentsInventory()
                self.sheet_settings = SheetSettings()
                self.workspace_settings = WorkspaceSettings()
                self.paint_inventory = PaintInventory(self.components_inventory)
                self.sheets_inventory = SheetsInventory(self.sheet_settings)
                self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
                self.job_manager = JobManager(self.sheet_settings, self.sheets_inventory, self.workspace_settings, self.components_inventory, self.laser_cut_inventory, self.paint_inventory, self)
                self.workspace = Workspace(self.workspace_settings, self.job_manager)

                self.laser_cut_part_to_recut = LaserCutPart(self.recut_data['laser_cut_part'], self.laser_cut_inventory)
                self.laser_cut_part_to_recut.recut = True

                self.recut_nest = Nest(self.recut_data['nest'], self.sheet_settings, self.laser_cut_inventory)

                self.recut_quantity = int(self.recut_data['quantity'])

                for workspace_part_group in self.workspace.get_grouped_laser_cut_parts(self.workspace.get_all_laser_cut_parts_with_similar_tag("picking")):
                    if workspace_part_group.base_part.name == self.laser_cut_part_to_recut.name:
                        workspace_part_group.mark_as_recut(self.recut_quantity)
                        self.laser_cut_inventory.add_or_update_laser_cut_part(self.laser_cut_part_to_recut, f"Workorder recut: {self.recut_nest.get_name()}")
                        break

                workorder_data_path = os.path.join("workorders", workorder_id, "data.json")

                with open(workorder_data_path, "rb") as f:
                    workorder_data: list[dict[str, object]] = msgspec.json.decode(f.read())

                self.workorder = Workorder(workorder_data, self.sheet_settings, self.laser_cut_inventory)

                found_recut_part: bool = False

                for workorder_nest in self.workorder.nests:
                    if workorder_nest.get_name() == self.recut_nest.get_name():
                        for nested_laser_cut_part in workorder_nest.laser_cut_parts:
                            if nested_laser_cut_part.name == self.laser_cut_part_to_recut.name:
                                found_recut_part = True
                                nested_laser_cut_part.recut_count += self.recut_quantity
                                nested_laser_cut_part.recut = True
                                break
                    if found_recut_part:
                        break

                with open(workorder_data_path, 'wb') as f:
                    f.write(msgspec.json.encode(self.workorder.to_dict()))

                self.workspace.save()
                self.workspace.laser_cut_inventory.save()

                signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{self.workspace.filename}.json", f"{self.workspace.laser_cut_inventory.filename}.json"])

                self.write({"status": "success", "message": "Recut part processed successfully."})
            except Exception as e:
                self.set_status(500)
                self.write({"status": "error", "message": str(e)})


class UploadQuoteHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            folder = self.get_argument("folder")

            quote_data_json = self.request.files["quote_data"][0]["body"]
            quote_data = msgspec.json.decode(quote_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            quote_file_path = os.path.join(folder, "data.json")
            with open(quote_file_path, "wb") as f:
                f.write(msgspec.json.encode(quote_data))

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            signal_clients_for_changes(
                client_to_ignore=self.request.remote_ip,
                changed_files=["reload_saved_quotes"],
            )

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} uploaded quote: {folder}",
                connected_clients=connected_clients,
            )

            self.write(
                {
                    "status": "success",
                    "message": "Quote and HTML file uploaded successfully.",
                }
            )
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class DownloadQuoteHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        json_file_path = os.path.join(folder_name, "data.json")

        if os.path.exists(json_file_path):
            self.set_header("Content-Type", "application/octet-stream")
            self.set_header(
                "Content-Disposition",
                f'attachment; filename="{folder_name}_quote.json"',
            )

            with open(json_file_path, "rb") as file:
                while True:
                    if data := file.read(16384):
                        self.write(data)
                    else:
                        break
            CustomPrint.print(
                f"INFO - {self.request.remote_ip} downloaded quote: {folder_name}",
                connected_clients=connected_clients,
            )
            self.finish()
        else:
            self.set_status(404)
            self.write("404: File not found")


class LoadQuoteHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        html_file_path = os.path.join(folder_name, "page.html")

        if os.path.exists(html_file_path):
            with open(html_file_path, "r", encoding="utf-8") as file:
                html_content = file.read()

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} loaded quote: {folder_name}",
                connected_clients=connected_clients,
            )

            self.write(html_content)
        else:
            self.set_status(404)
            self.write("404: HTML file not found.")


class DeleteQuoteHandler(tornado.web.RequestHandler):
    def post(self, folder_name):
        CustomPrint.print(
            f"INFO - Deleting - {folder_name}",
            connected_clients=connected_clients,
        )

        json_file_path = os.path.join(folder_name, "data.json")
        html_file_path = os.path.join(folder_name, "page.html")

        try:
            self.delete_data(json_file_path, folder_name, html_file_path)
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})

    def delete_data(self, json_file_path, folder_name, html_file_path):
        if os.path.exists(json_file_path):
            os.remove(json_file_path)
        else:
            raise FileNotFoundError(f"No JSON file found for {folder_name}.")

        if os.path.exists(html_file_path):
            os.remove(html_file_path)

        if not os.listdir(folder_name):
            os.rmdir(folder_name)

        signal_clients_for_changes(
            client_to_ignore=self.request.remote_ip,
            changed_files=["reload_saved_quotes"],
        )

        CustomPrint.print(
            f"INFO - {self.request.remote_ip} deleted quote: {folder_name}",
            connected_clients=connected_clients,
        )

        self.write({"status": "success", "message": "Quote deleted successfully."})


class UpdateQuoteSettingsHandler(tornado.web.RequestHandler):
    def post(self):
        folder = self.get_argument("folder")
        key_to_change = self.get_argument("key")
        new_value = self.get_argument("value")

        file_path = os.path.join(folder, "data.json")

        try:
            if os.path.exists(file_path):
                self.save_data(file_path, new_value, key_to_change, folder)
            else:
                self.set_status(404)
                self.write({"status": "error", "message": "File not found."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})

    def save_data(self, file_path, new_value, key_to_change, folder):
        with open(file_path, "rb") as file:
            data = msgspec.json.decode(file.read())

        data["settings"][key_to_change] = new_value

        with open(file_path, "wb") as file:
            file.write(msgspec.json.encode(data))

        signal_clients_for_changes(
            client_to_ignore=self.request.remote_ip,
            changed_files=["reload_saved_quotes"],
        )

        CustomPrint.print(
            f"INFO - {self.request.remote_ip} changed quote setting '{key_to_change}' to '{new_value}': {folder}",
            connected_clients=connected_clients,
        )

        self.write(
            {
                "status": "success",
                "message": "Quote settings updated successfully.",
            }
        )


class QRCodePageHandler(tornado.web.RequestHandler):
    def get(self):
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        sheet_data: dict[str, list[str]] = {}
        for category in sheets_inventory.get_categories():
            if category.name == "Cutoff":
                continue
            sheet_data |= {category.name: []}
            for sheet in sheets_inventory.get_sheets_by_category(category):
                sheet_data[category.name].append(sheet.get_name())

        template = env.get_template("view_qr_codes.html")
        rendered_template = template.render(sheet_data=sheet_data)
        self.write(rendered_template)


class InventoryHandler(tornado.web.RequestHandler):
    def get(self):
        components_inventory = ComponentsInventory()
        workspace_settings = WorkspaceSettings()
        paint_inventory = PaintInventory(components_inventory)
        laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        data: dict[str, dict[str, str]] = {"Components Inventory": {}}
        categories = natsorted(components_inventory.get_categories(), key=lambda category: category.name)
        for category in categories:
            data["Components Inventory"].update({category.name: f'/inventory/components_inventory/{quote(category.name, safe="")}'})

        categories = natsorted(laser_cut_inventory.get_categories(), key=lambda category: category.name)
        data |= {"Laser Cut Inventory": {}}
        for category in categories:
            data["Laser Cut Inventory"].update({category.name: f'/inventory/laser_cut_inventory/{quote(category.name, safe="")}'})

        categories = natsorted(paint_inventory.get_categories(), key=lambda category: category.name)
        data |= {"Paint Inventory": {}}
        for category in categories:
            data["Paint Inventory"].update({category.name: f'/inventory/paint_inventory/{quote(category.name, safe="")}'})

        categories = natsorted(sheets_inventory.get_categories(), key=lambda category: category.name)
        data |= {"Sheets Inventory": {}}
        for category in categories:
            data["Sheets Inventory"].update({category.name: f'/inventory/sheets_inventory/{quote(category.name, safe="")}'})

        data |= {"Sheet Settings": {}}
        data["Sheet Settings"].update({"Price Per Pound": "/inventory/sheet_settings/price_per_pound"})

        template = env.get_template("inventories.html")
        rendered_template = template.render(
            data=data,
        )
        self.write(rendered_template)


class InventoryTablesHandler(tornado.web.RequestHandler):
    def get(self, inventory_type: str, category: str):
        data = []
        sheet_settings = SheetSettings()
        workspace_settings = WorkspaceSettings()
        components_inventory = ComponentsInventory()
        paint_inventory = PaintInventory(components_inventory)
        laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
        sheets_inventory = SheetsInventory(sheet_settings)
        if inventory_type == "components_inventory":
            data = [{"part_number": component.part_number, **component.to_dict()} for component in components_inventory.get_components_by_category(category)]
        elif inventory_type == "laser_cut_inventory":
            data = [{"name": laser_cut_part.name, **laser_cut_part.to_dict()} for laser_cut_part in laser_cut_inventory.get_laser_cut_parts_by_category(category)]
        elif inventory_type == "paint_inventory":
            if category == "primer":
                data = [{"name": primer.name, **primer.to_dict()} for primer in paint_inventory.primers]
            elif category == "paint":
                data = [{"name": paint.name, **paint.to_dict()} for paint in paint_inventory.paints]
            elif category == "powder":
                data = [{"name": powder.name, **powder.to_dict()} for powder in paint_inventory.powders]
        elif inventory_type == "sheet_settings":
            if category == "price_per_pound":
                data = [{material: sheet_settings.get_price_per_pound(material) for material in sheet_settings.get_materials()}]
        elif inventory_type == "sheets_inventory":
            data = [{"name": sheet.get_name(), **sheet.to_dict()} for sheet in sheets_inventory.get_sheets_by_category(category)]
        template = env.get_template("inventory_table.html")
        rendered_template = template.render(
            inventory_type=inventory_type.replace("_", " ").title(),
            category=category,
            data=data,
            headers=data[0].keys() if data else [],
        )
        self.write(rendered_template)


def signal_clients_for_changes(client_to_ignore, changed_files: list[str], client_type: Literal["software", "web"] = 'software') -> None:
    clients = connected_clients if client_type == 'software' else web_connected_clients

    CustomPrint.print(
        f"INFO - Signaling {len(clients)} {client_type} clients",
        connected_clients=clients,
    )

    def send_message(client: tornado.websocket.WebSocketHandler, message):
        if client.ws_connection and client.ws_connection.stream.socket:
            client.write_message(message)
            CustomPrint.print(
                f"INFO - Signaling {client.request.remote_ip} to download {changed_files}",
                connected_clients=clients,
            )

    message = msgspec.json.encode({"action": "download", "files": changed_files})

    for client in clients:
        if client.request.remote_ip == client_to_ignore:
            CustomPrint.print(
                f"INFO - Ignoring {client.request.remote_ip} since it sent {changed_files}",
                connected_clients=clients,
            )
            continue

        try:
            # Check if we're inside the Tornado IOLoop
            IOLoop.current().add_callback(send_message, client, message)
        except RuntimeError:
            # We're outside the IOLoop, so we need to run the message sending inside it
            loop = asyncio.get_event_loop()
            loop.call_soon_threadsafe(IOLoop.current().add_callback, send_message, client, message)


def hourly_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Hourly Backup - {datetime.now().strftime('%I %p')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Hourly backup complete", connected_clients=connected_clients)


def daily_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Daily Backup - {datetime.now().strftime('%d %B')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Daily backup complete", connected_clients=connected_clients)


def weekly_backup_inventory_files() -> None:
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Weekly Backup - {datetime.now().strftime('%W')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Weekly backup complete", connected_clients=connected_clients)


def zip_files(path_to_zip_file: str, files_to_backup: list[str]) -> None:
    file = zipfile.ZipFile(path_to_zip_file, mode="w")
    for file_path in files_to_backup:
        file.write(
            f"{os.path.dirname(os.path.realpath(__file__))}/data/{file_path}",
            file_path,
            compress_type=zipfile.ZIP_DEFLATED,
        )
    file.close()


def check_production_plan_for_jobs() -> None:
    CustomPrint.print("INFO - Checking for jobs to be moved from production plan to workspace", connected_clients=connected_clients)
    jobs_added = False
    components_inventory = ComponentsInventory()
    sheet_settings = SheetSettings()
    workspace_settings = WorkspaceSettings()
    paint_inventory = PaintInventory(components_inventory)
    sheets_inventory = SheetsInventory(sheet_settings)
    laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
    job_manager = JobManager(sheet_settings, sheets_inventory, workspace_settings, components_inventory, laser_cut_inventory, paint_inventory, None)
    workspace = Workspace(workspace_settings, job_manager)
    production_plan = ProductionPlan(workspace_settings, job_manager)

    today = datetime.today().date()

    for job in production_plan.jobs:
        if job.moved_job_to_workspace:
            continue

        job_starting_date = datetime.strptime(job.starting_date, "%Y-%m-%d %I:%M %p").date()
        job_ending_date = datetime.strptime(job.ending_date, "%Y-%m-%d %I:%M %p").date()

        if job_starting_date <= today <= job_ending_date:
            jobs_added = True
            new_job = workspace.add_job(job)
            job.moved_job_to_workspace = True
            new_job.moved_job_to_workspace = True

            for assembly in new_job.get_all_assemblies():
                if assembly.all_laser_cut_parts_complete() and not assembly.timer.has_started_timer():
                    assembly.timer.start_timer()
            for laser_cut_part in new_job.get_all_laser_cut_parts():
                laser_cut_part.timer.start_timer()

            CustomPrint.print(f"INFO - Job, '{job.name}' added to workspace from production plan and started timers.", connected_clients=connected_clients)

    if jobs_added:
        laser_cut_inventory.save()
        workspace.save()
        production_plan.save()
        CustomPrint.print("INFO - Workspace and production plan updated, signaling clients to update files.", connected_clients=connected_clients)
        signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{workspace.filename}.json", f"{production_plan.filename}.json"], client_type="web")
        signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{workspace.filename}.json", f"{laser_cut_inventory.filename}.json"], client_type="software")
    else:
        CustomPrint.print("INFO - No jobs were added to workspace from production plan.", connected_clients=connected_clients)


def check_if_jobs_are_complete() -> None:
    components_inventory = ComponentsInventory()
    sheet_settings = SheetSettings()
    workspace_settings = WorkspaceSettings()
    paint_inventory = PaintInventory(components_inventory)
    sheets_inventory = SheetsInventory(sheet_settings)
    laser_cut_inventory = LaserCutInventory(paint_inventory, workspace_settings)
    job_manager = JobManager(sheet_settings, sheets_inventory, workspace_settings, components_inventory, laser_cut_inventory, paint_inventory, None)
    workspace = Workspace(workspace_settings, job_manager)
    workspace_history = WorkspaceHistory(job_manager)

    completed_jobs: list[Job] = []

    for job in workspace.jobs:
        if job.is_job_finished():
            CustomPrint.print(f"INFO - Job, '{job.name}' is finished and will be moved from workspace to workspace history.", connected_clients=connected_clients)
            workspace_history.add_job(job)
            CustomPrint.print(f"INFO - Added '{job.name}' to workspace history.", connected_clients=connected_clients)
            completed_jobs.append(job)

    if completed_jobs:
        for job in completed_jobs:
            workspace.remove_job(job)
            CustomPrint.print(f"INFO - Removed '{job.name}' from workspace.", connected_clients=connected_clients)
        workspace_history.save()
        workspace.save()
        CustomPrint.print("INFO - Workspace and workspace history updated, signaling clients to update files.", connected_clients=connected_clients)
        signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{workspace.filename}.json", f"{workspace_history.filename}.json"], client_type="web")
        signal_clients_for_changes(client_to_ignore=None, changed_files=[f"{workspace.filename}.json", f"{laser_cut_inventory.filename}.json"], client_type="software")


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


if __name__ == "__main__":
    coloredlogs.install(level="INFO")  # Enable colored logs
    sys.stdout = StringIO()

    # Does not need to be thread safe
    schedule.every().monday.at("04:00").do(partial(generate_sheet_report, connected_clients))
    schedule.every().hour.do(hourly_backup_inventory_files)
    schedule.every().day.at("04:00").do(daily_backup_inventory_files)
    schedule.every().week.do(weekly_backup_inventory_files)

    # For thread safety
    schedule_daily_task_at(4, 0, check_production_plan_for_jobs)
    periodic_callback = PeriodicCallback(check_if_jobs_are_complete, 60000)  # 60000 ms = 1 minute
    periodic_callback.start()

    thread = threading.Thread(target=schedule_thread)
    thread.start()

    app = tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/ws", WebSocketHandler),
            (r"/ws/web", WebSocketWebHandler),  # New WebSocket handler for web clients
            (r"/static/css/theme.css", ThemeFileHandler),
            # Log handlers
            (r"/server_log", ServerLogsHandler),
            (r"/logs", LogsHandler),
            (r"/fetch_log", LogContentHandler),
            (r"/delete_log", LogDeleteHandler),
            # NOTE deprecated
            (r"/command", CommandHandler),
            # Upload/download handlers
            (r"/file/(.*)", FileReceiveHandler),
            (r"/upload", FileUploadHandler),
            (r"/production_planner_upload", ProductionPlannerFileUploadHandler),
            (r"/workspace_upload", WorkspaceFileUploader),
            (r"/workspace_get_file/(.*)", WorkspaceFileHandler),
            # Image handlers
            (r"/image/(.*)", ImageHandler),
            (r"/images/(.*)", ImageHandler),
            # Order number habdlers
            (r"/set_order_number/(\d+)", SetOrderNumberHandler),
            (r"/get_order_number", GetOrderNumberHandler),
            # Way back machine habdlers
            (r"/way_back_machine", WayBackMachineHandler),
            (r"/fetch_data", FetchDataHandler),
            # Inventory handlers
            (r"/inventory", InventoryHandler),
            (r"/inventory/(.*)/(.*)", InventoryTablesHandler),
            # Sheet handlers
            (r"/sheets_in_inventory/(.*)", SheetQuantityHandler),
            (r"/sheet_qr_codes", QRCodePageHandler),
            (r"/add_cutoff_sheet", AddCutoffSheetHandler),
            (r"/delete_cutoff_sheet", DeleteCutoffSheetHandler),
            # Email handlers
            (r"/send_error_report", SendErrorReportHandler),
            (r"/send_email", SendEmailHandler),
            # Job handlers
            (r"/get_jobs", GetJobsHandler),
            (r"/upload_job", UploadJobHandler),
            (r"/download_job/(.*)", DownloadJobHandler),
            (r"/load_job/(.*)", LoadJobHandler),
            (r"/update_job_settings", UpdateJobSettingsHandler),
            (r"/delete_job/(.*)", DeleteJobHandler),
            (r"/jobs", JobPrintoutsHandler),
            (r"/add_job/(.*)", AddJobToProductionPlannerHandler),
            # Dashboard handlers
            (r"/production_planner", ProductionPlannerHandler),
            (r"/workspace_dashboard", WorkspaceDashboardHandler),
            (r"/workspace_archives_dashboard", WorkspaceArchivesDashboardHandler),
            (r"/production_planner_job_printout", ProductionPlannerJobPrintoutHandler),
            (r"/static/js/production_planner.js", ProductionPlannerScriptHandler),
            (r"/static/js/workspace_dashboard.js", WorkspaceScriptHandler),
            (r"/static/js/workspace_archives_dashboard.js", WorkspaceArchivesScriptHandler),
            (r"/data/production_plan.json", ProductionPlanJsonHandler),
            (r"/data/workspace.json", WorkspaceJsonHandler),
            (r"/data/workspace_settings.json", WorkspaceSettingsJsonHandler),
            # Workorder handlers
            (r"/upload_workorder", UploadWorkorderHandler),
            (r"/workorder/(.*)", WorkorderHandler),
            (r"/workorder_printout/(.*)", LoadWorkorderHandler),
            (r"/mark_workorder_done/(.*)", MarkWorkorderDoneHandler),
            (r"/mark_nest_done/(.*)", MarkNestDoneHandler),
            (r"/recut_part/(.*)", RecutPartHandler),
            # Quote handlers NOTE These will be removed in favor of Job Handelers
            (r"/get_previous_quotes", GetPreviousQuotesHandler),
            (r"/get_saved_quotes", GetSavedQuotesHandler),
            (r"/upload_quote", UploadQuoteHandler),
            (r"/update_quote_settings", UpdateQuoteSettingsHandler),
            (r"/download_quote/(.*)", DownloadQuoteHandler),
            (r"/load_quote/(.*)", LoadQuoteHandler),
            (r"/delete_quote/(.*)", DeleteQuoteHandler),
        ],
        static_path=os.path.join(os.path.dirname(__file__), "static"),
    )
    # executor = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    # app.executor = executor
    app.listen(80)
    CustomPrint.print("INFO - Invigo server started")
    tornado.ioloop.IOLoop.current().start()

