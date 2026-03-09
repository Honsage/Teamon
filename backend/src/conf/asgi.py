# your_project/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'conf.settings')

# Инициализируем Django
django_asgi_app = get_asgi_application()

# Импортируем routing после инициализации Django
from chats import routing
from chats.middleware import TokenAuthMiddleware

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': AllowedHostsOriginValidator(
        TokenAuthMiddleware(  # Используем наш middleware вместо AuthMiddlewareStack
            URLRouter(
                routing.websocket_urlpatterns
            )
        )
    ),
})