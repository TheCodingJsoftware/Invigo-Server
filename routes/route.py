from tornado.routing import URLSpec


def route(pattern, handler, name=None, **kwargs):
    return URLSpec(pattern, handler, kwargs or None, name=name)
