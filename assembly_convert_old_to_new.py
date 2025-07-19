def convert(assembly: dict) -> dict:
    data = assembly.get("assembly_data", {})

    return {
        "id": -1,
        "name": data.get("name", ""),
        "meta_data": {
            "assembly_image": data.get("assembly_image") or "",
            "not_part_of_process": False,
            "quantity": data.get("quantity", 1),
            "color": data.get("color", "#000000"),
        },
        "prices": {
            "cost_for_paint": data.get("cost_for_paint", 0.0),
            "cost_for_primer": data.get("cost_for_primer", 0.0),
            "cost_for_powder_coating": data.get("cost_for_powder_coating", 0.0),
        },
        "paint_data": {
            "uses_paint": data.get("uses_paint", False),
            "paint_name": data.get("paint_name") or "",
            "paint_item": None,
            "paint_overspray": data.get("paint_overspray", 66.67),
        },
        "primer_data": {
            "uses_primer": data.get("uses_primer", False),
            "primer_name": data.get("primer_name") or "",
            "primer_item": None,
            "primer_overspray": data.get("primer_overspray", 66.67),
        },
        "powder_data": {
            "uses_powder": data.get("uses_powder_coating", False),
            "powder_name": data.get("powder_name") or "",
            "powder_item": None,
            "powder_transfer_efficiency": data.get("powder_transfer_efficiency", 66.67),
        },
        "workspace_data": {
            "starting_date": "",
            "ending_date": "",
            "expected_time_to_complete": int(data.get("expected_time_to_complete", 0)),
            "assembly_files": data.get("assembly_files", []),
            "flowtag": data.get("flow_tag", {}),
            "flow_tag_data": data.get("flow_tag_data", {}),
        },
        "laser_cut_parts": assembly.get("laser_cut_parts", []),
        "components": assembly.get("components", []),
        "structural_steel_components": assembly.get("structural_steel_components", []),
        "sub_assemblies": [convert(sub) for sub in assembly.get("sub_assemblies", [])],
    }
