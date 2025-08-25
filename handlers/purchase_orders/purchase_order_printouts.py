from enum import Enum, auto

from handlers.base import BaseHandler


class AutoNumber(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return count


class PurchaseOrderStatus(AutoNumber):
    PURCHASE_ORDER = auto()
    QUOTE = auto()


class ShippingMethod(AutoNumber):
    HOLD_FOR_PICKUP = auto()
    PICK_UP = auto()
    BRUDER_DELIVERY = auto()
    FED_EX = auto()
    MAIL = auto()
    SEND_BY_COURIER = auto()
    GARDWINE_COLLECT = auto()
    PRE_PAID = auto()
    MOTOPAK_COLLECT = auto()
    MOTOPACK_PRE_PAID = auto()
    GREHOUND_COLLECT = auto()
    ROSENORTH_COLLECT = auto()
    COLLECT = auto()
    WILL_CALL = auto()


class PurchaseOrdersPageHandler(BaseHandler):
    async def get(self):
        all_purchase_orders = await self.purchase_orders_db.get_all_purchase_orders(include_data=True)
        all_purchase_orders = sorted(all_purchase_orders, key=lambda po: po["purchase_order_data"]["meta_data"]["purchase_order_number"], reverse=True)
        all_vendors = await self.vendors_db.get_all_vendors()
        all_vendors = sorted(all_vendors, key=lambda v: v["name"].lower())
        shipping_method_lookup = {method.value: method.name.replace("_", " ").title() for method in ShippingMethod}
        self.render_template(
            "purchase_order_printouts.html",
            all_purchase_orders=all_purchase_orders,
            all_vendors=all_vendors,
            shipping_method_lookup=shipping_method_lookup,
        )
