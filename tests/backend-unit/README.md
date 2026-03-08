Backend Test Suite (pytest + pytest-django)

What’s included
- Service-unit tests: messages, media uploads, notifications, registration
- Light API tests for demo endpoints (`/api/messages/`, `/api/messages/files/`)
- Settings overrides to avoid external deps (Redis/S3/Channels → in-memory; MEDIA_ROOT → tmp)

Run locally
1) Create venv and install backend deps:
   - `python -m venv .venv && . .venv/Scripts/activate` (Windows) or `source .venv/bin/activate`
   - `pip install -r ../../backend/requirements.txt`
   - `pip install -r requirements.txt`
2) Run tests from this folder:
   - `pytest`

Notes
- No Docker required; uses SQLite and in-memory channel layer/cache
- DJANGO_SETTINGS_MODULE points to `apps.conf.settings` and pythonpath points to `../../backend` via pytest.ini
- Tests create temp media directory; files are cleaned automatically
