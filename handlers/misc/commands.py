import logging

import config.variables as variables
from handlers.base import BaseHandler
from utils.sheet_report import generate_sheet_report


class CommandHandler(BaseHandler):
    def post(self):
        command = self.get_argument("command")
        logging.info(
            f'Command "{command}" from {self.request.remote_ip}',
        )
        if command == "send_sheet_report":
            generate_sheet_report(variables.software_connected_clients)
