import asyncio
import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler
from utils.inventory.components_inventory import ComponentsInventory
from utils.inventory.laser_cut_inventory import LaserCutInventory
from utils.inventory.laser_cut_part import LaserCutPart
from utils.inventory.nest import Nest
from utils.inventory.paint_inventory import PaintInventory
from utils.inventory.sheets_inventory import SheetsInventory
from utils.inventory.structural_steel_inventory import StructuralSteelInventory
from utils.sheet_settings.sheet_settings import SheetSettings
from utils.structural_steel_settings.structural_steel_settings import (
    StructuralSteelSettings,
)
from utils.workspace.job_manager import JobManager
from utils.workspace.workorder import Workorder
from utils.workspace.workspace import Workspace
from utils.workspace.workspace_settings import WorkspaceSettings


class RecutPartHandler(BaseHandler):
    lock = asyncio.Lock()

    async def post(self, workorder_id: str):
        async with self.lock:
            try:
                self.recut_data = msgspec.json.decode(self.request.body)

                self.components_inventory = ComponentsInventory()
                self.sheet_settings = SheetSettings()
                self.structrual_steel_settings = StructuralSteelSettings()
                self.workspace_settings = WorkspaceSettings()
                self.paint_inventory = PaintInventory(self.components_inventory)
                self.sheets_inventory = SheetsInventory(self.sheet_settings)
                self.laser_cut_inventory = LaserCutInventory(
                    self.paint_inventory, self.workspace_settings
                )
                self.structural_steel_inventory = StructuralSteelInventory(
                    self.structrual_steel_settings, self.workspace_settings
                )
                self.job_manager = JobManager(
                    self.sheet_settings,
                    self.sheets_inventory,
                    self.workspace_settings,
                    self.components_inventory,
                    self.laser_cut_inventory,
                    self.paint_inventory,
                    self.structural_steel_inventory,
                    None,
                )
                self.workspace = Workspace(self.workspace_settings, self.job_manager)

                self.laser_cut_part_to_recut = LaserCutPart(
                    self.recut_data["laser_cut_part"], self.laser_cut_inventory
                )
                self.laser_cut_part_to_recut.recut = True

                self.recut_nest = Nest(
                    self.recut_data["nest"],
                    self.sheet_settings,
                    self.laser_cut_inventory,
                )

                self.recut_quantity = int(self.recut_data["quantity"])

                for workspace_part_group in self.workspace.get_grouped_laser_cut_parts(
                    self.workspace.get_all_laser_cut_parts_with_similar_tag("picking")
                ):
                    if (
                        workspace_part_group.base_part.name
                        == self.laser_cut_part_to_recut.name
                    ):
                        workspace_part_group.mark_as_recut(self.recut_quantity)
                        self.laser_cut_inventory.add_or_update_laser_cut_part(
                            self.laser_cut_part_to_recut,
                            f"Workorder recut: {self.recut_nest.get_name()}",
                        )
                        break

                workorder_data_path = os.path.join(
                    Environment.DATA_PATH, "workorders", workorder_id, "data.json"
                )

                with open(workorder_data_path, "rb") as f:
                    workorder_data: list[dict[str, object]] = msgspec.json.decode(
                        f.read()
                    )

                self.workorder = Workorder(
                    workorder_data, self.sheet_settings, self.laser_cut_inventory
                )

                found_recut_part: bool = False

                for workorder_nest in self.workorder.nests:
                    if workorder_nest.get_name() == self.recut_nest.get_name():
                        for nested_laser_cut_part in workorder_nest.laser_cut_parts:
                            if (
                                nested_laser_cut_part.name
                                == self.laser_cut_part_to_recut.name
                            ):
                                found_recut_part = True
                                nested_laser_cut_part.recut_count += self.recut_quantity
                                nested_laser_cut_part.recut = True
                                break
                    if found_recut_part:
                        break

                with open(workorder_data_path, "wb") as f:
                    f.write(msgspec.json.encode(self.workorder.to_dict()))

                self.workspace.save()
                self.workspace.laser_cut_inventory.save()

                self.signal_clients_for_changes(
                    None,
                    [
                        f"{self.workspace.filename}.json",
                        f"{self.workspace.laser_cut_inventory.filename}.json",
                    ],
                )

                self.write(
                    {
                        "status": "success",
                        "message": "Recut part processed successfully.",
                    }
                )
            except Exception as e:
                self.set_status(500)
                self.write({"status": "error", "message": str(e)})
