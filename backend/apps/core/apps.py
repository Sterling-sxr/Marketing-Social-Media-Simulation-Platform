import os

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"

    def ready(self) -> None:  # noqa: D401
        """Execute the `ready` operation with explicit data and control flow.
        Normalize inputs, delegate to dependencies, and return a predictable result.
        """
        if os.environ.get("SKIP_CORE_BACKGROUND_TASKS") == "1":
            return
        from .services.dashboard_service import start_dashboard_scheduler
        from .services.post_analytics_snapshot_service import start_post_analytics_scheduler

        start_dashboard_scheduler()
        start_post_analytics_scheduler()
