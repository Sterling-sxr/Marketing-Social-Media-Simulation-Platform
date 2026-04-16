import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { isTeacherLike } from "../lib/authRole";
import { fetchCourseDashboard } from "../lib/teacherAnalytics";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

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

function SourceBadge({ sourceKind }) {
  const className =
    sourceKind === "backend"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const label =
    sourceKind === "backend" ? "Backend snapshot" : "Fallback placeholder";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function CourseRow({ item, onOpen }) {
  const { course, summary, meta } = item;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {course.course_code} · {course.name}
          </p>
          <p className="text-xs text-slate-500">
            {course.term || "Course"} · {course.role || "Teacher"}
          </p>
        </div>
        <SourceBadge sourceKind={meta.sourceKind} />
      </div>
      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <p>Posts: {summary.total_posts}</p>
        <p>Interactions: {summary.total_interactions}</p>
        <p>Students: {summary.registered_students}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {meta.calculatedAt
            ? `Snapshot generated: ${new Date(meta.calculatedAt).toLocaleString(
                "en-AU",
                { hour12: false }
              )}`
            : "Snapshot not generated yet. Page is showing a safe fallback shape."}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 transition hover:border-brand hover:bg-brand-50"
        >
          Open dashboard
        </button>
      </div>
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
  const [dashboardStatus, setDashboardStatus] = useState({
    loading: false,
    error: "",
  });
  const [courseItems, setCourseItems] = useState([]);

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

  useEffect(() => {
    if (!authUser || !isTeacherLike(authUser)) return;
    if (!teacherCourses.length) {
      setCourseItems([]);
      setDashboardStatus({ loading: false, error: "" });
      return;
    }

    let cancelled = false;
    setDashboardStatus({ loading: true, error: "" });

    Promise.allSettled(
      teacherCourses.map(async (course) => {
        try {
          return await fetchCourseDashboard(course.id, course);
        } catch {
          return {
            course: {
              id: course.id,
              name: course.name || "",
              course_code: course.course_code || "",
              term: course.term || "",
              role: course.role || "teacher",
            },
            summary: {
              total_posts: 0,
              total_interactions: 0,
              registered_students: 0,
            },
            hashtags: [],
            students: [],
            meta: {
              refreshing: true,
              calculatedAt: null,
              sourceKind: "fallback",
              sourceLabel: "Fallback placeholder",
            },
          };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const normalized = results
        .map((result) =>
          result.status === "fulfilled" ? result.value : null
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.summary.total_interactions - a.summary.total_interactions ||
            b.summary.total_posts - a.summary.total_posts
        );
      setCourseItems(normalized);
      setDashboardStatus({ loading: false, error: "" });
    });

    return () => {
      cancelled = true;
    };
  }, [authUser, teacherCourses]);

  const topActiveCourses = courseItems.slice(0, 3);
  const backendReadyCount = courseItems.filter(
    (item) => item.meta.sourceKind === "backend"
  ).length;
  const fallbackCount = courseItems.filter(
    (item) => item.meta.sourceKind === "fallback"
  ).length;
  const attentionQueue = courseItems
    .filter(
      (item) =>
        item.meta.sourceKind === "fallback" || item.summary.total_posts === 0
    )
    .slice(0, 3);

  const reportingSummary = [
    {
      id: "backend-coverage",
      title: "Backend Coverage",
      detail: `${backendReadyCount}/${teacherCourses.length} teacher-linked course dashboards are backed by stored snapshots.`,
      tone: backendReadyCount ? "success" : "warning",
    },
    {
      id: "fallback-coverage",
      title: "Fallback Coverage",
      detail: fallbackCount
        ? `${fallbackCount} course(s) still render the placeholder contract so the page remains demo-safe when snapshots are missing.`
        : "No course rows are currently relying on placeholder fallback data.",
      tone: fallbackCount ? "warning" : "success",
    },
    {
      id: "entry-shape",
      title: "Unified Teacher Entry",
      detail:
        "Teacher Analytics now loads course dashboard summaries through one normalized entry path before linking into the detailed dashboard routes.",
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
              This page now summarizes teacher course dashboards using the same
              source contract that the detailed analytics pages consume.
            </p>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-white/80 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current data mode
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Backend snapshots with explicit fallback labeling
            </p>
          </div>
        </div>
      </section>

      {dashboardStatus.error ? <Feedback error={dashboardStatus.error} /> : null}
      {dashboardStatus.loading ? (
        <p className="text-xs text-slate-500">
          Loading teacher course analytics...
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Teaching Courses"
          value={teacherCourses.length}
          note="Courses where your membership is teacher-like."
        />
        <StatCard
          label="Backend Ready"
          value={backendReadyCount}
          note="Course dashboards currently backed by stored snapshots."
        />
        <StatCard
          label="Fallback Active"
          value={fallbackCount}
          note="Rows still using placeholder-safe dashboard contracts."
        />
        <StatCard
          label="Courses To Review"
          value={attentionQueue.length}
          note="Courses with missing or quiet analytics worth checking."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_minmax(0,0.85fr)]">
        <div className="rounded-3xl border border-brand-100 bg-white p-6 shadow-soft">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Course Analytics Entry
            </h2>
            <p className="text-xs text-slate-500">
              Each row shows the current source status before opening the
              detailed course dashboard.
            </p>
          </header>
          <div className="space-y-3">
            {topActiveCourses.length ? (
              topActiveCourses.map((item) => (
                <CourseRow
                  key={item.course.id}
                  item={item}
                  onOpen={() => navigate(`/dashboard/courses/${item.course.id}`)}
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
                    Open Course Center to confirm teacher memberships before
                    reviewing analytics.
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
                Source clarity first, charts second.
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
                Prioritized for missing snapshots or zero activity.
              </p>
            </header>
            <div className="space-y-3">
              {(attentionQueue.length ? attentionQueue : courseItems.slice(0, 2)).map(
                (item) => (
                  <div
                    key={`attention-${item.course.id}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.course.course_code} · {item.course.name}
                      </p>
                      <SourceBadge sourceKind={item.meta.sourceKind} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {item.meta.sourceKind === "fallback"
                        ? "Snapshot missing. Demo is currently backed by fallback-safe zeroed data."
                        : "Snapshot exists. Use the detailed dashboard to inspect students, hashtags, and post activity."}
                    </p>
                  </div>
                )
              )}
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
            Keep dashboard links, but make them secondary to the reporting
            content above.
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
              Open the institution-wide reporting view only when needed.
            </p>
          </button>
        </div>
      </section>
    </AuthenticatedShell>
  );
}
