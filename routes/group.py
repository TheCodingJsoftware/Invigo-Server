from tornado.routing import URLSpec


def group(prefix: str, routes: list[URLSpec]) -> list[URLSpec]:
    return [URLSpec(prefix + r.regex.pattern, r.handler_class, r.kwargs, r.name) for r in routes]
