from handlers.base import BaseHandler


class InventoryHandler(BaseHandler):
    async def get(self):
        components_categories = await self.components_inventory_db.get_categories()
        laser_cut_parts_categories = await self.laser_cut_parts_inventory_db.get_categories()
        sheets_categories = await self.sheets_inventory_db.get_categories()
        coatings_categories = await self.coatings_inventory_db.get_categories()

        self.render_template(
            "inventories.html",
            components_categories=components_categories,
            laser_cut_parts_categories=laser_cut_parts_categories,
            sheets_categories=sheets_categories,
            coatings_categories=coatings_categories,
        )
