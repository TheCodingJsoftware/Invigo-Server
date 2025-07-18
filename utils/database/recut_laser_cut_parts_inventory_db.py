from utils.database.laser_cut_parts_inventory_db import LaserCutPartsInventoryDB


class RecutLaserCutPartsInventoryDB(LaserCutPartsInventoryDB):
    TABLE_NAME = "recut_laser_cut_parts_inventory"
    ITEM_NAME = "recut_laser_cut_part"
