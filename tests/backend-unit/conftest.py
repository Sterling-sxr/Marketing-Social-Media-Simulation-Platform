import sys
from pathlib import Path
import types

import pytest


# Ensure "apps" package is importable by adding backend directory to sys.path
THIS_DIR = Path(__file__).resolve().parent
# Prepend this tests directory so local 'apps' stubs win import resolution
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))
BACKEND_DIR = (THIS_DIR / "../../backend").resolve()
PROJECT_ROOT = BACKEND_DIR.parent
for path in (BACKEND_DIR, PROJECT_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

# Pre-inject lightweight stubs to avoid heavy imports (e.g. torch) during Django app setup
# apps.core.apps.CoreConfig.ready imports these; we provide no-op replacements
ds_mod = types.ModuleType("apps.core.services.dashboard_service")
def _noop(*args, **kwargs):
    return None
def _neutral(*args, **kwargs):
    return "neutral"
ds_mod.start_dashboard_scheduler = _noop
ds_mod.classify_comment_sentiment = _neutral
sys.modules["apps.core.services.dashboard_service"] = ds_mod

pas_mod = types.ModuleType("apps.core.services.post_analytics_snapshot_service")
pas_mod.start_post_analytics_scheduler = _noop
sys.modules["apps.core.services.post_analytics_snapshot_service"] = pas_mod


@pytest.fixture(autouse=True)
def _override_settings(settings, tmp_path):
    """Make tests independent of Redis/S3 and use temp media dir."""
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
    settings.CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
    settings.USE_S3 = False
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    # Use local PUBLIC_MEDIA_URL
    settings.PUBLIC_MEDIA_URL = "/media"
