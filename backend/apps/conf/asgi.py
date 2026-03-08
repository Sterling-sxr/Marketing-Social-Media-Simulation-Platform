"""ASGI config for Django with Channels support."""
import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "apps.conf.settings")

django_asgi_app = get_asgi_application()

import apps.core.routing  # noqa: E402  pylint: disable=wrong-import-position

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(apps.core.routing.websocket_urlpatterns))
        ),
    }
)
