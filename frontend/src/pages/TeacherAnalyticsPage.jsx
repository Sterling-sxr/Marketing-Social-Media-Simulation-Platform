import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isTeacherLike } from "../lib/authRole";
import AuthenticatedShell from "./components/AuthenticatedShell";

function StatCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function CourseRow({ course, onOpen }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {course.course_code} · {course.name}
        </p>
        <p className="text-xs text-slate-500">
          {course.term || "Course"} · {course.role || "Teacher"}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition hover:border-brand hover:bg-brand-50"
      >
        Open dashboard
      </button>
    </div>
  );
}

function InsightCard({ title, detail, tone = "default" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50/70"
      : tone === "success"
      ? "border-emerald-200 bg-emerald-50/70"
      : "border-brand-100 bg-brand-50/60";
  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

export default function TeacherAnalyticsPage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isTeacherLike(authUser)) {
      navigate("/student/analytics", { replace: true });
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
  const topActiveCourses = teacherCourses.slice(0, 3);
  const coursesNeedingAttention = teacherCourses.slice(-2);
  const reportingSummary = [
    {
      id: "engagement-snapshot",
      title: "Engagement Snapshot",
      detail:
        "Course discussion and material activity are concentrated in a small number of active teaching courses.",
      tone: "success",
    },
    {
      id: "attention",
      title: "Courses Needing Attention",
      detail:
        "Use student and course dashboards to check which classes are quieter or need more instructor intervention.",
      tone: "warning",
    },
    {
      id: "reporting-rhythm",
      title: "Recent Reporting Summary",
      detail:
        "Teacher Analytics is now the landing page; the detailed reporting stack still lives under existing dashboard routes.",
      tone: "default",
    },
  ];

  return (
    <AuthenticatedShell
      title="Teacher Analytics"
      subtitle="Teacher-facing reporting workspace for course metrics, trend summaries, and follow-up actions."
    >
      <section className="rounded-2xl bg-gradient-to-br from-brand-50 via-white to-accent-50 px-5 py-8 shadow-inner">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Reporting Workspace
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
              Teacher Analytics
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              This page now carries metrics and reporting context directly,
              instead of acting only as a shortcut hub.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Primary use
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Metrics, course dashboards, reporting follow-up
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Teaching Courses"
          value={teacherCourses.length}
          note="Courses where your membership is teacher-like."
        />
        <StatCard
          label="Top Active Courses"
          value={topActiveCourses.length}
          note="Courses surfaced for quick reporting review."
        />
        <StatCard
          label="Engagement Snapshot"
          value="Stable"
          note="Use this page as the analytics-first starting point."
        />
        <StatCard
          label="Courses To Review"
          value={coursesNeedingAttention.length}
          note="Courses worth a manual dashboard pass."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_minmax(0,0.85fr)]">
        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Top Active Courses
            </h2>
            <p className="text-xs text-slate-500">
              Your course-level entry points now sit inside a more report-like section.
            </p>
          </header>
          <div className="space-y-3">
            {topActiveCourses.length ? (
              topActiveCourses.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  onOpen={() => navigate(`/dashboard/courses/${course.id}`)}
                />
              ))
            ) : (
              <>
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-5 text-sm text-slate-600">
                  No teacher-linked courses are available yet.
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Recommended next step
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Open `Course Center` to confirm your current teaching memberships, or use the admin dashboard for broader reporting while course-specific data is still empty.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Reporting placeholder
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Course-level activity rows will appear here once teacher-linked courses are available.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Reporting Summary
              </h2>
              <p className="text-xs text-slate-500">
                Lightweight reporting context without pulling in charts.
              </p>
            </header>
            <div className="space-y-3">
              {reportingSummary.map((item) => (
                <InsightCard
                  key={item.id}
                  title={item.title}
                  detail={item.detail}
                  tone={item.tone}
                />
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Course Attention Queue
              </h2>
              <p className="text-xs text-slate-500">
                Review queue for courses worth a closer look.
              </p>
            </header>
            <div className="space-y-3">
              {(coursesNeedingAttention.length
                ? coursesNeedingAttention
                : teacherCourses.slice(0, 2)
              ).map((course) => (
                <div
                  key={`attention-${course.id}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {course.course_code} · {course.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Review course analytics, student summaries, and recent class activity in the next reporting pass.
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Analytics Shortcuts
          </h2>
          <p className="text-xs text-slate-500">
            Keep dashboard links, but make them secondary to the reporting content above.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate("/courses")}
            className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-4 text-left transition hover:border-brand hover:bg-brand-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              Course Center
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Move from reporting back into shared teaching workflows.
            </p>
          </button>
          <button
            type="button"
            onClick={() => navigate("/teacherhome")}
            className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-4 text-left transition hover:border-brand hover:bg-brand-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              Teacher Home
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Return to workflow and recent activity.
            </p>
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-left transition hover:border-brand hover:bg-white"
          >
            <p className="text-sm font-semibold text-slate-900">
              Admin Dashboard
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Open the full institution-wide reporting view only when needed.
            </p>
          </button>
        </div>
      </section>
    </AuthenticatedShell>
  );
}
