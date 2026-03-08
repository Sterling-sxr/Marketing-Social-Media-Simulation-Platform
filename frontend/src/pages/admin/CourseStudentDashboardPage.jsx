import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

const SUMMARY_TILES = [
  { key: "total_posts", label: "Total Posts", icon: "✏️" },
  { key: "total_likes", label: "Total Likes", icon: "👍" },
  { key: "total_comments", label: "Total Comments", icon: "💬" },
  { key: "total_views", label: "Total Views", icon: "👀" },
];

const SENTIMENT_COLORS = {
  positive: "bg-emerald-500",
  neutral: "bg-amber-500",
  negative: "bg-rose-500",
};

function SentimentBar({ label, value }) {
  const pct = Math.min(Math.max(value ?? 0, 0), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span className="capitalize">{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full bg-orange-100">
        <div
          className={`h-full rounded-full ${SENTIMENT_COLORS[label]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({ item, value }) {
  return (
    <div className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span>{item.label}</span>
        <span>{item.icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value ?? 0}</p>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { hour12: false });
}

export default function CourseStudentDashboardPage() {
  const { courseId: courseIdParam, studentId: studentIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const studentId = Number(studentIdParam);
  const { authUser, authCheckComplete } = useApp();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const isAdmin = useMemo(
    () => Boolean(authUser && (authUser.is_superuser || authUser.is_staff)),
    [authUser]
  );

  const canView = useMemo(() => {
    if (!authUser) return false;
    if (isAdmin) return true;
    return Number(authUser.id) === studentId;
  }, [authUser, isAdmin, studentId]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId) || !Number.isFinite(studentId)) {
      setStatus({ loading: false, error: "Invalid course or student id." });
      return;
    }
    if (!canView) {
      setStatus({ loading: false, error: "You do not have access to this student analytics." });
      return;
    }

    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/students/${studentId}/`)
      .then((payload) => {
        setData(payload.student || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load student analytics.",
        });
      });
  }, [authUser, authCheckComplete, canView, courseId, studentId, navigate]);

  if (authCheckComplete && authUser && !canView) {
    return <Navigate to="/courses" replace />;
  }

  const summary = data?.summary || {};
  const sentiment = data?.sentiment?.breakdown || {};
  const topPosts = data?.top_posts || [];
  const courseMeta = data?.course;
  const studentInfo = data?.student;

  const subtitleParts = [];
  if (courseMeta) {
    subtitleParts.push(`${courseMeta.course_code} · ${courseMeta.name}`);
    if (courseMeta.term) subtitleParts.push(courseMeta.term);
  }
  if (studentInfo?.name) {
    subtitleParts.push(studentInfo.name);
  }

  const subtitle = subtitleParts.join(" · ") || "Student analytics overview";

  return (
    <AuthenticatedShell title="Student Course Analytics" subtitle={subtitle}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <button
          type="button"
          className="rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
          onClick={() => navigate(`/dashboard/courses/${courseId}`)}
        >
          Course Dashboard
        </button>
        {courseMeta ? (
          <button
            type="button"
            className="rounded-full border border-brand bg-orange-100 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-orange-200"
            onClick={() => navigate(`/courses/${courseMeta.id}`)}
          >
            Open Course
          </button>
        ) : null}
        {studentInfo && (
          <button
            type="button"
            className="rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
            onClick={() => navigate(`/people/${studentInfo.id}`)}
          >
            View Profile
          </button>
        )}
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading student analytics...</p>
      ) : null}

      {data ? (
        <>
          {data.calculated_at ? (
            <p className="text-xs text-slate-500">
              Generated at: {formatDate(data.calculated_at)}
            </p>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUMMARY_TILES.map((item) => (
              <SummaryCard key={item.key} item={item} value={summary[item.key]} />
            ))}
          </section>

          <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              Student post sentiment distribution
            </h2>
            <p className="text-xs text-slate-500">
              Based on comments from this student's posts in the selected course.
            </p>
            <div className="mt-4 space-y-3">
              {Object.keys(SENTIMENT_COLORS).map((key) => (
                <SentimentBar key={key} label={key} value={sentiment[key] || 0} />
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Top Posts by Engagement
                </h2>
                <p className="text-xs text-slate-500">
                  Most engaging posts from this student, ranked by total interactions.
                </p>
              </div>
            </header>

            {topPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/80 px-4 py-6 text-sm text-slate-500">
                No posts found for this student in the selected course.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-orange-100">
                <table className="min-w-full divide-y divide-orange-100 text-sm">
                  <thead className="bg-orange-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Post</th>
                      <th className="px-4 py-3 font-semibold">Likes</th>
                      <th className="px-4 py-3 font-semibold">Comments</th>
                      <th className="px-4 py-3 font-semibold">Views</th>
                      <th className="px-4 py-3 font-semibold">Total Interactions</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50 bg-white/80">
                    {topPosts.map((post) => (
                      <tr key={post.post_id}>
                        <td className="px-4 py-3 text-slate-700">
                          {post.preview || "No content"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{post.likes}</td>
                        <td className="px-4 py-3 text-slate-600">{post.comments}</td>
                        <td className="px-4 py-3 text-slate-600">{post.views}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {post.interactions}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(post.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="rounded-full border border-brand bg-orange-100 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-orange-200"
                            onClick={() =>
                              navigate(`/courses/${courseId}/posts/${post.post_id}`)
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AuthenticatedShell>
  );
}
