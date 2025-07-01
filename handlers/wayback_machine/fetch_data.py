import os
import zipfile
from datetime import datetime

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler


class FetchDataHandler(BaseHandler):
    def get(self):
        inventory_type = self.get_argument("inventory")
        item_name = self.get_argument("item")
        dates, quantities, prices, latest_changes = [], [], [], []
        backups_path = os.path.join(Environment.DATA_PATH, "backups")
        for root, _, files in sorted(os.walk(backups_path), reverse=True):
            for file in sorted(files, reverse=True):
                if file.startswith("Daily Backup") and file.endswith(".zip"):
                    file_path = os.path.join(root, file)
                    modification_time = os.path.getmtime(file_path)
                    date = datetime.fromtimestamp(modification_time)
                    with zipfile.ZipFile(file_path, "r") as zip_ref:
                        with zip_ref.open(f"{inventory_type}.json") as f:
                            inventory = msgspec.json.decode(f.read())
                            try:  # Old inventory format
                                if inventory_type == "components_inventory":
                                    item = inventory["components"][item_name]
                                elif inventory_type == "laser_cut_inventory":
                                    item = inventory["laser_cut_parts"][item_name]
                                elif inventory_type == "sheets_inventory":
                                    item = inventory["sheets"][item_name]
                            except TypeError:  # New inventory format
                                if inventory_type == "components_inventory":
                                    for component_data in inventory["components"]:
                                        if item_name == component_data["part_name"]:
                                            item = component_data
                                elif inventory_type == "laser_cut_inventory":
                                    for laser_cut_part_data in inventory[
                                        "laser_cut_parts"
                                    ]:
                                        if item_name == laser_cut_part_data["name"]:
                                            item = laser_cut_part_data
                                elif inventory_type == "sheets_inventory":
                                    for sheet_data in inventory["sheets"]:
                                        try:
                                            if item_name == sheet_data["name"]:
                                                item = sheet_data
                                        except KeyError:  # Have to generate name
                                            if (
                                                item_name
                                                == f"{sheet_data['thickness']} {sheet_data['material']} {sheet_data['length']:.3f}x{sheet_data['width']:.3f}"
                                            ):
                                                item = sheet_data
                            except (
                                KeyError
                            ):  # The part might not exist yet in older backups
                                continue
                            try:
                                if item:
                                    dates.append(date)
                                    quantities.append(item["quantity"])
                                    try:
                                        prices.append(item["price"])
                                    except KeyError:  # Sheets don't have prices
                                        prices.append(None)
                            except UnboundLocalError:  # Item has not been found
                                continue

        # Combine lists into a list of tuples and sort by date
        combined = list(zip(dates, quantities, prices))
        combined.sort(reverse=True, key=lambda x: x[0])

        # Unpack sorted tuples back into separate lists
        dates, quantities, prices = zip(*combined) if combined else ([], [], [])

        dates = [date.strftime("%Y-%m-%d") for date in dates]

        self.set_header("Content-Type", "application/json")
        self.write({"dates": dates, "quantities": quantities, "prices": prices})
