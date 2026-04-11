import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isTeacherLike } from "../lib/authRole";
import AuthenticatedShell from "./components/AuthenticatedShell";

function ActionCard({ title, desc, actionLabel, onAction, tone = "default" }) {
  const toneClass =
    tone === "primary"
      ? "border-brand-200 bg-gradient-to-br from-brand-50 via-white to-accent-50"
      : tone === "secondary"
      ? "border-slate-200 bg-white"
      : "border-brand-100/80 bg-[linear-gradient(135deg,rgba(246,252,253,0.95)_0%,rgba(239,249,250,0.95)_100%)]";

  return (
    <div className={`rounded-2xl border p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-brand ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="rounded-full border border-brand-200/80 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-gradient-to-r hover:from-brand-100 hover:to-accent-100 hover:text-slate-900 hover:shadow-md"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function FeedItem({ title, detail, meta }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
        {meta}
      </p>
    </div>
  );
}

export default function TeacherHomePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isTeacherLike(authUser)) {
      navigate("/studenthome", { replace: true });
    }
  }, [authCheckComplete, authUser, navigate]);

  useEffect(() => {
    if (authUser && isTeacherLike(authUser)) {
      fetchCourses().catch(() => {});
    }
  }, [authUser, fetchCourses]);

  const teacherCourses = useMemo(
    () => (courses.joined || []).filter((course) => isTeacherLike(course)),
    [courses.joined]
  );

  const allCoursesCount = teacherCourses.length;
  const displayName =
    authUser?.display_name ||
    authUser?.full_name ||
    authUser?.username ||
    authUser?.email ||
    "Teacher";
  const recentActivity = teacherCourses.slice(0, 3).map((course, index) => ({
    id: `${course.id}-activity`,
    title: `${course.course_code} update ready`,
    detail:
      index === 0
        ? "New discussion activity is building in this course. Review recent posts or jump into analytics."
        : index === 1
        ? "Course materials and student engagement are both active this week."
        : "This course has fresh activity worth a quick pass before your next class.",
    meta: `${course.term || "Current term"} · ${course.role || "Teacher"}`,
  }));
  const notificationsSummary = [
    {
      id: "notif-review",
      title: "Messages summary",
      detail:
        "Messages and course notifications are best checked before publishing new content or announcements.",
      meta: "Workflow summary",
    },
    {
      id: "notif-analytics",
      title: "Analytics follow-up",
      detail:
        "Use analytics to spot which course needs attention rather than opening the full admin dashboard first.",
      meta: "Reporting follow-up",
    },
    {
      id: "notif-materials",
      title: "Materials check suggested",
      detail:
        "One quick pass through course materials can catch missing uploads before the next teaching session.",
      meta: "Teaching prep",
    },
    {
      id: "notif-engagement",
      title: "Review quieter courses",
      detail:
        "Courses with lighter discussion often benefit from an announcement or a prompt posted from the feed.",
      meta: "Course updates",
    },
  ];

  return (
    <AuthenticatedShell
      title="Teacher Home"
      subtitle="Your teacher workspace for course operations, daily actions, and recent class activity."
    >
      <section className="rounded-2xl bg-gradient-to-br from-brand-50 via-white to-accent-50 px-5 py-10 shadow-inner">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Teacher Workspace
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
              Welcome back, {displayName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Start from your daily teaching workflow here: open active
              courses, review analytics, and keep up with recent course
              activity without dropping straight into admin reporting.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Active teaching courses
              </p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">
                {allCoursesCount}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Main flow today
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Course Center, Analytics, Messages
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Teacher Courses"
          value={allCoursesCount}
          note="Courses where your current role is teacher-like."
        />
        <SummaryCard
          label="Quick Actions"
          value="3"
          note="Core daily workflow actions surfaced below."
        />
        <SummaryCard
          label="Recent Activity"
          value={recentActivity.length || 0}
          note="Course updates ready for review."
        />
        <SummaryCard
          label="Admin Tools"
          value="2"
          note="Management links remain available, but secondary."
        />
      </section>

      <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Daily Workflow
          </h2>
          <p className="text-xs text-slate-500">
            High-frequency teacher actions come first.
          </p>
        </header>
        <div className="grid gap-4 lg:grid-cols-3">
          <ActionCard
            title="Course Center"
            desc="Open your shared course workspace and continue into class feeds, materials, and profiles."
            actionLabel="Open"
            onAction={() => navigate("/courses")}
            tone="primary"
          />
          <ActionCard
            title="Analytics"
            desc="Review teacher-facing metrics, course reporting, and links into course dashboards."
            actionLabel="Open"
            onAction={() => navigate("/teacher/analytics")}
            tone="primary"
          />
          <ActionCard
            title="Messages"
            desc="Check notifications, course activity, and updates that may need a teaching response."
            actionLabel="Open"
            onAction={() => navigate("/notifications")}
            tone="primary"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_minmax(0,0.85fr)]">
        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Course Updates
            </h2>
            <p className="text-xs text-slate-500">
              Lightweight recent activity to make this page feel like a working teacher home.
            </p>
          </header>
          <div className="space-y-3">
            {(recentActivity.length ? recentActivity : notificationsSummary).map((item) => (
              <FeedItem
                key={item.id}
                title={item.title}
                detail={item.detail}
                meta={item.meta}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Quick Teaching Actions
              </h2>
              <p className="text-xs text-slate-500">
                Shortcuts for operational work, not reporting.
              </p>
            </header>
            <div className="space-y-3">
              <ActionCard
                title="Open first teaching course"
                desc="Jump straight into the first teacher-linked course in your list."
            actionLabel="Open"
            onAction={() =>
                  teacherCourses[0]
                    ? navigate(`/courses/${teacherCourses[0].id}`)
                    : navigate("/courses")
                }
                tone="secondary"
              />
              <ActionCard
                title="Review course materials"
                desc="Check resources and uploads before your next class."
                actionLabel="Open"
                onAction={() =>
                  teacherCourses[0]
                    ? navigate(`/courses/${teacherCourses[0].id}/materials`)
                    : navigate("/courses")
                }
                tone="secondary"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-soft">
            <header className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Management Links
              </h2>
              <p className="text-xs text-slate-500">
                Secondary admin tools, kept available but visually de-emphasised.
              </p>
            </header>
            <div className="space-y-3">
              <ActionCard
                title="Course Manage"
                desc="Open course management for setup and administrative tasks."
                actionLabel="Open"
                onAction={() => navigate("/courses/manage")}
                tone="secondary"
              />
              <ActionCard
                title="Admin Dashboard"
                desc="Open institution-wide reporting when you need the full admin view."
                actionLabel="Open"
                onAction={() => navigate("/dashboard")}
                tone="secondary"
              />
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ActionCard
          title="Messages Summary"
          desc="No complex inbox logic yet, but this section anchors teacher messaging in the workspace."
          actionLabel="Open"
          onAction={() => navigate("/notifications")}
          tone="secondary"
        />
        <ActionCard
          title="Analytics Follow-up"
          desc="Use teacher analytics when you need reporting; stay on Teacher Home for day-to-day operations."
          actionLabel="Open"
          onAction={() => navigate("/teacher/analytics")}
          tone="secondary"
        />
      </section>
    </AuthenticatedShell>
  );
}
