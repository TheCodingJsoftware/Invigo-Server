import json
from contextlib import suppress
from datetime import datetime, timezone

from handlers.base import BaseHandler

JSON_FIELDS = {
    "inventory_data",
    "meta_data",
    "prices",
    "paint_data",
    "primer_data",
    "powder_data",
    "workspace_data",
}


def decode_json_fields(row: dict) -> dict:
    result = dict(row)

    for key in JSON_FIELDS:
        value = result.get(key)
        if isinstance(value, str):
            with suppress(json.JSONDecodeError):
                result[key] = json.loads(value)

    return result


def serialize(obj):
    if isinstance(obj, datetime):
        return obj.astimezone(timezone.utc).isoformat()
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize(v) for v in obj]
    return obj


def apply_part_timeline(part: dict, job_part_timeline: dict) -> None:
    """
    Mutates part in-place.
    Adds:
      - current_flowtag
      - is_completed
      - is_overdue
      - part_timeline (entry for current flowtag)
    """

    flowtags = part.get("flowtag") or []
    flowtag_index = part.get("flowtag_index")

    # ---- current_flowtag ----
    current_flowtag = flowtags[flowtag_index] if isinstance(flowtag_index, int) and 0 <= flowtag_index < len(flowtags) else None
    part["current_flowtag"] = current_flowtag

    # ---- is_completed ----
    is_completed = flowtag_index is not None and flowtag_index >= len(flowtags)
    part["is_completed"] = is_completed

    # ---- part_timeline ----
    timeline_entry = job_part_timeline.get(current_flowtag) if current_flowtag else None
    part["part_timeline"] = timeline_entry

    # ---- is_overdue ----
    is_overdue = False
    if timeline_entry and not is_completed:
        end_date = timeline_entry.get("ending_date")
        if end_date:
            try:
                end_dt = end_date if isinstance(end_date, datetime) else datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                is_overdue = end_dt < datetime.now(timezone.utc)
            except Exception:
                pass

    part["is_overdue"] = is_overdue


class WorkspacePartHandler(BaseHandler):
    async def get(self, job_id: str, part_name: str):
        if not job_id:
            self.redirect(f"/message?msg=Job+ID+{job_id}+not+found.&type=error")
            return

        job_data = await self.workspace_db.get_job_by_id(int(job_id))
        parts_data = await self.workspace_db.get_parts_by_job(int(job_id))

        if not parts_data:
            self.redirect(f"/message?msg=No+parts+found+for+Job+ID+{job_id}.&type=error")
            return

        part_data = next((p for p in parts_data if p.get("name") == part_name), None)

        if not part_data:
            self.redirect(f"/message?msg=Part+{part_name}+not+found+for+Job+ID+{job_id}.&type=error")
            return

        part_data = decode_json_fields(part_data)
        apply_part_timeline(part_data, job_data.get("job_data", {}).get("flowtag_timeline", {}))
        part_data = serialize(part_data)

        self.render_template(
            "workspace_part_page.html",
            job_id=job_id,
            part_name=part_name,
            part_data=part_data,
        )
