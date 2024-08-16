import json
import smtplib
from email.mime import multipart, text

from utils.custom_print import CustomPrint


ERROR_LOG_RECEIVER = "jared@pinelandfarms.ca"

SMTP_HOST = "smtp-mail.outlook.com"
SMTP_PORT = 587


def send(subject: str, body: str, recipients: list[str]):
    with open("credentials.json", "r", encoding="utf-8") as credentialsFile:
        credentials = json.load(credentialsFile)

    USERNAME: str = credentials["username"]
    PASSWORD = credentials["password"]

    msg = multipart.MIMEMultipart()

    msg["From"] = USERNAME
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject

    msg.attach(text.MIMEText(body, "html"))

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, recipients, msg.as_string())
    CustomPrint.print(f'INFO - Email sent to "{recipients}"')


def send_error_log(body: str):
    if "User: Jared" in body:
        CustomPrint.print(
            "INFO - Email aborted because its development server.",

        )

        return
    with open("credentials.json", "r", encoding="utf-8") as credentialsFile:
        credentials = json.load(credentialsFile)
    USERNAME: str = credentials["username"]
    PASSWORD = credentials["password"]
    msg = multipart.MIMEMultipart()

    msg["From"] = USERNAME
    msg["To"] = ERROR_LOG_RECEIVER
    msg["Subject"] = "Invigo - Error Report"
    body = body.replace("\n", "<br>")

    msg.attach(text.MIMEText(body, "html"))

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, ERROR_LOG_RECEIVER, msg.as_string())
    CustomPrint.print(f"INFO - Email sent to {ERROR_LOG_RECEIVER}")
