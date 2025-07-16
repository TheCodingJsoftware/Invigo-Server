from datetime import datetime


class CustomPrint:
    @staticmethod
    def print(*args, **kwargs):
        text = " ".join(str(arg) for arg in args)
        formatted_text = f"{str(datetime.now())} - {text}"
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
