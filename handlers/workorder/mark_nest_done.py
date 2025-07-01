import asyncio
import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler
from utils.inventory.components_inventory import ComponentsInventory
from utils.inventory.laser_cut_inventory import LaserCutInventory
from utils.inventory.nest import Nest
from utils.inventory.paint_inventory import PaintInventory
from utils.inventory.sheets_inventory import SheetsInventory
from utils.inventory.structural_steel_inventory import StructuralSteelInventory
from utils.sheet_settings.sheet_settings import SheetSettings
from utils.structural_steel_settings.structural_steel_settings import \
    StructuralSteelSettings
from utils.workspace.job_manager import JobManager
from utils.workspace.workorder import Workorder
from utils.workspace.workspace import Workspace
from utils.workspace.workspace_settings import WorkspaceSettings


class MarkNestDoneHandler(BaseHandler):
    lock = asyncio.Lock()

    async def post(self, workorder_id: str):
        async with self.lock:
            try:
                self.nest_data = msgspec.json.decode(self.request.body)

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

                self.nest = Nest(
                    self.nest_data, self.sheet_settings, self.laser_cut_inventory
                )

                await self.update_laser_cut_parts_process(self.nest, self.workspace)

                workorder_data_path = os.path.join(
                    Environment.DATA_PATH, "workorders", workorder_id, "data.json"
                )

                with open(workorder_data_path, "rb") as f:
                    workorder_data: list[dict] = msgspec.json.decode(f.read())

                self.workorder = Workorder(
                    workorder_data, self.sheet_settings, self.laser_cut_inventory
                )
                new_nests: list[Nest] = []

                for nest in self.workorder.nests:
                    if nest.get_name() != self.nest.get_name():
                        new_nests.append(nest)

                self.workorder.nests = new_nests

                with open(workorder_data_path, "wb") as f:
                    f.write(msgspec.json.encode(self.workorder.to_dict()))

                self.write({"status": "success", "message": "Nest marked as done."})
            except Exception as e:
                self.set_status(500)
                self.write({"status": "error", "message": str(e)})
