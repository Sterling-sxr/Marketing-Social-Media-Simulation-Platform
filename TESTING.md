## Software Quality Assessment — Testing Guide

This document explains what tests exist in `sprint3/`, how to run them, what they cover, and what must be tested manually.

### Test suites included

- **Frontend unit tests**: `tests/frontend-unit/` (Vitest + React Testing Library)
- **Backend unit/service tests**: `tests/backend-unit/` (pytest + pytest-django)
- **Integration helpers**: `tests/integration/` (REST Client collection + scripts)

### Frontend unit tests (Vitest)

- **Location**: `tests/frontend-unit/`
- **What’s covered (high level)**:
  - Login/landing experience and common UI components (toasts, feedback, inputs, images)
  - App context helper behavior (login/logout, toast lifecycle, interest toggles, provider guards)
- **How to run**:

```bash
cd tests/frontend-unit
npm install
npm test
```

Optional UI/watch mode:

```bash
cd tests/frontend-unit
npm run test:ui
```

### Backend unit tests (pytest)

- **Location**: `tests/backend-unit/`
- **What’s covered (high level)**:
  - Service-level behavior for registration, password reset, notifications, messages, media uploads
  - Lightweight API tests for demo endpoints (e.g. `/api/messages/*`)
  - Tests are configured to avoid external dependencies (Redis/S3/Channels are stubbed/in-memory)
- **How to run (local, without Docker)**:

```bash
python -m venv .venv
source .venv/bin/activate

pip install -r backend/requirements.txt
pip install -r tests/backend-unit/requirements.txt

cd tests/backend-unit
pytest
```

How to run backend tests in Docker container:

```bash
docker compose exec backend python manage.py test
docker compose run --rm \
  -v "$(pwd)/tests/backend-unit:/app/tests/backend-unit:ro" \
  backend sh -lc "pip install -r /app/tests/backend-unit/requirements.txt && python -m pytest -c /app/tests/backend-unit/pytest.ini /app/tests/backend-unit"
```

### Integration helpers (manual / semi-automated)

- **REST Client collection**: `tests/integration/full_api.http`
  - Use VS Code extension `humao.rest-client`
  - Recommended request order is documented in `tests/integration/README.md`
- **PowerShell E2E smoke test**: `tests/integration/run_e2e.ps1` (Windows + Docker Desktop)
- **WebSocket smoke test**: `tests/integration/ws_test.py` (requires `pip install websockets`)

### Manual testing checklist (what marker can verify)

These behaviors are expected to be verified manually via the UI at `http://localhost:8080` once the stack is running.

- **Auth**
  - Registration flow (send code → verify code → set password)
  - Login / logout
  - Password reset flow
  - Notes:
    - In dev/test mode verification code is fixed to **`1234`** (no real email required).
- **Profile**
  - Edit profile fields and persist updates
  - Upload avatar (verifies file upload + MinIO/S3 path via gateway)
- **Courses**
  - List and join courses
  - Teacher/admin: create and manage courses
- **Posts**
  - Create / edit / delete posts
  - Like/unlike posts
  - Commenting
  - Upload post attachments (verifies `/api/messages/files/`)
- **Admin dashboards**
  - Dashboard summary pages and drill-down pages
  - Segmentation analytics endpoints where applicable
- **AI / LLM-dependent behavior**
  - If `DEEPSEEK_API_KEY` is **empty**, AI reactions should be disabled and the system should still work normally.
  - If configured, AI persona preview/commit and post-reaction behavior may take longer; check gateway timeouts if needed.
- **WebSockets**
  - Notifications page updates; optionally validate with `tests/integration/ws_test.py`

### External dependencies and how we handle them for testing

- **Gmail OAuth / Gmail sending**
  - Optional. The system can run without Gmail configured.
  - Integration endpoints exist for demo/testing; if Gmail secrets are not provided, flows should fail gracefully.
- **LLM (DeepSeek)**
  - Optional. Leave `DEEPSEEK_API_KEY` empty to disable.
  - Unit tests do not require network calls to LLM.
- **WebSocket / Channels**
  - Backend unit tests use in-memory stubs (see `tests/backend-unit/README.md`).

