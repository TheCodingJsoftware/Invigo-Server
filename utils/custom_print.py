from datetime import datetime

from utils.server_colors import Colors


class CustomPrint:
    @staticmethod
    def print(*args, **kwargs):
        text = " ".join(str(arg) for arg in args)
        formatted_text = f"{Colors.BOLD}{str(datetime.now())} - {text}{Colors.ENDC}"
        formatted_text = formatted_text.replace("INFO", f"{Colors.OKGREEN}INFO{Colors.BOLD}")  # Green
        formatted_text = formatted_text.replace("ERROR", f"{Colors.ERROR}ERROR{Colors.BOLD}")  # Red
        formatted_text = formatted_text.replace("WARN", f"{Colors.WARNING}WARN{Colors.BOLD}")  # Yellow
        print(formatted_text)

        CustomPrint.log_to_file(text)

    @staticmethod
    def log_to_file(message):
        with open(
            f"logs/Server Log - {datetime.now().strftime('%A %B %d %Y')}.log",
            "a",
            encoding="utf-8",
        ) as log_file:
            log_file.write(f"{str(datetime.now())} - {message}\n")
