import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class WayBackMachineDataHandler(BaseHandler):
    def get(self):
        try:
            components_inventory_path = os.path.join(
                Environment.DATA_PATH, "data", "components_inventory.json"
            )
            laser_cut_inventory_path = os.path.join(
                Environment.DATA_PATH, "data", "laser_cut_inventory.json"
            )
            sheets_inventory_path = os.path.join(
                Environment.DATA_PATH, "data", "sheets_inventory.json"
            )
            structural_steel_inventory_path = os.path.join(
                Environment.DATA_PATH, "data", "structural_steel_inventory.json"
            )
            data: dict[str, list[str]] = {}
            with open(components_inventory_path, "rb") as f:
                data["components_inventory"] = []
                for component_data in msgspec.json.decode(f.read())["components"]:
                    data["components_inventory"].append(component_data["part_name"])
            with open(laser_cut_inventory_path, "rb") as f:
                data["laser_cut_inventory"] = []
                for laser_cut_part_data in msgspec.json.decode(f.read())[
                    "laser_cut_parts"
                ]:
                    data["laser_cut_inventory"].append(laser_cut_part_data["name"])
            with open(sheets_inventory_path, "rb") as f:
                data["sheets_inventory"] = []
                for sheet_data in msgspec.json.decode(f.read())["sheets"]:
                    data["sheets_inventory"].append(sheet_data["name"])
            with open(structural_steel_inventory_path, "rb") as f:
                data["structural_steel_inventory"] = []
                for category, steel_data in msgspec.json.decode(f.read()).items():
                    if category != "categories":
                        for item in steel_data:
                            data["structural_steel_inventory"].append(item["name"])

            self.set_header("Content-Type", "application/json")
            self.write(data)
        except Exception as e:
            self.set_status(500)
            self.write(f"Failed to get inventory data: {str(e)}")
