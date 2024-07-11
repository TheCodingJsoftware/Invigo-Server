from enum import Enum, auto
from typing import TYPE_CHECKING

from natsort import natsorted

from utils.inventory.component import Component
from utils.inventory.laser_cut_part import LaserCutPart
from utils.inventory.nest import Nest
from utils.workspace.assembly import Assembly
from utils.workspace.group import Group
from utils.workspace.job_price_calculator import JobPriceCalculator

if TYPE_CHECKING:
    from utils.workspace.job_manager import JobManager


class JobStatus(Enum):
    PLANNING = auto()
    QUOTING = auto()
    QUOTED = auto()
    TEMPLATE = auto()
    WORKSPACE = auto()
    ARCHIVE = auto()


class JobColor(Enum):
    PLANNING = ("#eabf3e", JobStatus.PLANNING)
    QUOTING = ("#69ea3e", JobStatus.QUOTING)
    QUOTED = ("#69ea3e", JobStatus.QUOTED)
    TEMPLATE = ("#ea693e", JobStatus.TEMPLATE)
    WORKSPACE = ("#3daee9", JobStatus.WORKSPACE)
    ARCHIVE = ("#943eea", JobStatus.ARCHIVE)

    @classmethod
    def get_color(cls, job_status):
        return next((color.value[0] for color in cls if color.value[1] == job_status), None)


class Job:
    def __init__(self, name: str, data: dict, job_manager) -> None:
        self.name: str = name
        self.order_number: float = 0.0
        self.ship_to: str = ""
        self.date_shipped: str = ""
        self.date_expected: str = ""
        self.color: str = "#eabf3e"  # default
        self.groups: list[Group] = []
        self.nests: list[Nest] = []

        self.job_manager: JobManager = job_manager
        self.status = JobStatus.PLANNING

        # NOTE Non serialized variables
        self.grouped_components: list[Component] = []
        self.grouped_laser_cut_parts: list[LaserCutPart] = []
        self.sheet_settings = self.job_manager.sheet_settings
        self.workspace_settings = self.job_manager.workspace_settings
        self.components_inventory = self.job_manager.components_inventory
        self.laser_cut_inventory = self.job_manager.laser_cut_inventory
        self.paint_inventory = self.job_manager.paint_inventory
        self.price_calculator = JobPriceCalculator(self, self.sheet_settings, self.paint_inventory, {})

        self.unsaved_changes = False
        self.downloaded_from_server = False

        self.load_data(data)

        if self.price_calculator.match_item_cogs_to_sheet:
            self.price_calculator.update_laser_cut_parts_to_sheet_price()

    def changes_made(self):
        self.unsaved_changes = True

    def add_group(self, group: Group):
        self.groups.append(group)

    def remove_group(self, group: Group):
        self.groups.remove(group)

    def add_nest(self, nest: Nest):
        self.nests.append(nest)

    def remove_nest(self, nest: Nest):
        self.nests.remove(nest)

    def group_laser_cut_parts(self):
        laser_cut_part_dict: dict[str, LaserCutPart] = {}
        for assembly in self.get_all_assemblies():
            for assembly_laser_cut_part in assembly.laser_cut_parts:
                unit_quantity = assembly_laser_cut_part.quantity
                new_laser_cut_part = LaserCutPart(assembly_laser_cut_part.name, assembly_laser_cut_part.to_dict(), self.laser_cut_inventory)
                new_laser_cut_part.quantity = unit_quantity * assembly.quantity

                if existing_component := laser_cut_part_dict.get(new_laser_cut_part.name):
                    existing_component.quantity += new_laser_cut_part.quantity
                else:
                    laser_cut_part_dict[new_laser_cut_part.name] = new_laser_cut_part
                # This is because we group the data, so all nest reference is lost.
                new_laser_cut_part.quantity_in_nest = None

        self.grouped_laser_cut_parts = laser_cut_part_dict.values()
        self.sort_laser_cut_parts()

    def group_components(self):
        components_dict: dict[str, Component] = {}
        for assembly in self.get_all_assemblies():
            for assembly_component in assembly.components:
                unit_quantity = assembly_component.quantity
                new_component = Component(assembly_component.name, assembly_component.to_dict(), self.components_inventory)
                new_component.quantity = unit_quantity * assembly.quantity
                if existing_component := components_dict.get(new_component.name):
                    existing_component.quantity += new_component.quantity
                else:
                    components_dict[new_component.name] = new_component

        self.grouped_components = components_dict.values()
        self.sort_components()

    def sort_nests(self):
        self.nests = natsorted(self.nests, key=lambda nest: nest.name)

    def sort_laser_cut_parts(self):
        self.grouped_laser_cut_parts = natsorted(self.grouped_laser_cut_parts, key=lambda laser_cut_part: laser_cut_part.name)

    def sort_components(self):
        self.grouped_components = natsorted(self.grouped_components, key=lambda laser_cut_part: laser_cut_part.name)

    def get_group(self, group_name: str) -> Group:
        return next((group for group in self.groups if group.name == group_name), None)

    def get_all_assemblies(self) -> list[Assembly]:
        assemblies: list[Assembly] = []
        for group in self.groups:
            assemblies.extend(group.get_all_assemblies())
        return assemblies

    def get_all_laser_cut_parts(self) -> list[LaserCutPart]:
        """Laser cut parts in all assemblies."""
        laser_cut_parts: list[LaserCutPart] = []
        for assembly in self.get_all_assemblies():
            laser_cut_parts.extend(assembly.laser_cut_parts)
        return laser_cut_parts

    def get_all_nested_laser_cut_parts(self) -> list[LaserCutPart]:
        laser_cut_parts: list[LaserCutPart] = []
        for nest in self.nests:
            laser_cut_parts.extend(nest.laser_cut_parts)
        return laser_cut_parts

    def get_grouped_laser_cut_parts(self) -> list[LaserCutPart]:
        self.group_laser_cut_parts()
        return self.grouped_laser_cut_parts

    def get_all_components(self) -> list[Component]:
        components: list[Component] = []
        for assembly in self.get_all_assemblies():
            components.extend(assembly.components)
        return components

    def get_grouped_components(self) -> list[Component]:
        self.group_components()
        return self.grouped_components

    def load_data(self, data: dict[str, dict[str, object]]):
        if not data:
            return

        job_data = data.get("job_data", {})
        self.order_number = job_data.get("order_number", 0.0)
        self.ship_to = job_data.get("ship_to", "")
        self.date_shipped = job_data.get("date_shipped", "")
        self.date_expected = job_data.get("date_expected", "")
        self.status = JobStatus(int(job_data.get("type", 0)))  # Just in case we cast, trust me
        self.color = JobColor.get_color(self.status)
        self.price_calculator.load_settings(job_data.get("price_settings", {}))

        nests_data = data.get("nests", {})

        self.nests.clear()
        for nest_name, nest_data in nests_data.items():
            nest = Nest(nest_name, nest_data, self.sheet_settings, self.laser_cut_inventory)
            self.add_nest(nest)

        groups_data = data.get("groups", {})

        self.groups.clear()
        for group_name, group_data in groups_data.items():
            group = Group(group_name, group_data, self)
            self.add_group(group)

    def to_dict(self) -> dict:
        self.unsaved_changes = False

        # Updating all parts in the main inventory
        for laser_cut_part in self.get_all_laser_cut_parts():
            if inventory_laser_cut_part := self.laser_cut_inventory.get_laser_cut_part_by_name(laser_cut_part.name):
                inventory_laser_cut_part.bending_files = laser_cut_part.bending_files
                inventory_laser_cut_part.welding_files = laser_cut_part.welding_files
                inventory_laser_cut_part.cnc_milling_files = laser_cut_part.cnc_milling_files
                inventory_laser_cut_part.flow_tag = laser_cut_part.flow_tag

                inventory_laser_cut_part.uses_primer = laser_cut_part.uses_primer
                inventory_laser_cut_part.uses_paint = laser_cut_part.uses_paint
                inventory_laser_cut_part.uses_powder = laser_cut_part.uses_powder

                inventory_laser_cut_part.primer_name = laser_cut_part.primer_name
                inventory_laser_cut_part.paint_name = laser_cut_part.paint_name
                inventory_laser_cut_part.powder_name = laser_cut_part.powder_name

                inventory_laser_cut_part.primer_overspray = laser_cut_part.primer_overspray
                inventory_laser_cut_part.paint_overspray = laser_cut_part.paint_overspray
                inventory_laser_cut_part.powder_transfer_efficiency = laser_cut_part.powder_transfer_efficiency

        self.laser_cut_inventory.save()

        for component in self.get_all_components():
            if inventory_component := self.components_inventory.get_component_by_name(component.name):
                inventory_component.image_path = component.image_path
        self.components_inventory.save()

        return {
            "job_data": {
                "type": self.status.value,
                "order_number": self.order_number,
                "ship_to": self.ship_to,
                "date_shipped": self.date_shipped,
                "date_expected": self.date_expected,
                "color": JobColor.get_color(self.status),
                "price_settings": self.price_calculator.to_dict(),
            },
            "nests": {nest.name: nest.to_dict() for nest in self.nests},
            "groups": {group.name: group.to_dict() for group in self.groups},
        }
