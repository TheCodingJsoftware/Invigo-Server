import json
import os
import shutil
import subprocess
import sys


def create_directory(path):
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Directory created: {path}")
    else:
        print(f"Directory already exists: {path}")


def check_installation(command, name):
    if shutil.which(command):
        try:
            subprocess.check_output([command, '--version'], shell=True)
            print(f"{name} is installed.")
        except subprocess.CalledProcessError:
            print(f"Error: {name} is installed, but an error occurred.")
            sys.exit(1)
    else:
        print(f"Error: {name} is not installed.")
        sys.exit(1)


def install_npm_packages():
    npm_path = shutil.which('npm')
    if npm_path:
        npm_packages = [
            'webpack', 'webpack-dev-server', 'style-loader', 'css-loader', 'copy-webpack-plugin', 'webpack-cli', 'beercss',
            'material-dynamic-colors', 'jquery', 'flatpickr', 'chart.js', 'bootstrap',
            'chartjs-chart-matrix', 'date-fns', 'chartjs-adapter-date-fns', 'dhtmlx-gantt'
        ]
        subprocess.check_call([npm_path, 'install', '--save-dev'] + npm_packages)
    else:
        print("npm is not installed or not in your PATH.")
        sys.exit(1)


def create_virtual_environment():
    if not os.path.exists("venv"):
        subprocess.check_call(['python', '-m', 'venv', 'venv'])
    else:
        print("Virtual environment already exists.")

    activate_script = os.path.join('venv', 'Scripts', 'activate')
    return activate_script


def install_python_requirements():
    subprocess.check_call([os.path.join('venv', 'Scripts', 'pip'), 'install', '-r', 'requirements.txt'])


def build_webpack():
    npx_path = shutil.which('npx')
    if npx_path:
        command = [npx_path, 'webpack', '--config', 'webpack.config.js']
        subprocess.check_call(command)
    else:
        print("npx is not installed or not in your PATH.")
        sys.exit(1)


def setup_email_credentials():
    if not os.path.exists("credentials.json"):
        with open("credentials.json", "w", encoding="utf-8") as f:
            json.dump({"username": "", "password": ""}, f)
        print("Created credentials.json. Please set your email credentials.")
    else:
        print("credentials.json already exists. Please ensure your email credentials are set.")


def main():
    check_installation('python', 'Python')
    check_installation('npm', 'npm')

    root_directories = ["data", "data/workspace", "images", "logs", "backups"]
    quotes_subdirs = ["packing_slips", "quotes", "workorders"]
    jobs_subdirs = ["planning", "template", "quoting", "quoted"]

    for directory in root_directories:
        create_directory(directory)

    jobs_dir = "saved_jobs"
    for subdir in jobs_subdirs:
        create_directory(os.path.join(jobs_dir, subdir))

    workorders_path = "workorders"
    create_directory(workorders_path)

    saved_quotes_path = "saved_quotes"
    create_directory(saved_quotes_path)

    for subdir in quotes_subdirs:
        create_directory(os.path.join(saved_quotes_path, subdir))

    previous_quotes_path = "previous_quotes"
    create_directory(previous_quotes_path)

    for subdir in quotes_subdirs:
        create_directory(os.path.join(previous_quotes_path, subdir))

    if not os.path.exists("order_number.json"):
        with open("order_number.json", "w", encoding="utf-8") as f:
            json.dump({"order_number": 0}, f)

    print("Installing npm packages...")
    install_npm_packages()

    print("Setting up virtual environment and installing Python requirements...")
    activate_script = create_virtual_environment()
    subprocess.check_call([activate_script, '&&', 'pip', 'install', '-r', 'requirements.txt'], shell=True)

    print("Building with webpack...")
    build_webpack()

    setup_email_credentials()

    print("\nSetup complete. Please review the following instructions:\n")
    print("1. Configure your email credentials in 'credentials.json'.")
    print("2. Ensure that 'run.bat' has the correct paths configured.")
    print("3. To autostart, create a shortcut of 'run.bat' and place it in:")
    print("   C:\\Users\\Invigo\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup")
    print("4. For active development, you can run 'npx webpack --watch --config webpack.config.js'.")


if __name__ == "__main__":
    main()
