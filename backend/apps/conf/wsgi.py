"""WSGI config for Django."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "apps.conf.settings")
application = get_wsgi_application()
