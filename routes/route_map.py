import os

from tornado.web import StaticFileHandler

from handlers.auth.client_name import GetClientNameHandler
from handlers.auth.connect import ConnectHandler
from handlers.auth.is_client_trusted import IsClientTrustedHandler
from handlers.coatings_inventory.add_coating import AddCoatingHandler
from handlers.coatings_inventory.delete_coating import DeleteCoatingHandler
from handlers.coatings_inventory.get_all_coatings import GetAllCoatingsHandler
from handlers.coatings_inventory.get_categories import GetCoatingsCategoriesHandler
from handlers.coatings_inventory.get_coating import GetCoatingHandler
from handlers.coatings_inventory.update_coatings import UpdateCoatingsHandler
from handlers.components_inventory.add_component import AddComponentHandler
from handlers.components_inventory.delete_component import DeleteComponentHandler
from handlers.components_inventory.get_all_components import GetAllComponentsHandler
from handlers.components_inventory.get_categories import GetComponentsCategoriesHandler
from handlers.components_inventory.get_component import GetComponentHandler
from handlers.components_inventory.update_component import UpdateComponentHandler
from handlers.components_inventory.update_components import UpdateComponentsHandler
from handlers.emails.send_email import SendEmailHandler
from handlers.emails.send_error_report import SendErrorReportHandler
from handlers.job_directories.delete_job_directory import DeleteJobDirectoryHandler
from handlers.job_directories.get_job_directories_info import (
    GetJobDirectoriesInfoHandler,
)
from handlers.job_directories.get_job_directory import DownloadJobDirectoryHandler
from handlers.job_directories.job_printouts import JobDirectoryPrintoutsHandler
from handlers.job_directories.job_upload import UploadJobDirectoryHandler
from handlers.job_directories.load_job_directory_html_page import (
    LoadJobDirectoryHandler,
)
from handlers.job_directories.update_job_settings import UpdateJobSettingsHandler
from handlers.jobs.delete_job import DeleteJobHandler
from handlers.jobs.get_all_jobs import GetAllJobsHandler
from handlers.jobs.get_job import GetJobHandler
from handlers.jobs.load_job_printout import LoadJobPrintoutHandler
from handlers.jobs.save_job import SaveJobHandler
from handlers.jobs.update_job_setting import UpdateJobSettingHandler
from handlers.laser_cut_inventory.add_laser_cut_part import AddLaserCutPartHandler
from handlers.laser_cut_inventory.add_laser_cut_parts import AddLaserCutPartsHandler
from handlers.laser_cut_inventory.delete_laser_cut_part import (
    DeleteLaserCutPartsHandler,
)
from handlers.laser_cut_inventory.get_all_laser_cut_parts import (
    GetAllLaserCutPartsHandler,
)
from handlers.laser_cut_inventory.get_categories import (
    GetLaserCutPartsCategoriesHandler,
)
from handlers.laser_cut_inventory.get_laser_cut_part import GetLaserCutPartHandler
from handlers.laser_cut_inventory.update_laser_cut_part import UpdateLaserCutPartHandler
from handlers.laser_cut_inventory.update_laser_cut_parts import (
    UpdateLaserCutPartsHandler,
)
from handlers.laser_cut_inventory.upsert_quantities import (
    UpsertQuantitiesHandler,
)
from handlers.logs.delete_log import LogDeleteHandler
from handlers.logs.log_conent_loader import LogContentHandler
from handlers.logs.logs import LogsHandler
from handlers.logs.server_log import ServerLogsHandler
from handlers.misc.commands import CommandHandler
from handlers.misc.inventory_page import InventoryHandler
from handlers.misc.inventory_tables_page import InventoryTablesHandler
from handlers.misc.qr_code_page import QRCodePageHandler
from handlers.order_number.get_order_number import GetOrderNumberHandler
from handlers.order_number.set_order_number import SetOrderNumberHandler
from handlers.page import PageHandler
from handlers.production_planner.file_uploader import ProductionPlannerFileUploadHandler
from handlers.sheets_inventory.add_cut_off_sheet import AddCutoffSheetHandler
from handlers.sheets_inventory.add_sheet import AddSheetHandler
from handlers.sheets_inventory.delete_cut_off_sheet import DeleteCutoffSheetHandler
from handlers.sheets_inventory.delete_sheet import DeleteSheetHandler
from handlers.sheets_inventory.get_all_sheets import GetAllSheetsHandler
from handlers.sheets_inventory.get_categories import GetSheetsCategoriesHandler
from handlers.sheets_inventory.get_sheet import GetSheetHandler
from handlers.sheets_inventory.sheet_quantity import SheetQuantityHandler
from handlers.sheets_inventory.update_sheet import UpdateSheetHandler
from handlers.sheets_inventory.update_sheets import UpdateSheetsHandler
from handlers.static.custom import CustomStaticFileHandler
from handlers.static.data_file_receiver import FileReceiveHandler
from handlers.static.data_file_uploader import FileUploadHandler
from handlers.static.image import ImageHandler
from handlers.static.workspace_file_receiver import WorkspaceFileReceiverHandler
from handlers.static.workspace_file_uploader import WorkspaceFileUploader
from handlers.wayback_machine.fetch_data import FetchDataHandler
from handlers.wayback_machine.get_data import WayBackMachineDataHandler
from handlers.websocket.software import WebSocketSoftwareHandler
from handlers.websocket.website import WebSocketWebsiteHandler
from handlers.workorder.load_workorder_printout import LoadWorkorderPrintoutHandler
from handlers.workorder.mark_nest_done import MarkNestDoneHandler
from handlers.workorder.mark_workorder_done import MarkWorkorderDoneHandler
from handlers.workorder.recut_part import RecutPartHandler
from handlers.workorder.upload_workorder import UploadWorkorderHandler
from handlers.workorder.workorder import WorkorderHandler
from handlers.workspace.add_job import WorkspaceAddJobHandler
from handlers.workspace.bulk_update_entries import WorkspaceBulkUpdateEntriesHandler
from handlers.workspace.delete_job import WorkspaceDeleteJobHandler
from handlers.workspace.get_all_jobs import WorkspaceGetAllJobsHandler
from handlers.workspace.get_all_recut_parts import WorkspaceGetAllRecutPartsHandler
from handlers.workspace.get_entries_by_name import WorkspaceGetEntriesByNamesHandler
from handlers.workspace.get_entry import WorkspaceGetEntryHandler
from handlers.workspace.get_job import WorkspaceGetJobHandler
from handlers.workspace.get_recut_parts_from_job import (
    WorkspaceGetRecutPartsFromJobHandler,
)
from handlers.workspace.update_entry import WorkspaceUpdateEntryHandler
from routes.route import route

page_routes = [
    route(r"/", PageHandler, name="index", template_name="index.html"),
    route(r"/way_back_machine", PageHandler, template_name="way_back_machine.html"),
    route(
        r"/workspace_dashboard",
        PageHandler,
        template_name="workspace_dashboard.html",
    ),
    route(
        r"/workspace_archives_dashboard",
        PageHandler,
        template_name="workspace_archives_dashboard.html",
    ),
    route(
        r"/production_planner",
        PageHandler,
        template_name="production_planner.html",
    ),
    route(
        r"/production_planner_job_printout",
        PageHandler,
        template_name="production_planner_job_printout.html",
    ),
    route(
        r"/workspace_archives",
        PageHandler,
        template_name="workspace_archives.html",
    ),
    route(
        r"/wayback_machine",
        PageHandler,
        template_name="wayback_machine.html",
    ),
    route(r"/logs", LogsHandler),
    route(r"/server_log", ServerLogsHandler),
]

api_routes = [
    route(r"/connect", ConnectHandler),
    route(
        r"/get_client_name",
        GetClientNameHandler,
    ),
    route(
        r"/is_client_trusted",
        IsClientTrustedHandler,
    ),
    route(r"/ws", WebSocketSoftwareHandler),
    route(r"/ws/web", WebSocketWebsiteHandler),
    route(r"/fetch_log", LogContentHandler),
    route(r"/delete_log", LogDeleteHandler),
    route(r"/command", CommandHandler),
    route(r"/file/(.*)", FileReceiveHandler),
    route(r"/upload", FileUploadHandler),
    route(r"/production_planner_upload", ProductionPlannerFileUploadHandler),
    route(r"/workspace_upload", WorkspaceFileUploader),
    route(r"/image/(.*)", ImageHandler),
    route(r"/images/(.*)", ImageHandler),
    route(r"/images/images/(.*)", ImageHandler),
    route(r"/set_order_number/(\d+)", SetOrderNumberHandler),
    route(r"/get_order_number", GetOrderNumberHandler),
    route(r"/way_back_machine_get_data", WayBackMachineDataHandler),
    route(r"/fetch_data", FetchDataHandler),
    route(r"/inventory", InventoryHandler),
    route(r"/inventory/(.*)/(.*)", InventoryTablesHandler),
    route(r"/send_error_report", SendErrorReportHandler),
    route(r"/send_email", SendEmailHandler),
    # Workspace Routes
    route(r"/workspace/get_file/(.*)", WorkspaceFileReceiverHandler),
    route(r"/workspace/add_job", WorkspaceAddJobHandler),
    route(r"/workspace/delete_job/(.*)", WorkspaceDeleteJobHandler),
    route(r"/workspace/get_all_jobs", WorkspaceGetAllJobsHandler),
    route(r"/workspace/get_job/(.*)", WorkspaceGetJobHandler),
    route(r"/workspace/get_entry/(.*)", WorkspaceGetEntryHandler),
    route(r"/workspace/get_all_recut_parts", WorkspaceGetAllRecutPartsHandler),
    route(
        r"/workspace/get_recut_parts_from_job/(.*)",
        WorkspaceGetRecutPartsFromJobHandler,
    ),
    route(
        r"/workspace/get_entries_by_name/(.*)/(.*)",
        WorkspaceGetEntriesByNamesHandler,
    ),
    route(r"/workspace/update_entry/(.*)", WorkspaceUpdateEntryHandler),
    route(r"/workspace/bulk_update_entries", WorkspaceBulkUpdateEntriesHandler),
    # Sheets Invnetory Routes
    route(r"/sheet_qr_codes", QRCodePageHandler),
    route(r"/add_cutoff_sheet", AddCutoffSheetHandler),
    route(r"/delete_cutoff_sheet", DeleteCutoffSheetHandler),
    route(r"/sheets_in_inventory/(.*)", SheetQuantityHandler),
    route(r"/sheets_inventory/add_sheet", AddSheetHandler),
    route(r"/sheets_inventory/delete_sheet/(.*)", DeleteSheetHandler),
    route(r"/sheets_inventory/get_sheet/(.*)", GetSheetHandler),
    route(r"/sheets_inventory/update_sheet/(.*)", UpdateSheetHandler),
    route(r"/sheets_inventory/update_sheets", UpdateSheetsHandler),
    route(r"/sheets_inventory/get_all", GetAllSheetsHandler),
    route(r"/sheets_inventory/get_categories", GetSheetsCategoriesHandler),
    # Components Invnetory Routes
    route(r"/components_inventory/add_component", AddComponentHandler),
    route(r"/components_inventory/delete_component/(.*)", DeleteComponentHandler),
    route(r"/components_inventory/get_component/(.*)", GetComponentHandler),
    route(r"/components_inventory/update_component/(.*)", UpdateComponentHandler),
    route(r"/components_inventory/update_components", UpdateComponentsHandler),
    route(r"/components_inventory/get_all", GetAllComponentsHandler),
    route(r"/components_inventory/get_categories", GetComponentsCategoriesHandler),
    # Laser Cut Parts Invnetory Routes
    route(r"/laser_cut_parts_inventory/add_laser_cut_part", AddLaserCutPartHandler),
    route(r"/laser_cut_parts_inventory/add_laser_cut_parts", AddLaserCutPartsHandler),
    route(
        r"/laser_cut_parts_inventory/upsert_quantities",
        UpsertQuantitiesHandler,
    ),
    route(
        r"/laser_cut_parts_inventory/delete_laser_cut_parts",
        DeleteLaserCutPartsHandler,
    ),
    route(
        r"/laser_cut_parts_inventory/get_laser_cut_part/(.*)", GetLaserCutPartHandler
    ),
    route(
        r"/laser_cut_parts_inventory/update_laser_cut_part/(.*)",
        UpdateLaserCutPartHandler,
    ),
    route(
        r"/laser_cut_parts_inventory/update_laser_cut_parts", UpdateLaserCutPartsHandler
    ),
    route(r"/laser_cut_parts_inventory/get_all", GetAllLaserCutPartsHandler),
    route(
        r"/laser_cut_parts_inventory/get_categories", GetLaserCutPartsCategoriesHandler
    ),
    # Job Routes
    route(r"/jobs/save_job", SaveJobHandler),
    route(r"/jobs/update_job_setting/(.*)", UpdateJobSettingHandler),
    route(r"/jobs/get_all", GetAllJobsHandler),
    route(r"/jobs/get_job/(.*)", GetJobHandler),
    route(r"/jobs/delete_job/(.*)", DeleteJobHandler),
    route(r"/jobs/view", LoadJobPrintoutHandler),
    route(r"/jobs", JobDirectoryPrintoutsHandler),  # This is just a page
    # Paint Inventory Routes
    route(r"/coatings_inventory/add_coating", AddCoatingHandler),
    route(r"/coatings_inventory/delete_coating/(.*)", DeleteCoatingHandler),
    route(r"/coatings_inventory/get_coating/(.*)", GetCoatingHandler),
    route(r"/coatings_inventory/update_coatings", UpdateCoatingsHandler),
    route(r"/coatings_inventory/get_all", GetAllCoatingsHandler),
    route(r"/coatings_inventory/get_categories", GetCoatingsCategoriesHandler),
    # TODO: Workder Routes
    # route(r"/workorders/save_workorder", SaveWorkorderHandler),
    # route(r"/workorders/get_all", GetAllWorkordersHandler),
    # route(r"/workorders/get_workorder/(.*)", GetWorkorderHandler),
    # route(r"/workorders/delete_workorder/(.*)", DeleteWorkorderHandler),
    # route(r"/workorders/printout/(.*)", LoadWorkorderPrintoutHandler),
    # route(
    #     r"/workorders/printouts", WorkorderDirectoryPrintoutsHandler
    # ),  # This is just a page
    # ! Workorder routes OLD DEPRECATED
    route(r"/upload_workorder", UploadWorkorderHandler),
    route(r"/workorder/(.*)", WorkorderHandler),
    route(r"/workorder_printout/(.*)", LoadWorkorderPrintoutHandler),
    route(r"/mark_workorder_done/(.*)", MarkWorkorderDoneHandler),
    route(r"/mark_nest_done/(.*)", MarkNestDoneHandler),
    route(r"/recut_part/(.*)", RecutPartHandler),
]

static_routes = [
    (
        r"/static/(.*)",
        CustomStaticFileHandler,
        {
            "path": os.path.abspath("public/static"),
        },
    ),
    route(r"/public/(.*)", CustomStaticFileHandler, path="public"),
    route(
        r"/(favicon\.ico|manifest\.json|robots\.txt|apple-touch-icon\.png|service-worker\.js|service-worker\.js\.map|workbox-.*\.js|workbox-.*\.js\.map|icon\.png)",
        CustomStaticFileHandler,
        path="public",
    ),
]

routes = page_routes + api_routes + static_routes
