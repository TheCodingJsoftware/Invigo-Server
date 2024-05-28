import copy
from typing import Union

from utils.inventory.category import Category
from utils.inventory.inventory_item import InventoryItem


class Sheet(InventoryItem):
    def __init__(self, name: str, data: dict, sheets_inventory):
        super().__init__(name)
        self.sheets_inventory = sheets_inventory
        self.quantity: int = 0
        self.length: float = 0.0
        self.width: float = 0.0
        self.thickness: str = ""
        self.material: str = ""
        self.latest_change_quantity: str = ""
        self.red_quantity_limit: int = 4
        self.yellow_quantity_limit: int = 10
        self.expected_arrival_time: str = ""
        self.order_pending_quantity: int = 0
        self.order_pending_date: str = ""
        self.is_order_pending: bool = False
        self.has_sent_warning: bool = False
        self.notes: str = ""
        self.load_data(data)

    def get_sheet_dimension(self) -> str:
        return f"{self.length:.3f}x{self.width:.3f}"

    def get_name(self) -> str:
        return f"{self.thickness} {self.material} {self.get_sheet_dimension()}"

    def get_copy(self) -> "Sheet":
        return copy.deepcopy(self)

    def remove_from_category(self, category: Category):
        super().remove_from_category(category)
        if len(self.categories) == 0:
            self.sheets_inventory.remove_sheet(self)

    def load_data(self, data: dict[str, Union[str, int, float, bool]]):
        self.quantity: int = data.get("quantity", 0)
        self.latest_change_quantity: str = data.get("latest_change_quantity", "")
        self.length: str = data.get("length", 0.0)
        self.width: str = data.get("width", 0.0)
        self.thickness: str = data.get("thickness", "")
        self.material: str = data.get("material", "")
        self.red_quantity_limit: int = data.get("red_quantity_limit", 4)
        self.yellow_quantity_limit: int = data.get("yellow_quantity_limit", 10)
        self.expected_arrival_time: str = data.get("expected_arrival_time", "")
        self.order_pending_quantity: int = data.get("order_pending_quantity", 0)
        self.order_pending_date: str = data.get("order_pending_date", "")
        self.is_order_pending: bool = data.get("is_order_pending", False)
        self.has_sent_warning: bool = data.get("has_sent_warning", False)
        self.notes: str = data.get("notes", "")
        self.categories.clear()
        try:
            categories: list[str] = data.get("categories", [])
            for category in self.sheets_inventory.get_categories():
                if category.name in categories:
                    self.categories.append(category)
        except AttributeError:  # Because these sheets come from threads.load_nests.py
            self.categories = []

    def to_dict(self) -> dict[str, dict]:
        return {
            "quantity": self.quantity,
            "latest_change_quantity": self.latest_change_quantity,
            "red_quantity_limit": self.red_quantity_limit,
            "yellow_quantity_limit": self.yellow_quantity_limit,
            "thickness": self.thickness,
            "material": self.material,
            "width": round(self.width, 3),
            "length": round(self.length, 3),
            "is_order_pending": self.is_order_pending,
            "order_pending_quantity": self.order_pending_quantity,
            "order_pending_date": self.order_pending_date,
            "expected_arrival_time": self.expected_arrival_time,
            "has_sent_warning": self.has_sent_warning,
            "notes": self.notes,
            "categories": [category.name for category in self.categories],
        }
