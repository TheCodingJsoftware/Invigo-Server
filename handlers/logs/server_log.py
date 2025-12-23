import json
import os
import re

from natsort import natsorted
from tornado.websocket import WebSocketHandler

import config.variables as variables
from config.environments import Environment
from handlers.base import BaseHandler


class ServerLogsHandler(BaseHandler):
    def convert_set_to_list(self, s: set[WebSocketHandler]) -> list[WebSocketHandler]:
        return list(map(lambda x: x, s))

    def get_connect_clients_data(self):
        users_path = os.path.join(Environment.DATA_PATH, "users.json")
        with open(users_path, "r", encoding="utf-8") as f:
            user_data = json.load(f)
        user_data_ips = [client_data["ip"] for client_data in user_data.values()]

        software_clients = [client.request.remote_ip for client in self.convert_set_to_list(variables.software_connected_clients)]
        web_clients = [client.request.remote_ip for client in self.convert_set_to_list(variables.website_connected_clients)]

        all_clients = list(set(list(user_data_ips) + software_clients + web_clients))

        table_data = []

        for i, client in enumerate(all_clients, start=1):
            client_name = self.get_client_name(client)
            client_version = user_data.get(client_name, {}).get("latest_version", "Unknown")
            client_last_connected = user_data.get(client_name, {}).get("latest_connection", "Unknown")

            if client in software_clients and client in web_clients:
                status = "Connected via software and web"
            elif client in software_clients:
                status = "Connected via software"
            elif client in web_clients:
                status = "Connected via web"
            else:
                status = "Disconnected"

            table_data.append([i, client, client_name, client_version, client_last_connected, status])

        return table_data

    def get_search_terms(self):
        search_terms = set()
        with open(os.path.join(Environment.DATA_PATH, "users.json"), "r", encoding="utf-8") as file:
            data: dict[str, dict[str, str | bool]] = json.load(file)
            for client_name, client_data in data.items():
                search_terms.add(client_name.lower())
                search_terms.add(client_data["ip"])
        search_terms.add("workspace")
        search_terms.add("laser_cut_parts_inventory")
        search_terms.add("recut")
        search_terms.add("components_inventory")
        search_terms.add("sheets_inventory")
        search_terms.add("paint_inventory")
        search_terms.add("coatings_inventory")
        search_terms.add("purchase_orders")
        search_terms.add("jobs")
        search_terms.add("vendors")
        search_terms.add("/file/")
        search_terms.add("info")
        search_terms.add("warning")
        search_terms.add("error")
        search_terms.add("404")
        search_terms.add("200")
        search_terms.add("304")
        search_terms.add("500")
        search_terms.add("101")
        search_terms.add("GET")
        search_terms.add("POST")

        sorted = natsorted(list(search_terms))

        return list(sorted)

    def get(self):
        self.render_template(
            "server_log.html",
            connected_clients=self.get_connect_clients_data(),
            search_terms=self.get_search_terms(),
        )

    def get_client_name(self, ip: str) -> str:
        try:
            with open(os.path.join(Environment.DATA_PATH, "users.json"), "r", encoding="utf-8") as file:
                data: dict[str, dict[str, str | bool]] = json.load(file)
                for client_name, client_data in data.items():
                    if client_data["ip"] == ip:
                        return client_name
        except Exception as e:
            print(e)
        return "Unknown"
