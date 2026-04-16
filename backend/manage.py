#!/usr/bin/env python3
"""Module summary: Collect related domain logic and document the intended design boundaries."""
import os
import sys


def main() -> None:
    """Execute the `main` operation with explicit data and control flow.
    Normalize inputs, delegate to dependencies, and return a predictable result.
    """
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
