from apps.conf.settings import *  # noqa: F403

try:
    del DEFAULT_FILE_STORAGE  # type: ignore[name-defined]  # noqa: F821
except NameError:
    pass


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

USE_S3 = False
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}
