Integration Test Assets
=======================

This folder contains integration-level helpers: a VS Code REST Client collection, an automated PowerShell smoke test, and a small WebSocket tester.

1) REST Client collection (`full_api.http`)
------------------------------------------
- Tooling: install the VS Code extension `humao.rest-client`.
- File: `tests/integration/full_api.http`.
- Enable cookies: add `"rest-client.enableCookies": true` to VS Code settings so login sessions persist.
- Usage:
  1. Open the file and adjust the top variables (`@base`, `@email`, `@password`, `@code`). In dev/test mode the verification code is fixed to `1234`, and backend registration requires `.edu.au` email domains.
  2. Ensure sample upload files exist (defaults: `tests/integration/assets/sample-upload.png` and `tests/integration/assets/sample-ai-users.csv`).
  3. Click "Send Request" above each block. Recommended order: Health -> Auth (send/verify/set-password/login) -> Profile -> Users -> Courses -> Course posts -> Course AI users -> Admin dashboard -> AI -> Demo (messages/files/notifications/Gmail).
  4. Replace `{id}` placeholders with real IDs returned from earlier requests (course IDs, post IDs, AI-user IDs, etc.).
  5. Demo endpoints (`/api/messages/*`) share the same `@base` but do not require authentication.

2) Automated E2E PowerShell script (`run_e2e.ps1`)
-------------------------------------------------
- Purpose: start Docker Compose, wait for readiness, and exercise core APIs automatically.
- Location: `tests/integration/run_e2e.ps1`.
- Requirements: Windows PowerShell + Docker Desktop.
- Quick start:
  1. From the project root run `pwsh -File tests/integration/run_e2e.ps1 -Build` (first run builds images).
  2. Subsequent runs can omit `-Build`: `pwsh -File tests/integration/run_e2e.ps1`.
  3. Add `-DownAfter` to stop the stack once the script finishes.
- Workflow:
  1. `docker compose up -d` (with `--build` if `-Build` supplied).
  2. Poll `/api/health` until it returns `{"ok": true}`.
  3. Run the auth flow (send code -> verify -> set password -> login).
  4. Submit a minimal profile payload.
  5. Create a demo message.
  6. Upload `tests/integration/assets/sample-upload.png`.
  7. Simulate and list notifications.
- Parameters:
  - `-BaseUrl` (default `http://localhost:8080`).
  - `-Email` (default `teacher@ad.unsw.edu.au`; must end with `.edu.au`).
  - `-Password` (default `P@ssw0rd-ChangeMe`).
  - `-Code` (default `1234`).
  - `-Build` / `-DownAfter` switches.
- Examples:
  - `pwsh -File tests/integration/run_e2e.ps1 -Build -Email yourname@ad.unsw.edu.au`
  - `pwsh -File tests/integration/run_e2e.ps1 -DownAfter`
- Notes:
  - Uses the sample assets under `tests/integration/assets/`.
  - Extend the script to cover more APIs (courses, posts, AI users, dashboards, etc.) as needed.

3) WebSocket smoke test (`ws_test.py`)
--------------------------------------
- Purpose: quickly verify `/ws/notifications/` pushes by printing incoming payloads.
- Location: `tests/integration/ws_test.py`.
- Requirements: Python 3.10+ with `websockets` (`pip install websockets`).
- Usage:
  ```
  cd tests/integration
  python ws_test.py --base ws://localhost:8080 --user alice
  ```
  Adjust `--base` and `--user` as needed. The script connects, prints messages, and automatically reconnects on drop.
