import copy
from typing import Union

from utils.inventory.category import Category
from utils.inventory.inventory_item import InventoryItem


class Component(InventoryItem):
    def __init__(self, name: str, data: dict, components_inventory):
        super().__init__(name)
        self.components_inventory = components_inventory
        self.quantity: float = 0.0
        self.unit_quantity: float = 0.0
        self.part_number: str = self.name
        self.part_name: str = ""
        self.price: float = 0.0
        self.use_exchange_rate: bool = False
        self.priority: int = 0
        self.shelf_number: str = ""
        self.notes: str = ""
        self.image_path: str = ""
        self.latest_change_quantity: str = ""
        self.latest_change_price: str = ""
        self.red_quantity_limit: float = 0.0
        self.yellow_quantity_limit: float = 0.0
        self.expected_arrival_time: str = ""
        self.order_pending_quantity: float = 0.0
        self.order_pending_date: str = ""
        self.is_order_pending: bool = False
        self.load_data(data)

    def get_exchange_rate(self) -> float:
        return 1.3

    def get_total_unit_cost(self) -> float:
        exchange_rate = self.get_exchange_rate() if self.use_exchange_rate else 1
        return self.price * self.unit_quantity * exchange_rate

    def get_total_cost_in_stock(self) -> float:
        exchange_rate = self.get_exchange_rate() if self.use_exchange_rate else 1
        return max(self.price * self.quantity * exchange_rate, 0)

    def remove_from_category(self, category: Category):
        super().remove_from_category(category)
        if len(self.categories) == 0:
            self.components_inventory.remove_component(self)

    def load_data(self, data: dict[str, Union[str, int, float, bool]]):
        self.quantity: float = data.get("quantity", 0.0)
        self.unit_quantity: float = data.get("unit_quantity", 0.0)
        self.part_name: str = data.get("part_name", "")
        self.price: float = data.get("price", 0.0)
        self.use_exchange_rate: bool = data.get("use_exchange_rate", False)
        self.priority: int = data.get("priorty", 0)
        self.shelf_number: str = data.get("shelf_number", "")
        self.notes: str = data.get("notes", "")
        self.image_path: str = data.get("image_path", "")
        self.latest_change_quantity: str = data.get("latest_change_quantity", "")
        self.latest_change_price: str = data.get("latest_change_price", "")
        self.red_quantity_limit: float = data.get("red_quantity_limit", 10.0)
        self.yellow_quantity_limit: float = data.get("yellow_quantity_limit", 20.0)
        self.expected_arrival_time: str = data.get("expected_arrival_time", "")
        self.order_pending_quantity: float = data.get("order_pending_quantity", 0.0)
        self.order_pending_date: str = data.get("order_pending_date", "")
        self.is_order_pending: bool = data.get("is_order_pending", False)
        self.categories.clear()
        categories = data.get("categories", [])
        for category in self.components_inventory.get_categories():
            if category.name in categories:
                self.categories.append(category)

    def get_copy(self) -> "Component":
        return copy.deepcopy(self)

    def to_dict(self) -> dict[str, dict]:
        return {
            "quantity": round(self.quantity, 2),
            "unit_quantity": round(self.unit_quantity, 2),
            "latest_change_quantity": self.latest_change_quantity,
            "part_name": self.part_name,
            "price": round(self.price, 2),
            "latest_change_price": self.latest_change_price,
            "use_exchange_rate": self.use_exchange_rate,
            "priorty": self.priority,
            "shelf_number": self.shelf_number,
            "notes": self.notes,
            "image_path": self.image_path,
            "red_quantity_limit": self.red_quantity_limit,
            "yellow_quantity_limit": self.yellow_quantity_limit,
            "expected_arrival_time": self.expected_arrival_time,
            "order_pending_quantity": self.order_pending_quantity,
            "order_pending_date": self.order_pending_date,
            "is_order_pending": self.is_order_pending,
            "categories": [category.name for category in self.categories],
        }
