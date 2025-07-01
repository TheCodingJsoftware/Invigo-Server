import asyncio
import logging
import os
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
from utils.database.recut_laser_cut_parts_inventory_db import (
    RecutLaserCutPartsInventoryDB,
)
from utils.database.sheets_inventory_db import SheetsInventoryDB
from utils.database.workorders_db import WorkordersDB
from utils.database.workspace_db import WorkspaceDB
from utils.inventory.nest import Nest
from utils.workspace.workorder import Workorder
from utils.workspace.workspace import Workspace


def urlencode_path_segment(value: str) -> str:
    return urllib.parse.quote(value, safe="")


loader = jinja2.FileSystemLoader("public/html")
env = jinja2.Environment(loader=loader)
env.filters["urlencode_path"] = urlencode_path_segment

executor = ThreadPoolExecutor(
    max_workers=4, thread_name_prefix="file_directory_gatherer"
)


class BaseHandler(RequestHandler):
    jobs_db = JobsDB()
    workspace_db = WorkspaceDB()
    workorders_db = WorkordersDB()
    coatings_inventory_db = CoatingsInventoryDB()
    components_inventory_db = ComponentsInventoryDB()
    laser_cut_parts_inventory_db = LaserCutPartsInventoryDB()
    recut_laser_cut_parts_inventory_db = RecutLaserCutPartsInventoryDB()
    sheets_inventory_db = SheetsInventoryDB()
    job_directory_cache = JobDirectoryCache()

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
                data: dict[str, dict[str, str | bool]] = msgspec.json.decode(
                    file.read()
                )
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
                data: dict[str, dict[str, str | bool]] = msgspec.json.decode(
                    file.read()
                )
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
        clients = (
            variables.software_connected_clients
            if client_type == "software"
            else variables.website_connected_clients
        )

        logging.info(
            f"Signaling {len(clients)} {client_type} clients ({', '.join([client.request.remote_ip for client in clients])})",
        )

        def send_message(client: WebSocketWebsiteHandler, message):
            if (
                client.ws_connection
                and client.ws_connection.stream
                and client.ws_connection.stream.socket
            ):
                client.write_message(message)
                logging.info(
                    f"Signaling {client.request.remote_ip} to download {changed_files}",
                )

        message = msgspec.json.encode({"action": "download", "files": changed_files})

        for client in clients:
            if (
                client_type == "software"
                and getattr(client, "client_name", None) == client_name_to_ignore
            ):
                logging.info(f"Ignoring client {client.client_name}")
                continue

            if (
                client_type == "web"
                and client.request.remote_ip == client_name_to_ignore
            ):
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
                loop.call_soon_threadsafe(
                    IOLoop.current().add_callback, send_message, client, message
                )

    async def update_laser_cut_parts_process(  # TODO: Make compatible with WorkorderDB
        self, nest_or_workorder: Workorder | Nest, workspace: Workspace
    ):
        if isinstance(nest_or_workorder, Workorder):
            nests_to_update = nest_or_workorder.nests
        elif isinstance(nest_or_workorder, Nest):
            nests_to_update = [nest_or_workorder]

        if workspace_part_groups := workspace.get_grouped_laser_cut_parts(
            workspace.get_all_laser_cut_parts_with_similar_tag("picking")
        ):
            for nest in nests_to_update:
                for workspace_part_group in workspace_part_groups:
                    for nested_laser_cut_part in nest.laser_cut_parts:
                        if (
                            workspace_part_group.base_part.name
                            == nested_laser_cut_part.name
                        ):
                            workspace_part_group.move_to_next_process(
                                nest.sheet_count
                                * nested_laser_cut_part.quantity_in_nest
                            )
                            break
