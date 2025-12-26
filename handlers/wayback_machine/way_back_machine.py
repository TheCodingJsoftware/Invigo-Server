import os
from urllib.parse import unquote

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class WayBackMachineHandler(BaseHandler):
    async def get(self):
        self.render_template("way_back_machine.html")
