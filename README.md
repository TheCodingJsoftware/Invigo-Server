# Invigo-Server

LAN Server to handle http requests from Invigo.

## Setup

Run `setup.py` to setup directories.

Create a virtual environment and then install requirements:

```
pip install tornado aiotools coloredlogs jinja2 schedule natsort ansi2html markupsafe colorama
```

Set email credentials to send emails via SMTP in `utils/credentials.json`

Then make sure `run.bat` has the proper paths configured and just run it.
