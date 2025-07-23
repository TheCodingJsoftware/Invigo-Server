import asyncio
import logging
import os
import traceback
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

import jinja2
import msgspec
from tornado.ioloop import IOLoop
from tornado.web import RequestHandler

import config.variables as variables
from config.environments import Environment
from handlers.websocket.website import WebSocketWebsiteHandler
from utils.cache.job_directory_cache import JobDirectoryCache
from utils.database.coatings_inventory_db import CoatingsInventoryDB
from utils.database.components_inventory_db import ComponentsInventoryDB
from utils.database.jobs_db import JobsDB
from utils.database.laser_cut_parts_inventory_db import LaserCutPartsInventoryDB
from utils.database.purchase_orders_db import PurchaseOrdersDB
from utils.database.recut_laser_cut_parts_inventory_db import (
    RecutLaserCutPartsInventoryDB,
)
from utils.database.roles_db import RolesDB
from utils.database.sheets_inventory_db import SheetsInventoryDB
from utils.database.shipping_address_db import ShippingAddressesDB
from utils.database.users_db import UsersDB
from utils.database.vendors_db import VendorsDB
from utils.database.workorders_db import WorkordersDB
from utils.database.workspace_db import WorkspaceDB


def urlencode_path_segment(value: str) -> str:
    return urllib.parse.quote(value, safe="")


loader = jinja2.FileSystemLoader("public/html")
env = jinja2.Environment(loader=loader)
env.filters["urlencode_path"] = urlencode_path_segment

executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="file_directory_gatherer")


class BaseHandler(RequestHandler):
    jobs_db = JobsDB()
    workspace_db = WorkspaceDB()
    workorders_db = WorkordersDB()
    coatings_inventory_db = CoatingsInventoryDB()
    components_inventory_db = ComponentsInventoryDB()
    laser_cut_parts_inventory_db = LaserCutPartsInventoryDB()
    recut_laser_cut_parts_inventory_db: RecutLaserCutPartsInventoryDB
    sheets_inventory_db = SheetsInventoryDB()
    job_directory_cache = JobDirectoryCache()
    purchase_orders_db = PurchaseOrdersDB()
    vendors_db = VendorsDB()
    shipping_addresses_db = ShippingAddressesDB()
    users_db = UsersDB()
    roles_db = RolesDB()

    def write_error(self, status_code: int, **kwargs):
        if exc_info := kwargs.get("exc_info"):
            tb_str = "".join(traceback.format_exception(*exc_info))
            logging.error(f"[{self.__class__.__name__}] Exception in handler:\n{tb_str}")
        else:
            logging.error(f"[{self.__class__.__name__}] Unknown error with status code {status_code}")

        self.set_header("Content-Type", "application/json")
        self.finish({"error": f"Server error (status: {status_code})"})

    def get_template(self, template_name: str):
        return env.get_template(template_name)

    def render_template(self, template_name: str, **kwargs):
        template = self.get_template(template_name)
        rendered_template = template.render(**kwargs)
        self.set_header("Cache-Control", "max-age=3600")
        self.set_header("Content-Type", "text/html")
        self.write(rendered_template)

    def get_client_name(self, ip: str) -> str | None:
        file_path = os.path.join(Environment.DATA_PATH, "users.json")
        name = None

        try:
            with open(file_path, "rb") as file:
                data: dict[str, dict[str, str | bool]] = msgspec.json.decode(file.read())
            for client_name, client_data in data.items():
                if client_data["ip"] == ip:
                    name = client_name
                    break
        except Exception as e:
            logging.error(f"Error getting client name: {e}")
        return name

    def is_client_trusted(self, ip: str) -> bool:
        file_path = os.path.join(Environment.DATA_PATH, "users.json")
        trusted = False
        try:
            with open(file_path, "rb") as file:
                data: dict[str, dict[str, str | bool]] = msgspec.json.decode(file.read())
                for client_name, client_data in data.items():
                    if client_data["ip"] == ip:
                        trusted = client_data["trusted"]
                        break
        except Exception as e:
            logging.error(f"Error getting client trusted status: {e}")
        return trusted

    def get_client_name_from_header(self) -> str | None:
        return self.request.headers.get("X-Client-Name")

    def get_client_address_from_header(self) -> str | None:
        return self.request.headers.get("X-Client-Address")

    def signal_clients_for_changes(
        self,
        client_name_to_ignore,
        changed_files: list[str],
        client_type: Literal["software", "web"] = "software",
    ) -> None:
        clients = variables.software_connected_clients if client_type == "software" else variables.website_connected_clients

        logging.info(
            f"Signaling {len(clients)} {client_type} clients ({', '.join([client.request.remote_ip for client in clients])})",
        )

        def send_message(client: WebSocketWebsiteHandler, message):
            if client.ws_connection and client.ws_connection.stream and client.ws_connection.stream.socket:
                client.write_message(message)
                logging.info(
                    f"Signaling {client.request.remote_ip} to download {changed_files}",
                )

        message = msgspec.json.encode({"action": "download", "files": changed_files})

        for client in clients:
            if client_type == "software" and getattr(client, "client_name", None) == client_name_to_ignore:
                logging.info(f"Ignoring client {client.client_name}")
                continue

            if client_type == "web" and client.request.remote_ip == client_name_to_ignore:
                logging.info(
                    f"Ignoring {client.request.remote_ip} since it sent {changed_files}",
                )
                continue

            try:
                # Check if we're inside the Tornado IOLoop
                IOLoop.current().add_callback(send_message, client, message)
            except RuntimeError:
                # We're outside the IOLoop, so we need to run the message sending inside it
                loop = asyncio.get_event_loop()
                loop.call_soon_threadsafe(IOLoop.current().add_callback, send_message, client, message)
