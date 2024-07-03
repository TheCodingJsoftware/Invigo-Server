# Invigo-Server

LAN Server that handles HTTP requests from [Invigo](https://github.com/TheCodingJsoftware/Invigo).

It also hosts various web pages that are designed with [beercss](https://beercss.com):

- `/` is the homepage.
- `/server_log` is the live server log.
- `/logs` is a page where you can view user error logs and past server logs.
- `/inventory` you can view all inventories and their respective categories.
- `/inventory/(.*)/(.*)` is a table that loads all inventory items from the selected inventory and category.
  - Example: `/inventory/components_inventory/BL 25` will load a table with all components in category, BL 25.
- `/sheets_in_inventory/(.*)` is a page where you can view the order-pending status of a sheet and view/edit its quantity.
- `/sheet_qr_codes` is a printer-ready page that generates QR Codes for every sheet in the inventory, scanning the QR Code redirects you to `/sheets_in_inventory/(.*)`.
- `/add_cutoff_sheet` is a page to add and view cutoff sheets.
- `/load_job/(.*)` loads a jobs HTML contents.
- `/load_quote/(.*)` loads a quotes HTML contents.

## Setup

1. Run `setup.py` to setup directories.
2. Create a virtual environment with `virtualenv`, activate it, and install the following requirements:

    ```bash
    pip install tornado aiotools coloredlogs jinja2 schedule natsort ansi2html markupsafe colorama
    ```

3. Create a json file called `credentials.json` then set your email credentials in order send emails via SMTP:

    ```json
    {
        "username": "",
        "password": ""
    }
    ```

4. Then make sure `run.bat` has the proper paths configured and just run it.

5. Finally, set up autostart by making a shortcut of `run.bat` and pasting into:

```bash
C:\Users\Invigo\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```
