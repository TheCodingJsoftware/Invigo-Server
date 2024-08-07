import json
import os


def create_directory(path):
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Directory created: {path}")
    else:
        print(f"Directory already exists: {path}")


def main():
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


if __name__ == "__main__":
    main()
