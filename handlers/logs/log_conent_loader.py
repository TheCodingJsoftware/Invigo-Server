import os
import re

from config.environments import Environment
from handlers.base import BaseHandler


class LogContentHandler(BaseHandler):
    def post(self):
        log_file_name = self.get_argument("log_file_name")
        log_dir = "logs/"
        log_file_path = os.path.join(Environment.DATA_PATH, log_dir, log_file_name)

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

                self.write("".join(formatted_lines))
        else:
            self.set_status(404)
            self.write("Log file not found")
