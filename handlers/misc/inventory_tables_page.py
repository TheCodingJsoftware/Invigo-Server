import contextlib
from handlers.base import BaseHandler


class InventoryTablesHandler(BaseHandler):
    async def get(self, inventory_type: str, category: str):
        data = []
        if inventory_type == "components_inventory":
            all_components = await self.components_inventory_db.get_components_by_category(category)
            for component in all_components:
                with contextlib.suppress(KeyError):
                    data.append({
                        "id": component["id"],
                        "name": component["part_name"],
                        "quantity": component["quantity"],
                        "price": component["price"],
                        "use_exchange_rate": component["use_exchange_rate"],
                        "part_number": component["part_number"],
                    })
        elif inventory_type == "laser_cut_parts_inventory":
            all_laser_cut_parts = await self.laser_cut_parts_inventory_db.get_laser_cut_parts_by_category(category)
            for laser_cut_part in all_laser_cut_parts:
                with contextlib.suppress(KeyError):
                    data.append({
                        "id": laser_cut_part["id"],
                        "name": laser_cut_part["name"],
                        "quantity": laser_cut_part["inventory_data"]["quantity"],
                        "price": round(laser_cut_part["prices"]["price"], 2),
                        "part_dim": laser_cut_part["meta_data"]["part_dim"],
                        "thickness": laser_cut_part["meta_data"]["gauge"],
                        "material": laser_cut_part["meta_data"]["material"],
                        "weight": laser_cut_part["meta_data"]["weight"],
                        "surface_area": laser_cut_part["meta_data"]["surface_area"],
                    })
        elif inventory_type == "coatings_inventory":
            all_paints = await self.coatings_inventory_db.get_paints_by_category(category)
            for paint in all_paints:
                with contextlib.suppress(KeyError):
                    data.append({
                    "id": paint["id"],
                    "name": paint["name"],
                    "color": paint["color"],
                    })
        elif inventory_type == "sheets_inventory":
            all_sheets = await self.sheets_inventory_db.get_sheets_by_category(category)
            for sheet in all_sheets:
                with contextlib.suppress(KeyError):
                    data.append({
                        "id": sheet["id"],
                        "name": sheet["name"],
                        "quantity": sheet["quantity"],
                        "thickness": sheet["thickness"],
                        "material": sheet["material"],
                    })

        self.set_header("Content-Type", "text/html")
        self.render_template(
            "inventory_table.html",
            item_type=inventory_type.replace("s_inventory", "").replace("_", "-").title(),
            category=category,
            data=data,
            headers=data[0].keys() if data else [],
        )
