import json
import logging
import smtplib
from email.mime import multipart, text
from email.mime.application import MIMEApplication

from cryptography.fernet import Fernet

from config.environments import Environment

ERROR_LOG_RECEIVER = "jared@pinelandfarms.ca"

SMTP_HOST = "smtp-mail.outlook.com"
SMTP_PORT = 587


def send(subject: str, body: str, recipients: list[str], attachment: bytes | None = None, attachment_filename: str = "attachment.pdf"):
    with open(f"{Environment.DATA_PATH}/credentials.json", "r", encoding="utf-8") as credentialsFile:
        credentials = json.load(credentialsFile)

    USERNAME: str = credentials["username"]
    PASSWORD = credentials["password"]

    msg = multipart.MIMEMultipart()
    msg["From"] = USERNAME
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(text.MIMEText(body, "html"))

    if attachment:
        part = MIMEApplication(attachment, Name=attachment_filename)
        part["Content-Disposition"] = f'attachment; filename="{attachment_filename}"'
        msg.attach(part)

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(USERNAME, PASSWORD)
    server.sendmail(USERNAME, recipients, msg.as_string())
    logging.info(f'Email sent to "{recipients}"')


def send_purchase_order_email(
    sender_email: str,
    encrypted_password: str,
    recipients: str | list[str],
    subject: str,
    body: str,
    attachment: bytes | None = None,
    attachment_filename: str = "attachment.pdf",
    cc: str | None = None,
):
    try:
        fernet = Fernet(Environment.CONTACT_ENCRYPTION_KEY)
        password = fernet.decrypt(encrypted_password.encode()).decode()
    except Exception as e:
        logging.error(f"Decryption failed: {e}")
        raise RuntimeError("Invalid encryption key or encrypted password.")

    msg = multipart.MIMEMultipart()
    msg["From"] = sender_email
    msg["To"] = recipients
    msg["Subject"] = subject

    if cc:
        msg["Cc"] = cc

    msg.attach(text.MIMEText(body, "html"))

    if attachment:
        part = MIMEApplication(attachment, Name=attachment_filename)
        part["Content-Disposition"] = f'attachment; filename="{attachment_filename}"'
        msg.attach(part)

    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(sender_email, password)
    recipients_list = recipients if isinstance(recipients, list) else [recipients]
    cc_list = [cc] if cc else []
    all_recipients = recipients_list + cc_list

    server.sendmail(sender_email, all_recipients, msg.as_string())

    logging.info(f'Email sent to "{recipients}"')


def send_error_log(body: str):
    if "User: Jared" in body:
        return
    with open(f"{Environment.DATA_PATH}/credentials.json", "r", encoding="utf-8") as credentialsFile:
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
    logging.info(f"Email sent to {ERROR_LOG_RECEIVER}")
