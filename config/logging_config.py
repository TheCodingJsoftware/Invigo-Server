import logging
import sys

from config.environments import Environment


def setup_logging():
    logging.basicConfig(
        filename=f"{Environment.DATA_PATH}/server.log",
        filemode="w",
        format="%(asctime)s [%(levelname)s] [%(filename)s:%(lineno)d - %(funcName)s] - %(message)s",
        datefmt="%B %d, %A %I:%M:%S %p",
        level=logging.INFO,
    )

    def excepthook(exc_type, exc_value, exc_traceback):
        logging.error("Unhandled exception", exc_info=(exc_type, exc_value, exc_traceback))
        sys.__excepthook__(exc_type, exc_value, exc_traceback)

    sys.excepthook = excepthook
