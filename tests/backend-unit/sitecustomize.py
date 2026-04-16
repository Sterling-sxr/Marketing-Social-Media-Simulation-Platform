"""
Early test-time stubs to avoid importing heavy libs (e.g. torch) during Django app setup.

Placing this file in the working directory ensures Python imports it before pytest
initialises Django (via pytest-django), so our stubs are in place for app.ready().
"""
from types import ModuleType
import sys


def _noop(*args, **kwargs):
    return None


def _neutral(*args, **kwargs):
    return "neutral"


# Pre-inject lightweight stubs for modules referenced in apps.core.apps.CoreConfig.ready
ds_mod = ModuleType("apps.core.services.dashboard_service")
ds_mod.start_dashboard_scheduler = _noop
ds_mod.classify_comment_sentiment = _neutral
sys.modules.setdefault("apps.core.services.dashboard_service", ds_mod)

pa_mod = ModuleType("apps.core.services.post_analytics_snapshot_service")
pa_mod.start_post_analytics_scheduler = _noop
sys.modules.setdefault("apps.core.services.post_analytics_snapshot_service", pa_mod)

