import os

from handlers.auth.client_name import GetClientNameHandler
from handlers.auth.connect import ConnectHandler
from handlers.auth.is_client_trusted import IsClientTrustedHandler
from handlers.auth.login import LoginHandler
from handlers.auth.logout import LogoutHandler
from handlers.auth.protected import ProtectedHandler
from handlers.auth.register_page import RegisterPageHandler
from handlers.auth.roles_page import RolesPageHandler
from handlers.auth.user import UserHandler
from handlers.auth.users_page import UsersPageHandler
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
from handlers.health import HealthHandler
from handlers.history.get_component_orders_history import (
    GetComponentOrdersHistoryHandler,
)
from handlers.history.get_component_price_history import GetComponentPriceHistoryHandler
from handlers.history.get_component_quantity_history import (
    GetComponentQuantityHistoryHandler,
)
from handlers.history.get_laser_cut_part_quantity_history import (
    GetLaserCutPartQuantityHistoryHandler,
)
from handlers.history.get_sheet_orders_history import GetSheetOrdersHistoryHandler
from handlers.history.get_sheet_price_history import GetSheetPriceHistoryHandler
from handlers.history.get_sheet_quantity_histroy import GetSheetQuantityHistoryHandler
from handlers.jobs.delete_job import DeleteJobHandler
from handlers.jobs.get_all_jobs import GetAllJobsHandler
from handlers.jobs.get_job import GetJobHandler
from handlers.jobs.job_printouts import JobsPageHandler
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
from handlers.misc.email_purchase_order import EmailPurchaseOrderHandler
from handlers.misc.email_sent import EmailSentHandler
from handlers.misc.inventory_page import InventoryHandler
from handlers.misc.inventory_tables_page import InventoryTablesHandler
from handlers.misc.message_handler import MessageHandler
from handlers.misc.pdf import GeneratePDFHandler
from handlers.misc.png import GeneratePNGHandler
from handlers.misc.qr_code_page import QRCodePageHandler
from handlers.order_number.get_order_number import GetOrderNumberHandler
from handlers.order_number.set_order_number import SetOrderNumberHandler
from handlers.page import PageHandler
from handlers.ping import PingHandler
from handlers.production_planner.file_uploader import ProductionPlannerFileUploadHandler
from handlers.production_planner.job_timeline_handler import JobTimelineHandler
from handlers.purchase_orders.delete_purchase_order import DeletePurchaseOrderHandler
from handlers.purchase_orders.get_all_purchase_orders import GetAllPurchaseOrdersHandler
from handlers.purchase_orders.get_purchase_order import GetPurchaseOrderHandler
from handlers.purchase_orders.purchase_order_printouts import PurchaseOrdersPageHandler
from handlers.purchase_orders.save_purchase_order import SavePurchaseOrderHandler
from handlers.roles.roles import RoleAPIHandler
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
from handlers.shipping_addresses.delete_shipping_address import (
    DeleteShippingAddressHandler,
)
from handlers.shipping_addresses.get_all_shipping_addresses import (
    GetAllShippingAddressesHandler,
)
from handlers.shipping_addresses.get_shipping_address import GetShippingAddressHandler
from handlers.shipping_addresses.save_shipping_address import SaveShippingAddressHandler
from handlers.static.custom import CustomStaticFileHandler
from handlers.static.data_file_receiver import FileReceiveHandler
from handlers.static.data_file_uploader import FileUploadHandler
from handlers.static.image import ImageHandler
from handlers.static.workspace_file_receiver import WorkspaceFileReceiverHandler
from handlers.static.workspace_file_uploader import WorkspaceFileUploader
from handlers.vendors.delete_vendor import DeleteVendorHandler
from handlers.vendors.get_all_vendors import GetAllVendorsHandler
from handlers.vendors.get_vendor import GetVendorHandler
from handlers.vendors.save_vendor import SaveVendorHandler
from handlers.wayback_machine.fetch_data import FetchDataHandler
from handlers.wayback_machine.get_data import WayBackMachineDataHandler
from handlers.wayback_machine.way_back_machine import WayBackMachineHandler
from handlers.websocket.software import WebSocketSoftwareHandler
from handlers.websocket.website import WebSocketWebsiteHandler
from handlers.websocket.workspace import WebSocketWorkspaceHandler
from handlers.workorder.delete_workorder import DeleteWorkorderHandler
from handlers.workorder.get_all_workorders import GetAllWorkordersHandler
from handlers.workorder.get_workorder import GetWorkorderHandler
from handlers.workorder.mark_complete import WorkorderMarkComplete
from handlers.workorder.save_workorder import SaveWorkorderHandler
from handlers.workorder.workorder_printouts import WorkordersPageHandler
from handlers.workspace.add_job import WorkspaceAddJobHandler
from handlers.workspace.delete_job import WorkspaceDeleteJobHandler
from handlers.workspace.get_all_jobs import WorkspaceGetAllJobsHandler
from handlers.workspace.get_job import WorkspaceGetJobHandler
from handlers.workspace.get_job_data import GetJobDataHandler
from handlers.workspace.get_part_data import GetPartDataHandler
from handlers.workspace.get_parts_by_job import WorkspaceGetPartsByJobHandler
from handlers.workspace.part_view_handler import PartViewDataHandler
from handlers.workspace.update_grouped_laser_cut_parts import (
    WorkspaceUpdateGroupHandler,
)
from handlers.workspace.workspace import WorkspaceHandler
from handlers.workspace.workspace_part_handler import WorkspaceLaserCutPartHandler
from handlers.workspace.workspace_recut_finished_handler import RecutPartFinishedHandler
from handlers.workspace.workspace_recut_handler import RecutPartHandler
from routes.route import route

page_routes = [
    route(r"/", PageHandler, name="index", template_name="index.html"),
    route(r"/ping", PingHandler),
    route(r"/health", HealthHandler),
    route(r"/way_back_machine", WayBackMachineHandler),
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
    route(r"/message", MessageHandler),
    route(r"/server_log", ServerLogsHandler),
    route(r"/jobs", JobsPageHandler),
    route(r"/jobs/view", PageHandler, template_name="job_printout.html"),
    route(r"/workorders", WorkordersPageHandler),
    route(r"/workorders/view", PageHandler, template_name="workorder_printout.html"),
    route(r"/workorders/update", PageHandler, template_name="workorder_update.html"),
    route(r"/purchase_orders", PurchaseOrdersPageHandler),
    route(
        r"/purchase_orders/view",
        PageHandler,
        template_name="purchase_order_printout.html",
    ),
    route(r"/login", PageHandler, template_name="login.html"),
    route(r"/register", RegisterPageHandler),
    route(r"/roles", RolesPageHandler),
    route(r"/users", UsersPageHandler),
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
    route(r"/ws/workspace", WebSocketWorkspaceHandler),
    route(r"/fetch_log", LogContentHandler),
    route(r"/delete_log", LogDeleteHandler),
    route(r"/command", CommandHandler),
    route(r"/file/(.*)", FileReceiveHandler),
    route(r"/upload", FileUploadHandler),
    route(r"/production_planner_upload", ProductionPlannerFileUploadHandler),
    route(r"/workspace/upload", WorkspaceFileUploader),
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
    route(r"/workspace", WorkspaceHandler),
    route(r"/api/workspace/update_group", WorkspaceUpdateGroupHandler),
    route(r"/api/workspace/view/parts", PartViewDataHandler),
    route(r"/api/workspace/get/part", GetPartDataHandler),
    route(r"/api/workspace/get/job/(.*)", GetJobDataHandler),
    route(r"/api/workspace/laser_cut_part", WorkspaceLaserCutPartHandler),
    route(r"/api/workspace/request_recut", RecutPartHandler),
    route(r"/api/workspace/recut_finished", RecutPartFinishedHandler),
    # Production Planner Routes
    route(r"/api/production_planner/job/timeline", JobTimelineHandler),
    route(r"/api/production_planner/job/timeline/(.*)", JobTimelineHandler),
    # OLD Workspace Routes
    route(r"/workspace/get_file/(.*)", WorkspaceFileReceiverHandler),
    route(r"/workspace/add_job", WorkspaceAddJobHandler),
    route(r"/workspace/delete_job/(.*)", WorkspaceDeleteJobHandler),
    route(r"/workspace/get_all_jobs", WorkspaceGetAllJobsHandler),
    route(r"/workspace/get_job/(.*)", WorkspaceGetJobHandler),
    route(r"/workspace/get_parts_by_job/(.*)", WorkspaceGetPartsByJobHandler),
    # route(r"/workspace/get_entry/(.*)", WorkspaceGetEntryHandler),
    # route(r"/workspace/get_all_recut_parts", WorkspaceGetAllRecutPartsHandler),
    # route(
    # r"/workspace/get_recut_parts_from_job/(.*)",
    # WorkspaceGetRecutPartsFromJobHandler,
    # ),
    # route(
    #     r"/workspace/get_entries_by_name/(.*)/(.*)",
    #     WorkspaceGetEntriesByNamesHandler,
    # ),
    # route(r"/workspace/update_entry/(.*)", WorkspaceUpdateEntryHandler),
    # route(r"/workspace/bulk_update_entries", WorkspaceBulkUpdateEntriesHandler),
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
    route(r"/get_order_history/sheet/(.*)", GetSheetOrdersHistoryHandler),
    route(r"/get_quantity_history/sheet/(.*)", GetSheetQuantityHistoryHandler),
    route(r"/get_price_history/sheet/(.*)", GetSheetPriceHistoryHandler),
    # Components Invnetory Routes
    route(r"/components_inventory/add_component", AddComponentHandler),
    route(r"/components_inventory/delete_component/(.*)", DeleteComponentHandler),
    route(r"/components_inventory/get_component/(.*)", GetComponentHandler),
    route(r"/components_inventory/update_component/(.*)", UpdateComponentHandler),
    route(r"/components_inventory/update_components", UpdateComponentsHandler),
    route(r"/components_inventory/get_all", GetAllComponentsHandler),
    route(r"/components_inventory/get_categories", GetComponentsCategoriesHandler),
    route(r"/get_order_history/component/(.*)", GetComponentOrdersHistoryHandler),
    route(r"/get_quantity_history/component/(.*)", GetComponentQuantityHistoryHandler),
    route(r"/get_price_history/component/(.*)", GetComponentPriceHistoryHandler),
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
    route(r"/laser_cut_parts_inventory/get_laser_cut_part/(.*)", GetLaserCutPartHandler),
    route(
        r"/laser_cut_parts_inventory/update_laser_cut_part/(.*)",
        UpdateLaserCutPartHandler,
    ),
    route(r"/laser_cut_parts_inventory/update_laser_cut_parts", UpdateLaserCutPartsHandler),
    route(r"/laser_cut_parts_inventory/get_all", GetAllLaserCutPartsHandler),
    route(r"/laser_cut_parts_inventory/get_categories", GetLaserCutPartsCategoriesHandler),
    route(
        r"/get_quantity_history/laser_cut_part/(.*)",
        GetLaserCutPartQuantityHistoryHandler,
    ),
    # Job Routes
    route(r"/jobs/save", SaveJobHandler),
    route(r"/jobs/update_job_setting/(.*)", UpdateJobSettingHandler),
    route(r"/jobs/delete/(.*)", DeleteJobHandler),
    route(r"/jobs/get_all", GetAllJobsHandler),
    route(r"/jobs/get_job/(.*)", GetJobHandler),
    # Coating (Paint) Inventory Routes
    route(r"/coatings_inventory/add_coating", AddCoatingHandler),
    route(r"/coatings_inventory/delete_coating/(.*)", DeleteCoatingHandler),
    route(r"/coatings_inventory/get_coating/(.*)", GetCoatingHandler),
    route(r"/coatings_inventory/update_coatings", UpdateCoatingsHandler),
    route(r"/coatings_inventory/get_all", GetAllCoatingsHandler),
    route(r"/coatings_inventory/get_categories", GetCoatingsCategoriesHandler),
    # Workder Routes
    route(r"/workorders/save", SaveWorkorderHandler),
    route(r"/workorders/get_all", GetAllWorkordersHandler),
    route(r"/workorders/get/(.*)", GetWorkorderHandler),
    route(r"/workorders/delete/(.*)", DeleteWorkorderHandler),
    route(r"/api/workorder/mark_complete/([0-9]+)", WorkorderMarkComplete),
    # Purchase Orders
    route(r"/purchase_orders/save", SavePurchaseOrderHandler),
    route(r"/purchase_orders/get_all", GetAllPurchaseOrdersHandler),
    route(r"/purchase_orders/delete/(.*)", DeletePurchaseOrderHandler),
    route(r"/purchase_orders/get_purchase_order/(.*)", GetPurchaseOrderHandler),
    # Vendors
    route(r"/vendors/get_all", GetAllVendorsHandler),
    route(r"/vendors/save", SaveVendorHandler),
    route(r"/vendors/delete/(.*)", DeleteVendorHandler),
    route(r"/vendors/get_vendor/(.*)", GetVendorHandler),
    # Shipping Addresses
    route(r"/shipping_addresses/get_all", GetAllShippingAddressesHandler),
    route(r"/shipping_addresses/save", SaveShippingAddressHandler),
    route(r"/shipping_addresses/get_shipping_address/(.*)", GetShippingAddressHandler),
    route(r"/shipping_addresses/delete/(.*)", DeleteShippingAddressHandler),
    # Users
    route(r"/api/logout", LogoutHandler),
    route(r"/api/login", LoginHandler),
    route(r"/api/protected", ProtectedHandler),
    route(r"/api/users", UserHandler),
    route(r"/api/users/([0-9]+)", UserHandler),
    route(r"/api/roles", RoleAPIHandler),
    route(r"/api/generate-pdf", GeneratePDFHandler),
    route(r"/api/generate-png", GeneratePNGHandler),
    route(r"/api/email-purchase-order", EmailPurchaseOrderHandler),
    route(r"/api/email-sent/([0-9]+)", EmailSentHandler),
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
