#!/usr/bin/env python3
"""Module summary: manage defines backend functionality with clear intent."""
import os
import sys


def main() -> None:
    """Function summary: main executes this unit of backend logic."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "apps.conf.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
