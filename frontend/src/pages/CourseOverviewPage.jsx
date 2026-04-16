import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

export default function CourseOverviewPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [stats, setStats] = useState(null);

  const isTeacher = Boolean(authUser?.is_superuser || authUser?.is_staff);
  const courseMeta = useMemo(() => {
    const allCourses = [...(courses.joined || []), ...(courses.available || [])];
    return allCourses.find((c) => c.id === courseId) || null;
  }, [courses, courseId]);

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
            <h2 className="text-sm font-semibold text-slate-800">Next Steps</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
                onClick={() => navigate(`/courses/${courseId}/community`)}
              >
                Open Community
              </button>
              {isTeacher ? (
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                  onClick={() => navigate(`/dashboard/courses/${courseId}`)}
                >
                  View Course Analytics
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                onClick={() => navigate(`/courses/${courseId}/materials`)}
              >
                Open Materials
              </button>
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
