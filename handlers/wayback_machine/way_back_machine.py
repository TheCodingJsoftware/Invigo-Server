import os
from urllib.parse import unquote

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class WayBackMachineHandler(BaseHandler):
    async def get(self):
        inventory = self.get_argument("inventory")
        item = unquote(self.get_argument("item"))
        if inventory == "components_inventory":
            item_data = await self.components_inventory_db.components_history_db.get_item_history(item)
        print(inventory, item)
        self.render_template("way_back_machine.html")
