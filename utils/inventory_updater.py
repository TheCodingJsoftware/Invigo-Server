import json
import logging
from datetime import datetime

import tornado.websocket
from dotenv import load_dotenv

from utils.inventory.order import Order
from utils.inventory.sheet import Sheet
from utils.inventory.sheets_inventory import SheetsInventory
from utils.sheet_settings import SheetSettings

load_dotenv()

sheet_settings = SheetSettings()
sheets_inventory = SheetsInventory(sheet_settings)


def get_cutoff_sheets() -> list[Sheet]:
    sheets_inventory.load_data()
    return sheets_inventory.get_sheets_by_category("Cutoff")


def add_sheet(
    thickness: str,
    material: str,
    sheet_dim: str,
    sheet_count: float,
    _connected_clients: set[tornado.websocket.WebSocketHandler],
) -> None:
    sheet_name: str = f"{thickness} {material} {sheet_dim}"
    sheets_inventory.load_data()
    length = float(sheet_dim.split("x")[0].strip())
    width = float(sheet_dim.split("x")[1].strip())
    new_sheet = Sheet(
        {
            "quantity": sheet_count,
            "thickness": thickness,
            "material": material,
            "length": length,
            "width": width,
            "categories": ["Cutoff"],
        },
        sheets_inventory,
    )
    new_sheet.latest_change_quantity = f"Item added at {datetime.now().strftime('%B %d %A %Y %I:%M:%S %p')} via server"
    sheets_inventory.add_sheet(new_sheet)
    sheets_inventory.save()
    logging.info(f'Added "{sheet_name}" to Cutoff')
    signal_clients_for_changes(_connected_clients, changed_files=["sheets_inventory.json"])


def remove_cutoff_sheet(sheet_name: str, _connected_clients):
    sheets_inventory.load_data()
    if sheet_to_delete := sheets_inventory.get_sheet_by_name(sheet_name):
        sheets_inventory.remove_sheet(sheet_to_delete)
    sheets_inventory.save()
    logging.info(
        f'Removed "{sheet_name}" from Cutoff',
    )
    signal_clients_for_changes(_connected_clients, changed_files=["sheets_inventory.json"])


def get_sheet_pending_data(sheet_name: str) -> list[Order]:
    sheets_inventory.load_data()
    if sheet := sheets_inventory.get_sheet_by_name(sheet_name):
        return sheet.orders
    return []


def get_sheet_quantity(sheet_name: str) -> float:
    sheets_inventory.load_data()
    if sheet := sheets_inventory.get_sheet_by_name(sheet_name):
        return sheet.quantity
    return 0.0


def set_sheet_quantity(sheet_name: str, new_quantity: float, other_order: Order, clients) -> None:
    sheets_inventory.load_data()
    if sheet := sheets_inventory.get_sheet_by_name(sheet_name):
        sheet_order_used = None
        for order in sheet.orders:
            if order == other_order:
                sheet_order_used = order
                break
        if sheet_order_used:
            old_quantity = sheet.quantity
            quantity_to_add = new_quantity - old_quantity
            remaining_order_quantity = sheet_order_used.quantity - quantity_to_add
            sheet_order_used.quantity = remaining_order_quantity
            if remaining_order_quantity <= 0:
                sheet.remove_order(sheet_order_used)
            sheet.latest_change_quantity = (
                f"Set to {new_quantity} with Add Incoming Order Quantity ({quantity_to_add}) with QR code at {datetime.now().strftime('%B %d %A %Y %I:%M:%S %p')}"
            )
        else:
            sheet.latest_change_quantity = f"Set to {new_quantity} with QR code at {datetime.now().strftime('%B %d %A %Y %I:%M:%S %p')}"
        sheet.quantity = new_quantity
        if new_quantity >= sheet.red_quantity_limit:
            sheet.has_sent_warning = False
    sheets_inventory.save()
    signal_clients_for_changes(clients, changed_files=["sheets_inventory.json"])


def sheet_exists(sheet_name: str) -> bool:
    sheets_inventory.load_data()
    return bool(_ := sheets_inventory.get_sheet_by_name(sheet_name))


def signal_clients_for_changes(connected_clients: set[tornado.websocket.WebSocketHandler], changed_files: list[str]) -> None:
    logging.info(
        f"Signaling {len(connected_clients)} clients",
    )
    for client in connected_clients:
        if client.ws_connection and client.ws_connection.stream.socket:
            message = json.dumps({"action": "download", "files": changed_files})
            client.write_message(message)
            logging.info(
                f"Signaling {client.request.remote_ip} to download {changed_files}",
            )
