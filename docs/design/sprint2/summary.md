# Sprint 2 – Moderation & Discovery Summary

Sprint 2 expanded the platform from “usable” to “manageable” by equipping teachers with admin tooling, enriching discovery through hashtags, and hardening system notifications. The work focused on both feature design and the API contracts that enable moderation workflows.

## Functional Scope

1. **Teacher consoles**
   - `/admin/dashboard` overview cards (courses, students, posts, alerts) with quick links.
   - `/admin/courses` for editing metadata, toggling archive state, exporting join codes.
   - `/admin/users` roster view with ban/unban, role escalation, and enrollment filter.
   - `/admin/posts` queue to inspect, search, and delete policy-violating content.
2. **Course archival model**
   - Courses can enter “archived” (read-only) state based on end dates or manual toggle.
   - Feed surfaces badges and disables composer when archived.
3. **Hashtag taxonomy**
   - Autocomplete + validation when composing posts.
   - Course-level hashtag landing pages with sort tabs (All / Latest / Hottest).
   - Analytics snippet per tag (post count, last used, average engagement).
4. **Extended notifications**
   - Support for follows, mentions, teacher announcements, moderation outcomes.
   - Inbox grouping, toast fallback message, and WebSocket dedup logic.

## API / Interface Highlights

| Area | Endpoint(s) | Notes |
| ---- | ----------- | ----- |
| Admin dashboard | `GET /api/admin/dashboard` | Returns snapshot (counts, course list, needs-refresh flag). |
| Course admin | `GET /api/admin/courses`, `PATCH /api/courses/:id/archive` | Archive flag cascades to feed gating and join code enforcement. |
| Student admin | `GET /api/admin/users?courseId=`, `POST /api/admin/users/:id/ban` | Includes audit metadata for later action log. |
| Post moderation | `GET /api/admin/posts`, `DELETE /api/admin/posts/:id` | Filterable by hashtags/state; responses include author + report summary. |
| Hashtag service | `GET /api/hashtags/:tagName`, `/posts`, `/trending` | Shared pagination contract with feed; aggressive caching for summaries. |
| Notification upgrades | `GET /api/messages/notifications`, metadata fields `reason`, `link`, `call_to_action` | Foundation for AI recommendations in Sprint 3. |

## Deliverables

- Admin IA diagrams + wireframes for dashboard, courses, users, posts (see `design_sprint2.md` and supporting PNGs).
- Moderation permission matrix mapping teacher/staff vs student capabilities.
- Hashtag UX spec with chip styles, filter tabs, and empty states.
- Updated ERD covering new tables/fields (`course_archive_state`, `notification.metadata` extensions).
