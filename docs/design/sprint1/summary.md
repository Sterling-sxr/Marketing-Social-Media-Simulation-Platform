# Sprint 1 – Core Experience Summary

This sprint delivered the student-facing foundations so that a new learner can register, complete a persona profile, join a course, publish content, and receive engagement signals. The goal was to define the full end-to-end flow plus the REST interfaces that power each step.

## Functional Scope

1. **Authentication onboarding**
   - Email / OTP registration (`/register`, `/register/verify`, `/register/password`).
   - Login / logout UX with persistent sessions.
   - Forgot-password flow mirroring OTP verification.
2. **Persona profile wizard**
   - Multi-section form for demographics, psychographics, shopping behaviour, digital habits, and interests.
   - Avatar upload + preview component and ability to revisit the wizard from profile settings.
3. **Course lifecycle**
   - Course creation for teachers (code/term/dates) and join-by-code for students.
   - Course list page grouping joined vs. available courses; state-aware “Complete profile to enter” hints.
4. **Feed, posting, interaction**
   - Rich text composer with hashtag/mention detection, attachments, profanity hint.
   - Course feed with infinite scroll, like/comment toggles, post detail modal.
   - Notifications for likes/comments/follows with toast + inbox.
5. **Profile & social graph**
   - Public profile page with display-name editing, follower/following lists, and personal post history tabs.

## API / Interface Highlights

| Area | Endpoint(s) | Notes |
| ---- | ----------- | ----- |
| Auth service | `POST /api/auth/send-code`, `/verify-code`, `/set-password`, `/login`, `/logout` | Shared request schemas, normalized error codes, reCAPTCHA-ready hooks. |
| Profile service | `GET/POST /api/profile/me`, `/submit/`, `/avatar/`, `/options/` | Inputs grouped per wizard section to reduce payload size; server returns default sliders (1–10). |
| Course service | `GET /api/courses`, `POST /api/courses`, `POST /api/courses/join` | Response includes role + `profile_completed` hints for gating. |
| Feed service | `GET /api/courses/:id/posts`, `POST /api/courses/:id/posts`, `POST /like`, `POST /comments` | Cursor-based pagination, hydration of author info, optimistic like toggles. |
| Notification service | `GET /api/messages/notifications`, `POST /mark-read`, WebSocket channel `notifications_{recipient}` | Payload structure reused later for recommendation and AI reactions. |

## Deliverables

- High-fidelity page map & navigation flow (see `design_sprint1.md`).
- Executable PostgreSQL DDL for core tables (`users`, `course`, `post`, persona tables) stored under `docs/db/schema`.
- Component sketches for register/profile/course/feed/notification screens, ensuring design + backend contract alignment.
