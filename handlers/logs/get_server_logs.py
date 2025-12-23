from handlers.base import BaseHandler
import os
import json
import re
from config.environments import Environment


class GetServerLogsHandler(BaseHandler):

    def ms_to_color(self, ms: float, min_ms=0.0, max_ms=3000) -> str:
        """
        Map ms value to a color from green to red.
        """
        # Clamp between min and max
        clamped = max(min(ms, max_ms), min_ms)
        ratio = (clamped - min_ms) / (max_ms - min_ms)

        # Convert to RGB gradient from green to red
        red = int(255 * ratio)
        green = int(255 * (1 - ratio))
        return f"rgb({red},{green},0)"

    def highlight_ms_times(self, logs: str) -> str:
        def replacer(match):
            ms_value = float(match.group(1))
            color = self.ms_to_color(ms_value)
            return f'<span style="color: {color}; font-weight: bold;">{ms_value:.2f}ms</span>'

        return re.sub(r"(\d+\.\d+)ms", replacer, logs)

    def get_logs(self) -> list[str]:
        # Load users
        users_path = os.path.join(Environment.DATA_PATH, "users.json")
        with open(users_path, "r", encoding="utf-8") as f:
            users = json.load(f)

        # Load log file
        with open(f"{Environment.DATA_PATH}/server.log", "r", encoding="utf-8") as f:
            logs = f.read()

        # Replace IPs with client names
        for client_name, client_data in users.items():
            logs = logs.replace(client_data["ip"], client_name)

        # Highlight status codes
        logs = re.sub(
            r"\b200\b",
            r'<span style="color: green; font-weight: bold;">200</span>',
            logs,
        )
        logs = re.sub(r"\b101\b", r'<span style="color: blue;">101</span>', logs)
        logs = re.sub(r"\b404\b", r'<span style="color: red;">404</span>', logs)
        logs = re.sub(r"\b400\b", r'<span style="color: red;">400</span>', logs)
        logs = re.sub(r"\b500\b", r'<span style="color: red;">500</span>', logs)
        logs = re.sub(r"\bwarning\b", r'<span style="color: yellow;">warning</span>', logs)
        logs = re.sub(r"\bWARNING\b", r'<span style="color: yellow;">WARNING</span>', logs)
        logs = re.sub(r"\berror\b", r'<span style="color: red;">error</span>', logs)
        logs = re.sub(r"\bERROR\b", r'<span style="color: red;">ERROR</span>', logs)

        # Highlight method types
        logs = re.sub(r"\bGET\b", r'<span style="color: orange;">GET</span>', logs)
        logs = re.sub(r"\bPOST\b", r'<span style="color: purple;">POST</span>', logs)
        logs = self.highlight_ms_times(logs)

        # Highlight client names (optional)
        for client_name in users.keys():
            logs = logs.replace(
                client_name,
                f'<span style="color: teal; font-weight: bold;">{client_name}</span>',
            )
        return logs.split("\n")

    def get(self):
        logs = self.get_logs()
        self.write({
            "logs": logs
        })