from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from apps.core.controllers import gmail_oauth_callback, gmail_oauth_start


def health(_):
    return JsonResponse({"ok": True})

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health", health),
    path("api/", include("apps.core.urls")),
    path("api/oauth/gmail/start", gmail_oauth_start, name="gmail-oauth-start"),
    path("api/oauth/gmail/callback", gmail_oauth_callback, name="gmail-oauth-callback"),
]
