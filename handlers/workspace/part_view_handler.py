import gzip
import logging
import time
import traceback

import brotli
import msgspec

from handlers.base import BaseHandler


class PartViewDataHandler(BaseHandler):
    async def get(self):
        print("\n--- PartViewDataHandler GET ---")
        t0 = time.perf_counter()

        show_completed = int(self.get_argument("show_completed", "0"))

        tag_str = self.get_argument("tags", "")
        viewable_tags = [tag.strip() for tag in tag_str.split(",") if tag.strip()]
        start_date = self.get_argument("start_date", None)
        end_date = self.get_argument("end_date", None)

        status = 200
        response_bytes = b""
        error_str = ""
        result_len = None

        try:
            data = await self.view_db.get_parts_view(show_completed, viewable_tags, start_date, end_date)
            try:
                result_len = len(data)
            except Exception:
                result_len = None

            # encode json (bytes)
            raw_bytes = msgspec.json.encode(data)

            # detect client supported encodings
            accept_encoding = self.request.headers.get("Accept-Encoding", "")
            if "br" in accept_encoding:
                response_bytes = brotli.compress(raw_bytes)
                self.set_header("Content-Encoding", "br")
            elif "gzip" in accept_encoding:
                response_bytes = gzip.compress(raw_bytes)
                self.set_header("Content-Encoding", "gzip")
            else:
                response_bytes = raw_bytes

            self.set_header("Content-Type", "application/json")
            self.finish(response_bytes)

        except Exception as e:
            status = 500
            error_str = str(e)
            self.set_status(500)
            logging.error(f"Error getting grouped parts view: {e} {traceback.format_exc()}")
            raw_bytes = msgspec.json.encode({"error": error_str})

            accept_encoding = self.request.headers.get("Accept-Encoding", "")
            if "br" in accept_encoding:
                response_bytes = brotli.compress(raw_bytes)
                self.set_header("Content-Encoding", "br")
            elif "gzip" in accept_encoding:
                response_bytes = gzip.compress(raw_bytes)
                self.set_header("Content-Encoding", "gzip")
            else:
                response_bytes = raw_bytes

            self.set_header("Content-Type", "application/json")
            self.finish(response_bytes)

        finally:
            duration_ms = (time.perf_counter() - t0) * 1000.0
            perf = {
                "handler": "PartViewDataHandler.get",
                "duration_ms": round(duration_ms, 3),
                "status": status,
                "show_completed": show_completed,
                "tags": viewable_tags,
                "tag_count": len(viewable_tags),
                "start_date": start_date,
                "end_date": end_date,
                "response_size_bytes": len(response_bytes),
                "result_len": result_len,
                "error": error_str,
            }

            print(perf)
            logging.info(msgspec.json.encode(perf).decode())
