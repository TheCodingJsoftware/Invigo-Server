# Invigo-Server

LAN Server to handle HTTP requests from Invigo. It also hosts various web pages to interact or view the current inventory state.

## Setup

Run `setup.py` to setup directories.

Create a virtual environment with `virtualenv`, activate it, and install the following requirements:

```
pip install tornado aiotools coloredlogs jinja2 schedule natsort ansi2html markupsafe colorama
```

Set email credentials to send emails via SMTP in `utils/credentials.json`

Then make sure `run.bat` has the proper paths configured and just run it.

Finally, set up autostart by making a shortcut of `run.bat` and pasting into:

```C:\Users\Invigo\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup```