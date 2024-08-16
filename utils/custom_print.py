import json

from datetime import datetime

import tornado.websocket

from utils.server_colors import Colors

connected_clients: set[tornado.websocket.WebSocketHandler] = set()

def convert_set_to_list(s):
    return list(map(lambda x: x, s))


class CustomPrint:
    @staticmethod
    def print(*args, **kwargs):
        global connected_clients
        try:
            connected_clients = convert_set_to_list(kwargs["connected_clients"])
            connected_clients = [connected_client.request.remote_ip for connected_client in connected_clients]
        except Exception:
            connected_clients = []
        text = " ".join(str(arg) for arg in args)
        formatted_text = f"{Colors.BOLD}{str(datetime.now())} - {text}{Colors.ENDC}"
        formatted_text = formatted_text.replace("INFO", f"{Colors.OKGREEN}INFO{Colors.BOLD}")  # Green
        formatted_text = formatted_text.replace("ERROR", f"{Colors.ERROR}ERROR{Colors.BOLD}")  # Red
        formatted_text = formatted_text.replace("WARN", f"{Colors.WARNING}WARN{Colors.BOLD}")  # Yellow
        print(formatted_text)

        CustomPrint.log_to_file(text)

    @staticmethod
    def log_to_file(message):
        with open(
            f"logs/Server Log - {datetime.now().strftime('%A %B %d %Y')}.log",
            "a",
            encoding="utf-8",
        ) as log_file:
            log_file.write(f"{str(datetime.now())} - {message}\n")


def print_clients():
    with open("users.json", "r", encoding="utf-8") as f:
        users: dict[str, dict[str, str]] = json.load(f)

    all_clients = list(set(list(users.keys()) + connected_clients))
    string = ""
    for i, client in enumerate(all_clients, start=1):
        try:
            if client in all_clients:
                if client in connected_clients:
                    client = f" {i}. {Colors.OKGREEN}{client:<10s} {users[client]["name"]:<10s} Connected{Colors.BOLD}"
                else:
                    client = f" {i}. {Colors.ERROR}{client:<10s} {users[client]["name"]:<10s} Disconnected{Colors.BOLD}"
        except IndexError:
            client = "index error"
        except KeyError:
            if "Connected clients:" not in client:
                client = f" {i}. {Colors.WARNING}{client:<10s} {'UNKNOWN':<10s} Connected{Colors.BOLD}"
        string += f"{client:>10s}\n"
    return string + "\n"
