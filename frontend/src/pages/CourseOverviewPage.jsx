import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

function formatDateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CourseOverviewPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [stats, setStats] = useState(null);

  const courseMeta = useMemo(() => {
    const allCourses = [...(courses.joined || []), ...(courses.available || [])];
    return allCourses.find((c) => c.id === courseId) || null;
  }, [courses, courseId]);
  const courseOverview = useMemo(() => {
    const startDate = courseMeta?.start_date || null;
    const endDate = courseMeta?.end_date || null;
    const isExpired = Boolean(courseMeta?.read_only);
    const description =
      courseMeta?.course_summary ||
      courseMeta?.description ||
      courseMeta?.summary ||
      courseMeta?.overview ||
      "";
    const fallbackDescription = courseMeta
      ? `${courseMeta.course_code || "This course"} focuses on ${courseMeta.name || "core learning outcomes"}${
          courseMeta.term ? ` in ${courseMeta.term}` : ""
        }.`
      : "No course description is available yet.";
    return {
      startDate,
      endDate,
      validityLabel:
        startDate || endDate
          ? `${formatDateLabel(startDate)} — ${formatDateLabel(endDate)}`
          : "Not set",
      statusLabel: isExpired ? "Ended" : "Active",
      description: description || fallbackDescription,
    };
  }, [courseMeta]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    fetchCourses().catch(() => {});
  }, [authCheckComplete, authUser, navigate, fetchCourses]);

  useEffect(() => {
    if (!authUser || !Number.isFinite(courseId)) return;
    setStatus({ loading: true, error: "" });
    getJson(`/api/courses/${courseId}/posts/`)
      .then((data) => {
        const items = data.items || [];
        const interactions = items.reduce(
          (sum, post) =>
            sum + Number(post.likes_count || 0) + Number(post.comments_count || 0) + Number(post.views_count || 0),
          0
        );
        setStats({
          posts: items.length,
          interactions,
          recentPosts: items.slice(0, 5),
        });
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load course overview.",
        });
      });
  }, [authUser, courseId]);

  if (authCheckComplete && !authUser) {
    return <Navigate to="/login" replace />;
  }

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${courseMeta.term ? ` · ${courseMeta.term}` : ""}`
    : "Course overview";

  return (
    <AuthenticatedShell title="Course Overview" subtitle={subtitle}>
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading course overview...</p>
      ) : null}

      {!status.loading && stats ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Join Code
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">{courseMeta?.join_code || "—"}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Posts
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">{stats.posts}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total Interactions
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">{stats.interactions}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Course Details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-50 bg-brand-50/40 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Validity Period
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {courseOverview.validityLabel}
                </p>
              </div>
              <div className="rounded-xl border border-brand-50 bg-brand-50/40 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Course Status
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {courseOverview.statusLabel}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-brand-50 bg-brand-50/40 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Course Summary
              </p>
              <p className="mt-1 text-sm text-slate-700">{courseOverview.description}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
            {stats.recentPosts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No recent posts yet. Open Community to start discussion.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {stats.recentPosts.map((post) => (
                  <li key={post.id} className="rounded-xl border border-brand-50 bg-brand-50/40 px-3 py-2">
                    <p className="text-sm text-slate-700 line-clamp-2">{post.content || "No content"}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </AuthenticatedShell>
  );
}
