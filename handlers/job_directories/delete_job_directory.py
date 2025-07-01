import os

from config.environments import Environment
from handlers.base import BaseHandler


class DeleteJobDirectoryHandler(BaseHandler):
    def post(self, folder_name: str):  # saved_jobs/[PATH]/[JOB_NAME]
        folder_name = os.path.join(Environment.DATA_PATH, folder_name)

        folder_name = folder_name.replace("\\", "/")
        json_file_path = os.path.join(folder_name, "data.json")
        html_file_path = os.path.join(folder_name, "page.html")

        try:
            self.delete_data(json_file_path, folder_name, html_file_path)
        except Exception as e:
            self.set_status(500)
            self.write({"status": "error", "message": str(e)})

    def delete_data(self, json_file_path, folder_name, html_file_path):
        if os.path.exists(json_file_path):
            os.remove(json_file_path)
        else:
            raise FileNotFoundError(f"No JSON file found for {folder_name}.")

        if os.path.exists(html_file_path):
            os.remove(html_file_path)

        if not os.listdir(folder_name):
            os.rmdir(folder_name)

        self.signal_clients_for_changes(
            self.get_client_name_from_header(),
            ["reload_saved_jobs"],
        )

        self.write({"status": "success", "message": "Quote deleted successfully."})
        self.job_directory_cache.invalidate_cache()
