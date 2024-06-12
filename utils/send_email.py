import json
import smtplib
from email.mime import multipart, text

from utils.custom_print import CustomPrint


SMPT_HOST = "mail.pine.cone"
SMPT_PORT = 587

def send(subject: str, body: str, recipients: list[str], connected_clients):
    with open("credentials.json", "r", encoding="utf-8") as credentialsFile:
        credentials = json.load(credentialsFile)

    USERNAME: str = credentials["username"]
    PASSWORD = credentials["password"]

    msg = multipart.MIMEMultipart()

    msg["From"] = USERNAME
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject

    msg.attach(text.MIMEText(body, "html"))

    server = smtplib.SMTP(SMPT_HOST, SMPT_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, recipients, msg.as_string())
    CustomPrint.print(
        f'INFO - Email sent to "{recipients}"',
        connected_clients=connected_clients,
    )


def send_error_log(body: str, connected_clients):
    with open("credentials.json", "r", encoding="utf-8") as credentialsFile:
        credentials = json.load(credentialsFile)
    USERNAME: str = credentials["username"]
    PASSWORD = credentials["password"]
    msg = multipart.MIMEMultipart()

    msg["From"] = USERNAME
    msg["To"] = "jaredgrozz@gmail.com"
    msg["Subject"] = "Invigo - Error Report"
    body = body.replace("\n", "<br>")

    msg.attach(text.MIMEText(body, "html"))

    server = smtplib.SMTP(SMPT_HOST, SMPT_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, "jaredgrozz@gmail.com", msg.as_string())
    CustomPrint.print(
        "INFO - Email sent to jaredgrozz@gmail.com",
        connected_clients=connected_clients,
    )
