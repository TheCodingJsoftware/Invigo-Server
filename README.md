# Invigo-Server

LAN file sharing server that Invigo relies on to keep all clients synced and a website with built in production planning and analytics.

## Activity

![Alt](https://repobeats.axiom.co/api/embed/617efbdae674f565e20718a046cdee102574a27e.svg "Repobeats analytics image")

## Setup (Windows)

1. Download and install [Python 3.12](https://www.python.org/downloads/).
2. Download and install [Node.js](https://nodejs.org/en/download/prebuilt-installer).
3. Run `install.bat`.
    - This will create file directories and install python and node requirements.
4. Follow the instructions from `install.bat` when it finished **successfully**.
    - Entering email credentials in `credentials.json` file for email notifcations. This is the email that is used to send emails.
    - Whoever receives the emails is determined by [Invigo](https://github.com/TheCodingJsoftware/Invigo) which is hardcoded.
    - (Optional) Configuring paths to make server auto start with windows.
5. Start server with either:
    - `run.bat`
    - `python server.py`
