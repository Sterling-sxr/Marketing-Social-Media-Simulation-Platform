[![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=20525206&assignment_repo_type=AssignmentRepo)

# Capstone Project W16B Donut (Installation Manual)

## Overview
This repo contains both the Django backend and Vite/React frontend for the Donut capstone project. The stack is containerised with Docker Compose so you can bring the entire system up with one command.

## Directory Layout
- `backend/` – Django project (apps live inside `backend/apps/`).
- `frontend/` – Vite/React single page app.
- `nginx/` – reverse proxy that serves the frontend and proxies API/media.
- `docs/` – project documentation and artefacts.
  - `docs/requirements/` – user stories and requirement specs.
  - `docs/design/` – design sprint deliverables per sprint.
  - `docs/db/schema/` – database DDL scripts, e.g. `edu_social.sql` for table structure reference.

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
- Create feature/fix branches from `sprint3` (or the active sprint branch) using names such as `W16B-42-short-description`.
- Keep commits small and descriptive, e.g. `W16B-42: describe change`.
- Merge back via Pull Request into `sprint3/main`, request at least one teammate review, and leave meaningful review comments.
- Run the local validation commands below (or see `docs/git-workflow.md`) before pushing.
- GitHub Actions runs backend tests and frontend ESLint automatically; fix any failures locally before merging.

### Local CI commands
Run these locally before pushing so CI stays green:

```bash
# Backend
source .venv/bin/activate
ruff check backend
python backend/manage.py check
python backend/manage.py test

# Frontend
cd frontend
npm run lint
```

## Tests Overview
The `tests/` directory contains three complementary suites so you can target validation at the right level:

- **Frontend unit (`tests/frontend-unit/`)** – Vitest + React Testing Library covering six files (21 assertions). `App.test.jsx` exercises the landing/login experience (hero copy, password toggle, success/error toasts), `AppContext.test.jsx` validates helper methods such as `createEmptyProfileData`, login/logout, pushToast/dismissToast, interest toggles, and provider guard logic, while `ToastHost`, `Feedback`, `CircleImage`, and `DigitInput` each have focused specs for rendering, navigation, and keyboard behaviour. Run via `cd tests/frontend-unit && npm install && npm test` (or `npm run test:ui` for watch/UI mode). For full flow descriptions and coverage, see `tests/frontend-unit/README.md`.
- **Backend unit (`tests/backend-unit/`)** – Pytest + pytest-django service tests for demo APIs (`/api/messages/*`), media uploads, message helpers, notification fan-out, and the full registration flow (send/verify code, throttling, password rules, Gmail fallback). Fixtures stub Redis/S3/Channels so everything runs on SQLite with a temp media directory. Activate `.venv`, install `backend/requirements.txt` plus `tests/backend-unit/requirements.txt`, and run `python -m pytest -c tests/backend-unit/pytest.ini tests/backend-unit`. Detailed setup and coverage live in `tests/backend-unit/README.md`.
- **Integration helpers (`tests/integration/`)** – higher-level assets: `full_api.http` (VS Code REST Client collection covering auth, profiles, courses, posts, AI users, analytics, and demo messaging/uploads), `run_e2e.ps1` (PowerShell script that starts Docker Compose then walks through auth/profile/demo APIs), and `ws_test.py` (simple WebSocket subscriber; requires the `websockets` package). Sample upload files live under `tests/integration/assets/`. See `tests/integration/README.md` for the full scripts and coverage details.

## Auth Flow
- Visit `http://localhost:8080` (Twitter-style landing page) and use the buttons to enter the registration/login flow; in debug mode the verification code is rendered directly.
- Registration has three steps: `POST /api/auth/send-code/` (email) → `POST /api/auth/verify-code/` (4-digit code) → `POST /api/auth/set-password/` (password).
- Login/Logout: `POST /api/auth/login/` and `POST /api/auth/logout/`.
- Password reset: `POST /api/auth/reset/send-code/` → `POST /api/auth/reset/verify-code/` → `POST /api/auth/reset/complete/`.
- Verification codes are cached in Redis, so ensure the `redis` container is healthy via `docker compose ps` before testing.
- Email sending: Gmail API is wired up for sending verification emails, but for the current demo the verification code is fixed as `1234` for both registration and password reset (no real email delivery required).

## Documentation & Schema
- Requirements: see `docs/requirements/user_story.md`
- Design artefacts: see sprint folders under `docs/design/`
- Database schema SQL: `docs/db/schema/edu_social.sql`

Keep these documents updated alongside code changes so new contributors can follow the latest requirements and schema definitions.

## Course Personas
- The unified profile is replaced by **per-course personas**. When a user opens a course without a persona they are redirected to `/courses/<course_id>/profile` (same UI as onboarding) and must complete it before viewing posts.
- Data lives in the new `CourseProfile` table (migration `0019_courseprofile`). After pulling latest code run `docker compose exec backend python manage.py migrate`; the migration copies existing `UserProfile` data into every joined course.
- API endpoints:
  - `GET /api/courses/<course_id>/profile/` returns course metadata, completion status, and persona details (if present).
  - `POST /api/courses/<course_id>/profile/` saves or updates persona fields.
- `/courses`, `/courses/manage`, and the personal `Profile` page all surface persona completion state per course. Incomplete courses show a “Complete profile” CTA pointing to the setup page.

## AI User Management
- Admins/super-admins can open a course card from `Courses → Manage`; the `Enter Course →` button now includes a `Manage AI Users` action.
- The management page lists every AI persona in that course with create/edit/delete/search and CSV bulk import.
- Form fields mirror the human profile options (gender, city, age band, education, income, lifestyle interests, shopping habits, social-media usage, etc.).
- CSV import can overwrite existing AI users with the same name in the same course. Interest fields accept comma/semicolon separated lists, numeric fields require integers 1–10, and fields containing commas must be wrapped in double quotes.
- Each AI persona gets a hidden system account that joins the course roster; likes, comments, and notifications run through that account so analytics and permissions stay consistent.

### CSV template example
```csv
username,display_name,gender,city,age_group,education_level,income_level,social_value,sociability,openness,content_preference,interests,shopping_frequency,buying_behavior,decision_factor,shopping_preference,digital_time,interaction_style,influencer_type,notes
ai_student_01,Alice AI,Female,Sydney,Gen Z (16-28),University Education,"$50K - $89,999 /year",7,6,8,Funny short posts/memes,"Fitness & Sports;Travel & Food",Often,Brand loyal,Quality/durability,Both online and in stores,Several times a day,Comment on posts,Fashion & Beauty,"Prefers eco-friendly brands"
ai_student_02,Bob AI,Male,Melbourne,Gen Y (29-44),Post-graduate Education,"$90K - $149,999 /year",5,5,5,Thoughtful opinions,"Technology & Gaming,Outdoor & Nature",Sometimes,Price-sensitive,Price,Online only,About once a day,Mostly just scroll/watch,Tech & Gaming,""
```

> Run `docker compose exec backend python manage.py migrate` beforehand to create/update the `CourseAIUser` and `CourseAIUserIdentity` tables.

### AI automation (DeepSeek)
- Configure `DEEPSEEK_API_KEY` in `.env` or the deployment environment (optional overrides: `DEEPSEEK_API_BASE`, `DEEPSEEK_MODEL_NAME`, `DEEPSEEK_POST_DELAY_SECONDS`, `DEEPSEEK_AI_USER_DELAY_SECONDS`). Leaving the API key empty disables AI interactions.
- After a post is committed, the backend asynchronously calls the DeepSeek API for each AI persona to decide likes/comments and posts them via the persona’s system account.
- API failures and network errors are caught and logged so normal posting is unaffected.
- Post-analytics sentiment snapshots run on the same scheduler (controlled by `POST_ANALYTICS_REFRESH_INTERVAL`, default 1 hour). A snapshot is also triggered once at service startup.


# Celery 
- run dashboard:
docker compose exec backend python manage.py shell -c \
  "from apps.core.services.dashboard_service import refresh_all_dashboards; refresh_all_dashboards()"


- asynchronous 
docker compose exec backend python manage.py shell -c \
"from apps.core.services.dashboard_service import refresh_all_dashboards_async; refresh_all_dashboards_async()"
