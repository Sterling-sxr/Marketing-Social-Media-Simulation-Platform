# Marketing Social Media Simulation Platform

## Overview
Marketing Social Media Simulation Platform contains a Django backend and Vite/React frontend for course-based social media simulation, AI personas, and engagement analytics. The stack is containerised with Docker Compose so you can bring the entire system up with one command.

## Directory Layout
- `backend/` – Django project (apps live inside `backend/apps/`).
- `frontend/` – Vite/React single page app.
- `nginx/` – reverse proxy that serves the frontend and proxies API/media.
- `docs/` – project documentation and artefacts.
  - `docs/db/schema/` – database DDL scripts, e.g. `postgres-schema.sql` for table structure reference.

## Prerequisites
- Docker 24+
- Docker Compose plugin

## First-Time Setup
1. Duplicate the environment example: `cp .env.example .env` and adjust secrets or ports as needed.
2. Build the containers: `docker compose build`
3. Start everything: `docker compose up -d`
4. Verify services: `docker compose ps` and open `http://localhost:8080`

The backend container will automatically run Django migrations on startup. MinIO, PostgreSQL, Redis, and RabbitMQ are all provisioned by the compose stack.

## Useful Commands
- View combined logs: `docker compose logs -f`
- Rebuild backend/frontend after code changes: `docker compose up -d --build backend frontend`
- Restart the nginx gateway after rebuilding: `docker compose restart gateway`
- Stop the stack: `docker compose down` (add `-v` to remove volumes/data)
- Run frontend with Docker hot reload: `docker compose up -d postgres redis rabbitmq minio minio-init backend gateway frontend-dev --build --no-deps`
- Open frontend dev server: `http://localhost:5173`

## Frontend Hot Reload In Docker
Use `frontend-dev` for day-to-day frontend coding. It mounts local source code and runs Vite in dev mode.

```bash
# 1) Start backend stack + frontend dev container
docker compose up -d postgres redis rabbitmq minio minio-init backend gateway frontend-dev --build --no-deps

# 2) If the production frontend container is running, stop it
docker compose stop frontend

# 3) Watch frontend logs (first run installs npm deps)
docker compose logs -f frontend-dev
```

Notes:
- Edit files under `frontend/src`; browser refreshes automatically (HMR).
- `frontend-dev` runs on `http://localhost:5173`.
- API and media proxy target defaults to `http://gateway` inside Docker network.
- Override API target if needed: `VITE_API_BASE=http://gateway docker compose up -d frontend-dev`.

## Git Workflow
- Create a new feature/fix branch for your changes using names such as `F09D-42-short-description`.
- Keep commits small and descriptive, e.g. `F09D-42: describe change`.
- Open a Pull Request to merge your branch into `main`.
- Request at least one teammate review and leave meaningful review comments.
- Run the local validation commands below before pushing.
- GitHub Actions runs backend tests and frontend ESLint automatically; fix any failures locally before merging.

### Local CI commands
Run these locally before pushing so CI stays green:

```bash
# Backend
source .venv/bin/activate
ruff check backend
python backend/manage.py check
python backend/manage.py test
python -m pytest -c tests/backend-unit/pytest.ini tests/backend-unit

# Frontend
cd frontend
npm run lint
```

Backend unit tests in Docker:

```bash
docker compose run --rm \
  -v "$(pwd)/tests/backend-unit:/app/tests/backend-unit:ro" \
  backend sh -lc "pip install --root-user-action=ignore -r /app/requirements.txt && pip install --root-user-action=ignore pytest==8.3.2 pytest-django==4.9.0 && python -m pytest -p no:cacheprovider -c /app/tests/backend-unit/pytest.ini /app/tests/backend-unit"
```

## Tests Overview
The `tests/` directory contains three complementary suites so you can target validation at the right level:

- **Frontend unit (`tests/frontend-unit/`)** – Vitest + React Testing Library covering six files (21 assertions). `App.test.jsx` exercises the landing/login experience (hero copy, password toggle, success/error toasts), `AppContext.test.jsx` validates helper methods such as `createEmptyProfileData`, login/logout, pushToast/dismissToast, interest toggles, and provider guard logic, while `ToastHost`, `Feedback`, `CircleImage`, and `DigitInput` each have focused specs for rendering, navigation, and keyboard behaviour. Run via `cd tests/frontend-unit && npm install && npm test` (or `npm run test:ui` for watch/UI mode). For full flow descriptions and coverage, see `tests/frontend-unit/README.md`.
- **Backend unit (`tests/backend-unit/`)** – Pytest + pytest-django service tests for demo APIs (`/api/messages/*`), media uploads, message helpers, notification fan-out, and the full registration flow (send/verify code, throttling, password rules, Gmail fallback). Fixtures stub Redis/S3/Channels so everything runs on SQLite with a temp media directory. Activate `.venv`, install `tests/backend-unit/requirements.txt`, and run `python -m pytest -c tests/backend-unit/pytest.ini tests/backend-unit`. Detailed setup and coverage live in `tests/backend-unit/README.md`.
- **Integration helpers (`tests/integration/`)** – higher-level assets: `full_api.http` (VS Code REST Client collection covering auth, profiles, courses, posts, AI users, analytics, and demo messaging/uploads), `run_e2e.ps1` (PowerShell script that starts Docker Compose then walks through auth/profile/demo APIs), and `ws_test.py` (simple WebSocket subscriber; requires the `websockets` package). Sample upload files live under `tests/integration/assets/`. See `tests/integration/README.md` for the full scripts and coverage details.

## Auth Flow
- Entry points:
  - Registration: `POST` flow starts from `/register/email` (from the landing page).
  - Login/Logout: via `/login` and the authenticated header.
  - Password reset: via `/reset/email`.
- Registration (email OTP) supports both **student** and **teacher** roles:
  - Step 1: Send verification code  
    - UI: on `/register/email`, select `Student` or `Teacher` (Teacher requires `Teacher invite code`) and enter your school email.
    - API: `POST /api/auth/send-code/` with payload `{ email, role, teacher_invite_code }`.
    - Teacher invite code source: set `TEACHER_REGISTRATION_INVITE_CODE` in `.env` (default example in `.env.example`: `12345678`), then enter the same value in the Teacher invite code field.
    - In dev/test mode the verification code is fixed to `1234` (and is returned as `dev_code`), so you can verify without real email delivery.
  - Step 2: Verify the 4-digit code  
    - UI: `/register/verify`
    - API: `POST /api/auth/verify-code/` with payload `{ email, code }`.
  - Step 3: Set password  
    - UI: `/register/password`
    - API: `POST /api/auth/set-password/` with payload `{ email, password, role, teacher_invite_code }` (password must be at least 8 characters).
    - On success the app auto-logins and redirects to `/courses`.
- Login/Logout: `POST /api/auth/login/` and `POST /api/auth/logout/`.
- Password reset:
  - Step 1: `POST /api/auth/reset/send-code/` with payload `{ email }`
  - Step 2: `POST /api/auth/reset/verify-code/` with payload `{ email, code }`
  - Step 3: `POST /api/auth/reset/complete/` with payload `{ email, password }`
- Verification code caching & throttling:
  - Verification codes are cached/rate-limited (via Redis in the intended setup), so ensure the `redis` container is healthy via `docker compose ps` before testing.
- Email sending:
  - Gmail OAuth is optional; when not configured the system should still work in dev/test mode using the fixed `1234` code.

## Documentation & Schema
- Database schema SQL: `docs/db/schema/postgres-schema.sql`

Keep these documents updated alongside code changes so new contributors can follow the latest requirements and schema definitions.

## Course Personas
- Course persona data is stored per course in the `CourseProfile` table.
- Users set up (or update) their course persona on `/courses/<course_id>/profile` (the same onboarding UI). The course Community page includes a `View course profile` link and shows a `Complete profile` CTA when a `CourseProfile` row does not exist for the current user/course.
- API endpoints:
  - `GET /api/courses/<course_id>/profile/` returns course metadata plus `profile_completed` and `profile` (persona fields) or `profile: null`.
  - `POST /api/courses/<course_id>/profile/` saves or updates persona fields and returns updated `profile` + `profile_completed: true`.
- The student `Profile` page shows a `Course Personas` list for joined courses, and the Community feed offers the profile quick link/modal.

## AI User Management
- Teachers/admins select a course from `/ai-users` (AI User Center). Each course card has a `Manage AI Users` button that opens `/courses/<course_id>/ai-users`.
- The per-course management page lists every AI persona with create/edit/delete/search and CSV bulk import.
- Form fields mirror the persona schema (gender, city, age group, education/income levels, lifestyle interests, shopping habits, etc.).
- CSV import overwrites existing AI users with the same username in the same course; interests accept comma/semicolon-separated values, numeric fields validate as integers 1–10, and any CSV field containing commas must be quoted.
- Each AI persona gets a generated system user account that is added to the course roster; likes/comments/notifications run through that account so analytics and permissions remain consistent.

### CSV template example
Use the ready-to-import sample at the repository root: `ai_personas_50_valid.csv`.

> Run `docker compose exec backend python manage.py migrate` beforehand to create/update the `CourseAIUser` and `CourseAIUserIdentity` tables.

### AI automation (DeepSeek)
- Configure `DEEPSEEK_API_KEY` in `.env` or the deployment environment (optional overrides: `DEEPSEEK_API_BASE`, `DEEPSEEK_MODEL_NAME`, `DEEPSEEK_POST_DELAY_SECONDS`). Leaving the API key empty disables DeepSeek-backed flows (Smart `generate-preview`, AI reactions, and AI analysis).
- The AI persona `generate-preview` flow calls DeepSeek synchronously (OpenAI SDK `chat.completions.create` with `stream=false`), so it can take longer than the rule-based `guided-preview`.
- After a post is committed, the backend schedules background AI reactions via `schedule_ai_reactions()` in a thread; reactions for each AI persona run concurrently after `DEEPSEEK_POST_DELAY_SECONDS`.
- API failures and network errors in reaction/LLM calls are caught and logged so normal posting is unaffected.
- Post-analytics sentiment snapshots are refreshed by `post_analytics_snapshot_service` on a loop controlled by `POST_ANALYTICS_REFRESH_INTERVAL` (default 3600 seconds), with an initial refresh triggered shortly after service startup.

## CI
- Runs on push, pull request, and manual trigger.
- Required CI jobs (quality gate is `ci-summary`): `backend-quality`, `backend-tests`, `backend-unit-tests`, `frontend-quality`, `frontend-unit-tests`, `docker-build-validation`.
- `security-audit` runs too, but it is non-blocking (`continue-on-error: true`), so it does not prevent the `ci-summary` gate from passing.
- If CI fails: check the failed step in the GitHub Actions page before requesting review.
- Before opening a PR: make sure you have run local backend and frontend checks if possible.

Confirm required files exist on `main`: `README.md`, `TESTING.md`, `INSTALLATION_MANUAL.pdf`, `.env.example`, and Docker configs.
