import aiohttp

import tornado

from config.environments import Environment
from handlers.base import BaseHandler


class GeneratePDFHandler(BaseHandler):
    async def post(self):
        body = tornado.escape.json_decode(self.request.body)
        url = self.get_argument("url")
        local_storage = body.get("localStorage", {})

        # CRITICAL: url must be reachable from the renderer container.
        # If user provides http://invi.go/... rewrite to the docker service name:
        url = (
            url
            .replace("http://invi.go", f"http://invigo_server:{Environment.PORT}")
            .replace("http://localhost:5057", "http://127.0.0.1:5057")
        )
        renderer_url = Environment.PUPPETEER_URL

        async with aiohttp.ClientSession() as session:
          async with session.post(
              f"{renderer_url}/pdf",
              json={"url": url, "localStorage": local_storage},
              timeout=aiohttp.ClientTimeout(total=90),
          ) as resp:
              data = await resp.read()
              if resp.status != 200:
                  self.set_status(500)
                  self.write(data.decode(errors="replace"))
                  return

        self.set_header("Content-Type", "application/pdf")
        self.set_header("Content-Disposition", "inline; filename=output.pdf")
        self.write(data)
