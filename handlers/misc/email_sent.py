from handlers.base import BaseHandler


class EmailSentHandler(BaseHandler):
    async def post(self, purchase_order_id):
        purchase_order_id = int(purchase_order_id)

        ok = await self.purchase_orders_db.mark_purchase_order_email_sent(
            purchase_order_id,
            modified_by=self.current_user or "email-system",
        )

        if not ok:
            self.set_status(404)
            self.write({"error": "Purchase order not found"})
            return

        self.write({"status": "ok"})
