import logging
import time

import msgspec
from tornado.ioloop import IOLoop

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
from utils.workspace.workspace_settings import WorkspaceSettings


class WorkspaceAddJobHandler(BaseHandler):
    async def post(self):
        try:
            data = msgspec.json.decode(self.request.body)

            self.components_inventory = ComponentsInventory()
            self.sheet_settings = SheetSettings()
            self.structrual_steel_settings = StructuralSteelSettings()
            self.workspace_settings = WorkspaceSettings()
            self.paint_inventory = PaintInventory(self.components_inventory)
            self.sheets_inventory = SheetsInventory(self.sheet_settings)
            self.laser_cut_inventory = LaserCutInventory(self.paint_inventory, self.workspace_settings)
            self.structural_steel_inventory = StructuralSteelInventory(self.structrual_steel_settings, self.workspace_settings)
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
            IOLoop.current().spawn_callback(self._add_job_background, data, self.job_manager)

            self.set_header("Content-Type", "application/json")
            self.write({"status": "processing", "message": "Job queued."})
        except Exception as e:
            self.set_status(400)
            self.write({"error": str(e)})

    async def _add_job_background(self, data, job_manager: JobManager):
        try:
            t0 = time.perf_counter()
            job = Job(data, self.job_manager)
            print(f"Job creation: {time.perf_counter() - t0:.2f}s")
            t1 = time.perf_counter()
            job_id = await self.workspace_db.add_job(job)
            print(f"Job insertion: {time.perf_counter() - t1:.2f}s")

            self.signal_clients_for_changes(
                None,
                [f"workspace/get_job/{job_id}"],
            )
        except Exception as e:
            logging.error(f"Error adding job in background: {e}")
