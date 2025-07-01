import os

import msgspec

from config.environments import Environment
from handlers.base import BaseHandler
from utils.inventory.components_inventory import ComponentsInventory
from utils.inventory.laser_cut_inventory import LaserCutInventory
from utils.inventory.paint_inventory import PaintInventory
from utils.inventory.sheets_inventory import SheetsInventory
from utils.inventory.structural_steel_inventory import StructuralSteelInventory
from utils.sheet_settings.sheet_settings import SheetSettings
from utils.structural_steel_settings.structural_steel_settings import (
    StructuralSteelSettings,
)
from utils.workspace.job import Job
from utils.workspace.job_manager import JobManager
from utils.workspace.production_plan import ProductionPlan
from utils.workspace.workspace import Workspace
from utils.workspace.workspace_settings import WorkspaceSettings


class AddJobToProductionPlannerHandler(BaseHandler):
    def post(self, job_path: str):
        try:
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
            self.production_plan = ProductionPlan(
                self.workspace_settings, self.job_manager
            )

            job_path = job_path.replace("\\", "/")
            json_file_path = os.path.join(Environment.DATA_PATH, job_path, "data.json")
            with open(json_file_path, "rb") as file:
                data = msgspec.json.decode(file.read())
                job = Job(data, self.job_manager)
                self.production_plan.add_job(job)
                self.production_plan.save()

            self.signal_clients_for_changes(
                None, [f"{self.production_plan.filename}.json"], "web"
            )

            self.write(
                {"status": "success", "message": f"Job added successfully: {job.name}"}
            )
            self.set_status(200)
        except Exception as e:
            self.write({"status": "error", "message": str(e)})
            self.set_status(500)
