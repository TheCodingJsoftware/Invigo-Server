from handlers.base import BaseHandler


class InventoryTablesHandler(BaseHandler):
    async def get(self, inventory_type: str, category: str):
        data = []
        if inventory_type == "components_inventory":
            all_components = await self.components_inventory_db.get_components_by_category(category)
            data = [
                {
                    "part_name": component["part_name"],
                    "quantity": component["quantity"],
                    "price": component["price"],
                    "use_exchange_rate": component["use_exchange_rate"],
                    "part_number": component["part_number"],
                }
                for component in all_components
            ]
        elif inventory_type == "laser_cut_parts_inventory":
            all_laser_cut_parts = await self.laser_cut_parts_inventory_db.get_laser_cut_parts_by_category(category)
            data = [
                {
                    "part_name": laser_cut_part["name"],
                    "quantity": laser_cut_part["inventory_data"]["quantity"],
                    "price": round(laser_cut_part["prices"]["price"], 2),
                    "part_dim": laser_cut_part["meta_data"]["part_dim"],
                    "thickness": laser_cut_part["meta_data"]["gauge"],
                    "material": laser_cut_part["meta_data"]["material"],
                    "weight": laser_cut_part["meta_data"]["weight"],
                    "surface_area": laser_cut_part["meta_data"]["surface_area"],
                }
                for laser_cut_part in all_laser_cut_parts
            ]
        elif inventory_type == "coatings_inventory":
            all_paints = await self.coatings_inventory_db.get_paints_by_category(category)
            data = [
                {
                    "name": paint["name"],
                    "color": paint["color"],
                }
                for paint in all_paints
            ]
        elif inventory_type == "sheets_inventory":
            all_sheets = await self.sheets_inventory_db.get_sheets_by_category(category)
            data = [
                {
                    "name": sheet["name"],
                    "quantity": sheet["quantity"],
                    "thickness": sheet["thickness"],
                    "material": sheet["material"],
                }
                for sheet in all_sheets
            ]

        self.set_header("Content-Type", "text/html")
        self.render_template(
            "inventory_table.html",
            inventory_type=inventory_type.replace("_inventory", "").replace("_", "-").title(),
            category=category,
            data=data,
            headers=data[0].keys() if data else [],
        )
