import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from handlers.base import BaseHandler


class GetSheetOrdersHistoryHandler(BaseHandler):
    async def get(self, item_id):
        try:
            # Await the async function
            orders = await self.sheets_inventory_db.sheets_history_db.get_item_history(item_id=int(item_id))
            history_entries = self.analyze_order_diffs(orders)
            history_entries.sort(key=lambda x: x.get("version", 0), reverse=True)
            self.write({"success": True, "history_entries": history_entries})
        except Exception as e:
            logging.error(f"Failed to get sheet orders history for item {item_id}: {e}")
            self.set_status(500)
            self.write({"success": False, "error": str(e)})

    def format_datetime_with_relative(self, created_at_str: str) -> str:
        # Parse the string timestamp
        dt = datetime.fromisoformat(created_at_str)
        # Ensure timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        delta = now - dt

        # Calculate days difference
        days_ago = delta.days
        if days_ago == 0:
            rel = "today"
        elif days_ago == 1:
            rel = "1 day ago"
        else:
            rel = f"{days_ago} days ago"

        # Format date: Month day, year (Weekday) at HH:MM AM/PM
        formatted = dt.strftime("%B %-d, %Y (%A) at %-I:%M %p")
        return f"{formatted} ({rel})"

    def analyze_order_diffs(self, history_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        order_events = []

        # Sort by version or created_at if needed
        history_entries.sort(key=lambda x: x.get("version", 0))

        for entry in history_entries:
            diff_from = entry.get("diff_from", {})
            diff_to = entry.get("diff_to", {})
            created_at = entry.get("created_at", "")
            version = entry.get("version", 0)
            modified_by = entry.get("modified_by", "")

            from_orders = diff_from.get("orders", [])
            to_orders = diff_to.get("orders", [])

            event_type = None
            details = {}

            if not from_orders and to_orders:
                event_type = "order_added"
                details = {"new_orders": to_orders}
            elif from_orders and not to_orders:
                event_type = "order_removed"
                details = {"removed_orders": from_orders}
            elif from_orders and to_orders and from_orders != to_orders:
                event_type = "order_modified"
                details = {"from": from_orders, "to": to_orders}

            # Also check for quantity change
            quantity_changed = "quantity" in diff_from or "quantity" in diff_to
            quantity_details = {}
            if quantity_changed:
                quantity_details = {
                    "from_quantity": diff_from.get("quantity"),
                    "to_quantity": diff_to.get("quantity"),
                }

            if event_type:
                event = {
                    "version": version,
                    "modified_by": modified_by,
                    "created_at_formatted": self.format_datetime_with_relative(created_at),
                    "created_at": created_at,
                    "event_type": event_type,
                    "details": details,
                    "quantity_change": quantity_details if quantity_changed else None,
                }
                order_events.append(event)

        return order_events
