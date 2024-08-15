# Invigo-Server

LAN file sharing server that Invigo relies on to keep all clients synced and a website with built in production planning and analytics.

## Setup

1. Run `setup.py` to setup directories.
2. Install node requirements

    ```bash
    npm install webpack copy-webpack-plugin webpack-cli beercss material-dynamic-colors jquery flatpickr chart.js chartjs-chart-matrix date-fns chartjs-adapter-date-fns dhtmlx-gantt --save-dev
    ```

3. Create a virtual environment with `virtualenv`, activate it, and install the following python requirements:

    ```bash
    pip install -r requirements.txt
    ```

4. Build with

    ```bash
    npx webpack --config webpack.config.js
    ```

    OR for active development

    ```bash
    npx webpack --watch --config webpack.config.js
    ```

5. Create a json file called `credentials.json` then set your email credentials in order send emails via SMTP:

    ```json
    {
        "username": "",
        "password": ""
    }
    ```

6. Then make sure `run.bat` has the proper paths configured and just run it.

7. Finally, set up autostart by making a shortcut of `run.bat` and pasting into:

    ```bash
    C:\Users\Invigo\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
    ```
