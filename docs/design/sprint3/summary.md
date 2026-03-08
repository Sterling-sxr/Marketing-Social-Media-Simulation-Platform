# Sprint 3 – Analytics & Hardening Summary

Sprint 3 focused on insight generation and system reliability. We introduced teacher-facing analytics dashboards, post-level instrumentation, CI/CD safeguards, and AI-driven recommendations. This document captures the high-level functionality and the APIs that back each view.

## Functional Scope

1. **Teacher analytics workspace**
   - `/dashboard` (overview) with KPI tiles, sentiment summary, course comparison radar.
   - `/admin/analytics/course/:id` for time-series charts (posts, interactions, active students).
   - `/admin/analytics/post/:id` deep dive: view/like/comment trend, hashtag cohort comparison, sentiment ring.
   - `/admin/compare` multi-course benchmarking, highlighting the top-performing classes.
2. **Post insights & persona reactions**
   - Transactional snapshots (`PostAnalyticsSnapshot`) capturing totals, percentages, hashtag aggregates.
   - AI personas (DeepSeek) auto-like/comment if prompt says they are interested.
   - Recommendation notifications “A post you might like” with English copy + metadata.
3. **CI / workflow hardening**
   - Ruff lint + pytest GitHub Actions for backend; ESLint for frontend.
   - `.env.example` sanitised with placeholders; Git workflow guidelines + README updates.
   - Notifications now fully English; navbar avatar/name sync improvements.
4. **Dashboard data governance**
   - Manual refresh command (`manage.py refresh_dashboard_snapshots`) + documented scheduler toggle.
   - Placeholder handling when snapshots missing, ensuring predictable demo state.

## API / Interface Highlights

| Area | Endpoint(s) | Notes |
| ---- | ----------- | ----- |
| Analytics service | `GET /api/analytics/courses`, `/course/:id`, `/post/:id`, `/compare` | All include `calculatedAt`, breakdown arrays, and sample size metadata. |
| Dashboard snapshots | `GET /api/admin/dashboard` | Now returns last persisted snapshot only; refreshing performed manually. |
| Post analytics | `GET /api/courses/:courseId/posts/:postId/analytics` | Serves post detail charts, hashtag cohort stats, sentiment percentages. |
| Notification service | `POST /api/messages/notifications` (via recommendation helper) | Metadata fields include `course_code`, `post_preview`, `reason`. |
| CI utilities | Documented commands for `ruff check backend`, `pytest`, `npm run lint`, plus README Git workflow instructions. |

## Deliverables

- Analytic dashboard UX spec (overview, course, post, comparison) documented in `design_sprint3.md`.
   - Includes chart annotations, axis rules, and toast behaviors.
- Background-job specification detailing snapshot schedule, AI persona evaluation prompt, and retry policies.
- Git workflow hardening doc + README updates describing CI commands and branch naming.
- Docs for manual database refresh: `.env` flags (`DISABLE_DASHBOARD_SCHEDULER`) and handoff steps.
