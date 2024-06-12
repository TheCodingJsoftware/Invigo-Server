# import concurrent.futures
import json
import os
import re
import shutil
import sys
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from functools import partial
from io import StringIO
from pathlib import Path
from urllib.parse import quote

import coloredlogs
import jinja2
import schedule
import tornado.ioloop
import tornado.web
import tornado.websocket
from ansi2html import Ansi2HTMLConverter
from markupsafe import Markup
from natsort import natsorted

from utils.components_inventory.components_inventory import ComponentsInventory
from utils.custom_print import CustomPrint, print_clients
from utils.inventory_updater import add_sheet, get_cutoff_sheets, get_sheet_pending_data, get_sheet_quantity, remove_cutoff_sheet, set_sheet_quantity, sheet_exists
from utils.laser_cut_inventory.laser_cut_inventory import LaserCutInventory
from utils.paint_inventory.paint_inventory import PaintInventory
from utils.send_email import send, send_error_log
from utils.sheet_report import generate_sheet_report
from utils.sheet_settings.sheet_settings import SheetSettings
from utils.sheets_inventory.sheets_inventory import SheetsInventory

# Store connected clients
connected_clients: set[tornado.websocket.WebSocketHandler] = set()

# Configure Jinja2 template environment
loader = jinja2.FileSystemLoader("templates")
env = jinja2.Environment(loader=loader)


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        template = env.get_template("index.html")
        rendered_template = template.render()
        self.write(rendered_template)


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
                file_info = {"name": file, "mtime": os.path.getmtime(file_path)}  # Get the modification time
                if file.startswith("Server Log"):
                    server_logs.append(file_info)
                elif file.startswith("Error Log"):
                    error_logs.append(file_info)

        # Sort logs by modification time (newest first)
        server_logs.sort(key=lambda x: x["mtime"], reverse=True)
        error_logs.sort(key=lambda x: x["mtime"], reverse=True)

        template = env.get_template("logs.html")
        rendered_template = template.render(server_logs=[log["name"] for log in server_logs], error_logs=[log["name"] for log in error_logs])
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
                    "ERRNO": "#bf382f",
                    "INVIGO SERVER STARTED": "#3daee9",
                    "HOURLY BACKUP COMPLETE": "#f1c234",
                    "DAILY BACKUP COMPLETE": "#f1c234",
                    "WEEKLY BACKUP COMPLETE": "#f1c234",
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
                    match = re.match(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+) - (INFO|ERROR) - (.*)", line, re.IGNORECASE)
                    if match:
                        date, level, message = match.groups()
                        level_color = "#2ead65" if level.upper() == "INFO" else "#bf382f"
                        message = string_regex.sub(r'<span style="color: #c3705d;">\g<0></span>', message)
                        message = ip_regex.sub(r'<span style="color: #8d48aa;">\g<0></span>', message)

                        for keyword in keywords:
                            message = re.sub(r"\b" + re.escape(keyword) + r"\b", keyword_replacer, message, flags=re.IGNORECASE)

                        formatted_line = f"<b>{date}</b> - <span style='color: {level_color}'>{level}</span> - <span style='color: #EAE9FC'>{message}</span>"
                        formatted_lines.append(formatted_line)
                    else:
                        formatted_lines.append(line)

                self.write("<br>".join(formatted_lines))
        else:
            self.set_status(404)
            self.write("Log file not found")


class FileSenderHandler(tornado.websocket.WebSocketHandler):
    def open(self):
        connected_clients.add(self)

        CustomPrint.print(
            f"INFO - Connection established with: {self.request.remote_ip}",
            connected_clients=connected_clients,
        )

    def on_close(self):
        connected_clients.remove(self)
        CustomPrint.print(
            f"INFO - Connection ended with: {self.request.remote_ip}",
            connected_clients=connected_clients,
        )


class FileReceiveHandler(tornado.web.RequestHandler):
    def get(self, filename: str):
        if filename.endswith(".job"):
            file_path = f"data/jobs/{filename}"
        elif filename.endswith(".json"):
            file_path = f"data/{filename}"
        try:
            with open(file_path, "rb") as file:
                data = file.read()

                # Set the response headers
                self.set_header("Content-Type", "application/json")
                self.set_header("Content-Disposition", f'attachment; filename="{filename}"')

                # Send the file as the response
                self.write(data)
                CustomPrint.print(
                    f'INFO - {self.request.remote_ip} downloaded "{filename}"',
                    connected_clients=connected_clients,
                )
        except FileNotFoundError:
            self.set_status(404)
            self.write(f'File "{filename}" not found.')
            CustomPrint.print(
                f'ERROR - File "{filename}" not found.',
                connected_clients=connected_clients,
            )


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
        should_signal_connect_clients: bool = False
        if file_info:
            file_data = file_info[0]["body"]
            file_name: str = file_info[0]["filename"]

            if file_name.lower().endswith(".json"):
                with open(f"data/{file_name}", "wb") as file:
                    file.write(file_data)
                threading.Thread(target=update_inventory_file_to_pinecone, args=(file_name,)).start()
            elif file_name.lower().endswith(".job"):
                with open(f"data/jobs/{file_name}", "wb") as file:
                    file.write(file_data)
                threading.Thread(target=update_inventory_file_to_pinecone, args=(file_name,)).start()
            elif file_name.lower().endswith(".jpeg") or file_name.lower().endswith(".jpg") or file_name.lower().endswith(".png"):
                file_name = file_name.replace("images/", "")  # Just in case
                with open(f"images/{file_name}", "wb") as file:
                    file.write(file_data)
            CustomPrint.print(
                f'INFO - {self.request.remote_ip} uploaded "{file_name}"',
                connected_clients=connected_clients,
            )
            should_signal_connect_clients = True
            if should_signal_connect_clients and file_name.lower().endswith(".json"):
                signal_clients_for_changes(client_to_ignore=self.request.remote_ip, changed_files=[file_name])
        else:
            self.write("No file received.")
            CustomPrint.print(f"ERROR - No file received from  {self.request.remote_ip}.", connected_clients=connected_clients)


class WorkspaceFileUploader(tornado.web.RequestHandler):
    async def post(self):
        if file_info := self.request.files.get("file"):
            file_data = file_info[0]["body"]
            file_name = os.path.basename(file_info[0]["filename"])
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
    def get(self, file_name):
        file_ext = os.path.splitext(file_name)[1].upper().replace(".", "")
        file_name = os.path.basename(file_name)
        filepath = os.path.join("data/workspace", file_ext, file_name)
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
        filepath = os.path.join("images", image_name)
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
                with open(file_path, "r", encoding="utf-8") as file:
                    json_file = json.load(file)
            else:
                json_file = {}

            json_file["order_number"] = order_number
            with open(file_path, "w", encoding="utf-8") as file:
                json.dump(json_file, file)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} set order number to {order_number})",
                connected_clients=connected_clients,
            )
            self.write("Order number updated successfully.")
        except Exception as e:
            self.set_status(500)
            self.write(f"Failed to set order number: {str(e)}")


class GetOrderNumberHandler(tornado.web.RequestHandler):
    def get(self):
        with open("order_number.json", "r", encoding="utf-8") as file:
            order_number = json.load(file)["order_number"]

        CustomPrint.print(
            f"INFO - Sent order number ({order_number}) to {self.request.remote_ip}",
            connected_clients=connected_clients,
        )
        self.write({"order_number": order_number})


class SheetQuantityHandler(tornado.web.RequestHandler):
    def get(self, sheet_name):
        sheet_name = sheet_name.replace("_", " ")
        if sheet_exists(sheet_name=sheet_name):
            quantity = get_sheet_quantity(sheet_name=sheet_name)
            pending_data = get_sheet_pending_data(sheet_name=sheet_name)
            if self.request.remote_ip in ["10.0.0.11", "10.0.0.64", "10.0.0.217", "10.0.0.155"]:
                template = env.get_template("sheet_template.html")
            else:
                template = env.get_template("sheet_template_read_only.html")
            rendered_template = template.render(sheet_name=sheet_name, quantity=quantity, pending_data=pending_data)
            self.write(rendered_template)
        else:
            self.write("Sheet not found")
            self.set_status(404)

    def post(self, sheet_name):
        try:
            new_quantity = float(self.get_argument("new_quantity"))
        except ValueError:
            self.write("Not a number")
            self.set_status(500)
            return

        set_sheet_quantity(sheet_name=sheet_name, new_quantity=new_quantity, clients=connected_clients)

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
        length: float = float(self.get_argument("length"))
        width: float = float(self.get_argument("width"))
        material: str = self.get_argument("material")
        thickness: str = self.get_argument("thickness")
        quantity: int = int(self.get_argument("quantity"))

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
                        with open(quote_data_path, "r", encoding="utf-8") as f:
                            quote_data = json.load(f)
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
        directories_info = await gather_quote_directories_info(base_directory="previous_quotes", specific_dirs=["quotes", "workorders", "packing_slips"])
        self.write(json.dumps(directories_info))


class GetSavedQuotesHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_quote_directories_info(base_directory="saved_quotes", specific_dirs=["quotes", "workorders", "packing_slips"])
        self.write(json.dumps(directories_info))


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
                        with open(job_data_path, "r", encoding="utf-8") as f:
                            job_data = json.load(f)
                        dir_info = {
                            "name": dirname,
                            "modified_date": os.path.getmtime(job_data_path),
                            "type": job_data["job_data"]["type"],
                            "order_number": job_data["job_data"]["order_number"],
                            "ship_to": job_data["job_data"]["ship_to"],
                            "date_shipped": job_data["job_data"]["date_shipped"],
                            "date_expected": job_data["job_data"]["date_expected"],
                        }
                        dir_path = dir_path.replace(f"{base_directory}\\", "")
                        gathered_data[dir_path] = dir_info
                    except Exception as e:
                        print(f"Error processing {dir_path}: {str(e)}")
        return gathered_data

    directories = await tornado.ioloop.IOLoop.current().run_in_executor(executor, blocking_io)
    return directories


class GetJobsHandler(tornado.web.RequestHandler):
    async def get(self):
        directories_info = await gather_job_directories_info(base_directory="saved_jobs", specific_dirs=["planning", "quoting", "quoted", "workspace", "archive"])
        self.write(json.dumps(directories_info))


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

            send_error_log(body=f"{html_error_log_url}\n{error_log}", connected_clients=connected_clients)
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
            job_data = json.loads(job_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            job_file_path = os.path.join(folder, "data.json")
            with open(job_file_path, "w", encoding="utf-8") as f:
                json.dump(job_data, f, ensure_ascii=False)

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} uploaded job: {folder}",
                connected_clients=connected_clients,
            )

            self.write({"status": "success", "message": "Job and HTML file uploaded successfully."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class DownloadJobHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
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


class UploadQuoteHandler(tornado.web.RequestHandler):
    def post(self):
        try:
            folder = self.get_argument("folder")

            quote_data_json = self.request.files["quote_data"][0]["body"]
            quote_data = json.loads(quote_data_json)

            html_file_contents = self.get_argument("html_file_contents")

            os.makedirs(folder, exist_ok=True)

            quote_file_path = os.path.join(folder, "data.json")
            with open(quote_file_path, "w", encoding="utf-8") as f:
                json.dump(quote_data, f, ensure_ascii=False)

            html_file_path = os.path.join(folder, "page.html")
            with open(html_file_path, "w", encoding="utf-8") as f:
                f.write(html_file_contents)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} uploaded quote: {folder}",
                connected_clients=connected_clients,
            )

            self.write({"status": "success", "message": "Quote and HTML file uploaded successfully."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class DownloadQuoteHandler(tornado.web.RequestHandler):
    def get(self, folder_name):
        json_file_path = os.path.join(folder_name, "data.json")

        if os.path.exists(json_file_path):
            self.set_header("Content-Type", "application/octet-stream")
            self.set_header("Content-Disposition", f'attachment; filename="{folder_name}_quote.json"')

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
            if os.path.exists(json_file_path):
                os.remove(json_file_path)
            else:
                raise FileNotFoundError(f"No JSON file found for {folder_name}.")

            if os.path.exists(html_file_path):
                os.remove(html_file_path)

            if not os.listdir(folder_name):
                os.rmdir(folder_name)

            CustomPrint.print(
                f"INFO - {self.request.remote_ip} deleted quote: {folder_name}",
                connected_clients=connected_clients,
            )

            self.write({"status": "success", "message": "Quote deleted successfully."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class UpdateQuoteSettingsHandler(tornado.web.RequestHandler):
    def post(self):
        folder = self.get_argument("folder")
        key_to_change = self.get_argument("key")
        new_value = self.get_argument("value")

        file_path = os.path.join(folder, "data.json")

        try:
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as file:
                    data = json.load(file)

                data["settings"][key_to_change] = new_value

                with open(file_path, "w", encoding="utf-8") as file:
                    json.dump(data, file, indent=4)

                signal_clients_for_changes(client_to_ignore=self.request.remote_ip, changed_files=["reload_saved_quotes"])

                CustomPrint.print(
                    f"INFO - {self.request.remote_ip} changed quote setting '{key_to_change}' to '{new_value}': {folder}",
                    connected_clients=connected_clients,
                )

                self.write({"status": "success", "message": "Quote settings updated successfully."})
            else:
                self.set_status(404)
                self.write({"status": "error", "message": "File not found."})
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})


class QRCodePageHandler(tornado.web.RequestHandler):
    def get(self):
        sheets_inventory = SheetsInventory(None)
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
        paint_inventory = PaintInventory(components_inventory)
        laser_cut_inventory = LaserCutInventory(paint_inventory)
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        data: dict[str, dict[str, str]] = dict({"Components Inventory": {}})
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
        components_inventory = ComponentsInventory()
        paint_inventory = PaintInventory(components_inventory)
        laser_cut_inventory = LaserCutInventory(paint_inventory)
        sheet_settings = SheetSettings()
        sheets_inventory = SheetsInventory(sheet_settings)
        if inventory_type == "components_inventory":
            data = [{"part_number": component.part_number} | component.to_dict() for component in components_inventory.get_components_by_category(category)]
        elif inventory_type == "laser_cut_inventory":
            data = [{"name": laser_cut_part.name} | laser_cut_part.to_dict() for laser_cut_part in laser_cut_inventory.get_laser_cut_parts_by_category(category)]
        elif inventory_type == "paint_inventory":
            if category == "primer":
                data = [{"name": primer.name} | primer.to_dict() for primer in paint_inventory.primers]
            elif category == "paint":
                data = [{"name": paint.name} | paint.to_dict() for paint in paint_inventory.paints]
            elif category == "powder":
                data = [{"name": powder.name} | powder.to_dict() for powder in paint_inventory.powders]
        elif inventory_type == "sheet_settings":
            if category == "price_per_pound":
                data = [{material: sheet_settings.get_price_per_pound(material) for material in sheet_settings.get_materials()}]
        elif inventory_type == "sheets_inventory":
            data = [{"name": sheet.get_name()} | sheet.to_dict() for sheet in sheets_inventory.get_sheets_by_category(category)]
        template = env.get_template("inventory_table.html")
        rendered_template = template.render(inventory_type=inventory_type.replace("_", " ").title(), category=category, data=data, headers=data[0].keys() if data else [])
        self.write(rendered_template)


def signal_clients_for_changes(client_to_ignore, changed_files: list[str]) -> None:
    CustomPrint.print(
        f"INFO - Signaling {len(connected_clients)} clients",
        connected_clients=connected_clients,
    )
    for client in connected_clients:
        if client.request.remote_ip == client_to_ignore:
            CustomPrint.print(
                f"INFO - Ignoring {client.request.remote_ip} since it sent {changed_files}",
                connected_clients=connected_clients,
            )
            continue
        if client.ws_connection and client.ws_connection.stream.socket:
            message = json.dumps({"action": "download", "files": changed_files})
            client.write_message(message)
            CustomPrint.print(
                f"INFO - Signaling {client.request.remote_ip} to download {changed_files}",
                connected_clients=connected_clients,
            )


def hourly_backup_inventory_files():
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Hourly Backup - {datetime.now().strftime('%I %p')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Hourly backup complete", connected_clients=connected_clients)


def daily_backup_inventory_files():
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Daily Backup - {datetime.now().strftime('%d %B')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Daily backup complete", connected_clients=connected_clients)


def weekly_backup_inventory_files():
    files_to_backup = os.listdir(f"{os.path.dirname(os.path.realpath(__file__))}/data")
    path_to_zip_file: str = f"{os.path.dirname(os.path.realpath(__file__))}/backups/Weekly Backup - {datetime.now().strftime('%W')}.zip"
    zip_files(path_to_zip_file, files_to_backup)
    CustomPrint.print("INFO - Weekly backup complete", connected_clients=connected_clients)


def zip_files(path_to_zip_file: str, files_to_backup: list[str]):
    file = zipfile.ZipFile(path_to_zip_file, mode="w")
    for file_path in files_to_backup:
        file.write(
            f"{os.path.dirname(os.path.realpath(__file__))}/data/{file_path}",
            file_path,
            compress_type=zipfile.ZIP_DEFLATED,
        )
    file.close()


def schedule_thread():
    while True:
        schedule.run_pending()
        time.sleep(5)


if __name__ == "__main__":
    coloredlogs.install(level="INFO")  # Enable colored logs
    sys.stdout = StringIO()

    schedule.every().monday.at("04:00").do(partial(generate_sheet_report, connected_clients))
    schedule.every().hour.do(hourly_backup_inventory_files)
    schedule.every().day.at("04:00").do(daily_backup_inventory_files)
    schedule.every().week.do(weekly_backup_inventory_files)

    thread = threading.Thread(target=schedule_thread)
    thread.start()

    app = tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/server_log", ServerLogsHandler),
            (r"/logs", LogsHandler),
            (r"/fetch_log", LogContentHandler),
            (r"/delete_log", LogDeleteHandler),
            (r"/file/(.*)", FileReceiveHandler),
            (r"/command", CommandHandler),
            (r"/upload", FileUploadHandler),
            (r"/workspace_upload", WorkspaceFileUploader),
            (r"/workspace_get_file/(.*)", WorkspaceFileHandler),
            (r"/ws", FileSenderHandler),
            (r"/image/(.*)", ImageHandler),
            (r"/images/(.*)", ImageHandler),
            (r"/set_order_number/(\d+)", SetOrderNumberHandler),
            (r"/get_order_number", GetOrderNumberHandler),
            (r"/sheets_in_inventory/(.*)", SheetQuantityHandler),
            (r"/sheet_qr_codes", QRCodePageHandler),
            (r"/add_cutoff_sheet", AddCutoffSheetHandler),
            (r"/delete_cutoff_sheet", DeleteCutoffSheetHandler),
            (r"/send_error_report", SendErrorReportHandler),
            (r"/get_previous_quotes", GetPreviousQuotesHandler),
            (r"/get_saved_quotes", GetSavedQuotesHandler),
            (r"/get_jobs", GetJobsHandler),
            (r"/upload_job", UploadJobHandler),
            (r"/download_job/(.*)", DownloadJobHandler),
            (r"/load_job/(.*)", LoadJobHandler),
            (r"/upload_quote", UploadQuoteHandler),
            (r"/update_quote_settings", UpdateQuoteSettingsHandler),
            (r"/download_quote/(.*)", DownloadQuoteHandler),
            (r"/load_quote/(.*)", LoadQuoteHandler),
            (r"/delete_quote/(.*)", DeleteQuoteHandler),
            (r"/send_email", SendEmailHandler),
            (r"/inventory", InventoryHandler),
            (r"/inventory/(.*)/(.*)", InventoryTablesHandler),
        ]
    )
    # executor = concurrent.futures.ThreadPoolExecutor(max_workers=10)
    # app.executor = executor
    app.listen(80)
    CustomPrint.print("INFO - Invigo server started")
    tornado.ioloop.IOLoop.current().start()
