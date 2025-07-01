from handlers.base import BaseHandler


class DeleteCutoffSheetHandler(BaseHandler):
    async def post(self):
        sheet_id = self.get_argument("sheet_id")

        await self.sheets_inventory_db.delete_sheet(sheet_id)

        self.sheets_inventory_db.cache_manager.invalidate("sheets_category_cutoff")

        self.signal_clients_for_changes(
            None,
            ["/sheets_inventory/get_all"],
        )

        self.redirect("/add_cutoff_sheet")
