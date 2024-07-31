import os
import zipfile
from datetime import datetime

from utils.settings import Settings

settings_file = Settings()


def compress_database(path_to_file: str, on_close: bool = False):
    file_name: str = path_to_file.split("/")[-1]
    if on_close:
        path_to_zip_file: str = f"backups/{settings_file.get_value('inventory_file_name')} - {datetime.now().strftime('%B %d %A %Y %I_%M_%S %p')} - (Auto Generated).zip"
    else:
        path_to_zip_file: str = f"backups/{settings_file.get_value('inventory_file_name')} - {datetime.now().strftime('%B %d %A %Y %I_%M_%S %p')}.zip"
    file = zipfile.ZipFile(path_to_zip_file, mode="w")
    file.write(path_to_file, file_name, compress_type=zipfile.ZIP_DEFLATED)
    file.close()


def compress_folder(foldername, target_dir):
    zipobj = zipfile.ZipFile(f"{foldername}.zip", "w", zipfile.ZIP_DEFLATED)
    rootlen = len(target_dir) + 1
    for base, _, files in os.walk(target_dir):
        for file in files:
            filename: str = os.path.join(base, file)
            zipobj.write(filename, filename[rootlen:])
