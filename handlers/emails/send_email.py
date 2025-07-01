import logging

from handlers.base import BaseHandler
from utils.send_email import send


class SendEmailHandler(BaseHandler):
    def post(self):
        message = self.get_argument("message", default=None)
        title = self.get_argument("title", default="No Title Provided")
        emails = self.get_argument("emails", default=None)

        email_list = emails.split(",")
        try:
            send(title, message, email_list)

            logging.info(
                f"{self.request.remote_ip} initiated send email: {title}",
            )

            self.write("Email sent successfully.")
        except Exception as e:
            self.set_status(500, "Failed to send email")
            self.finish(f"Error sending email: {str(e)}")
