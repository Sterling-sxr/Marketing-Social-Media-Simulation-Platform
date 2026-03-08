import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
APPS_DIR = BASE_DIR / "apps"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "*").split(",")
    if host.strip()
] or ["*"]

INSTALLED_APPS = [
    "channels",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "storages",
    "apps.core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "apps.conf.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "apps.conf.wsgi.application"
ASGI_APPLICATION = "apps.conf.asgi.application"

_default_db_url = os.environ.get("DATABASE_URL")
if not _default_db_url:
    _default_db_path = BASE_DIR / "db.sqlite3"
    _default_db_url = f"sqlite:///{_default_db_path}"

DATABASES = {
    "default": dj_database_url.parse(_default_db_url, conn_max_age=600, ssl_require=False)
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://redis:6379/0"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

_channel_redis_url = os.environ.get("CHANNEL_REDIS_URL") or os.environ.get("REDIS_URL") or "redis://redis:6379/0"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [_channel_redis_url],
        },
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("TZ", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

USE_S3 = bool(os.environ.get("S3_ENDPOINT"))
if USE_S3:
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    AWS_S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT")
    AWS_STORAGE_BUCKET_NAME = os.environ.get("S3_BUCKET", "media")
    AWS_S3_REGION_NAME = os.environ.get("S3_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY")
    AWS_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_KEY")
    AWS_S3_ADDRESSING_STYLE = "path"
    AWS_DEFAULT_ACL = None

CORS_ALLOW_ALL_ORIGINS = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

PUBLIC_MEDIA_URL = os.environ.get("PUBLIC_MEDIA_URL", MEDIA_URL)

GMAIL_CLIENT_ID = os.environ.get("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.environ.get("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.environ.get("GMAIL_REFRESH_TOKEN")
GMAIL_SENDER = os.environ.get("GMAIL_SENDER")
GMAIL_DEMO_RECIPIENT = os.environ.get("GMAIL_DEMO_RECIPIENT")
GMAIL_REDIRECT_URI = os.environ.get("GMAIL_REDIRECT_URI")

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_API_BASE = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com")
DEEPSEEK_MODEL_NAME = os.environ.get("DEEPSEEK_MODEL_NAME", "deepseek-chat")
DEEPSEEK_POST_DELAY_SECONDS = os.environ.get("DEEPSEEK_POST_DELAY_SECONDS", "1.0")
DEEPSEEK_AI_USER_DELAY_SECONDS = os.environ.get("DEEPSEEK_AI_USER_DELAY_SECONDS", "0.0")
POST_ANALYTICS_REFRESH_INTERVAL = int(os.environ.get("POST_ANALYTICS_REFRESH_INTERVAL", "3600"))
