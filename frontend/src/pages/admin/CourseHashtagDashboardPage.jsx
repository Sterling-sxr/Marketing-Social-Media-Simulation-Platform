import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { isTeacherLike } from "../../lib/authRole";
import { fetchHashtagDashboard } from "../../lib/teacherAnalytics";
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
  neutral: "bg-accent-500",
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
      <div className="h-3 rounded-full bg-brand-100">
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
    <div className="rounded-3xl border border-brand-100 bg-white p-4 shadow-sm">
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

export default function CourseHashtagDashboardPage() {
  const { courseId: courseIdParam, hashtag: hashtagParam } = useParams();
  const courseId = Number(courseIdParam);
  const hashtag = decodeURIComponent(hashtagParam ?? "");
  const { authUser, authCheckComplete } = useApp();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const canManageAnalytics = useMemo(
    () => Boolean(authUser && isTeacherLike(authUser)),
    [authUser]
  );

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!canManageAnalytics) {
      navigate("/courses", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId) || !hashtag) {
      setStatus({ loading: false, error: "Invalid course or hashtag." });
      return;
    }

    setStatus({ loading: true, error: "" });
    fetchHashtagDashboard(courseId, hashtag)
      .then((payload) => {
        setData(payload);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load hashtag analytics.",
        });
      });
  }, [authUser, authCheckComplete, canManageAnalytics, courseId, hashtag, navigate]);

  if (authCheckComplete && authUser && !canManageAnalytics) {
    return <Navigate to="/courses" replace />;
  }

  const summary = data?.summary || {};
  const sentiment = data?.sentiment?.breakdown || {};
  const topPosts = data?.top_posts || [];
  const courseMeta = data?.course;

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${courseMeta.term ? ` · ${courseMeta.term}` : ""}`
    : "Hashtag analytics overview";

  return (
    <AuthenticatedShell
      title={`#${hashtag}`}
      subtitle={subtitle}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <button
          type="button"
          className="rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
          onClick={() => navigate(`/dashboard/courses/${courseId}`)}
        >
          Course Dashboard
        </button>
        {courseMeta ? (
          <button
            type="button"
            className="rounded-full border border-brand bg-brand-100 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand-200"
            onClick={() => navigate(`/courses/${courseMeta.id}`)}
          >
            Open Course
          </button>
        ) : null}
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading hashtag analytics...</p>
      ) : null}
      {data?.meta?.sourceKind === "fallback" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This hashtag view is currently using the fallback analytics contract.
        </div>
      ) : null}

      {data ? (
        <>
          {data.meta?.calculatedAt ? (
            <p className="text-xs text-slate-500">
              Generated at: {formatDate(data.meta.calculatedAt)}
            </p>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUMMARY_TILES.map((tile) => (
              <SummaryCard key={tile.key} item={tile} value={summary[tile.key]} />
            ))}
          </section>

          <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">
              Student post sentiment distribution
            </h2>
            <p className="text-xs text-slate-500">
              Based on comments from posts tagged with #{hashtag}.
            </p>
            <div className="mt-4 space-y-3">
              {Object.keys(SENTIMENT_COLORS).map((key) => (
                <SentimentBar key={key} label={key} value={sentiment[key] || 0} />
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Top Posts by Engagement
                </h2>
                <p className="text-xs text-slate-500">
                  Most active posts using #{hashtag}, ranked by total interactions.
                </p>
              </div>
            </header>

            {topPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/80 px-4 py-6 text-sm text-slate-500">
                No posts found for this hashtag.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-brand-100">
                <table className="min-w-full divide-y divide-brand-100 text-sm">
                  <thead className="bg-brand-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Post</th>
                      <th className="px-4 py-3 font-semibold">Author</th>
                      <th className="px-4 py-3 font-semibold">Likes</th>
                      <th className="px-4 py-3 font-semibold">Comments</th>
                      <th className="px-4 py-3 font-semibold">Views</th>
                      <th className="px-4 py-3 font-semibold">Total Interactions</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50 bg-white/80">
                    {topPosts.map((post) => (
                      <tr key={post.post_id}>
                        <td className="px-4 py-3 text-slate-700">
                          {post.preview || "No content"}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{post.author_name}</td>
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
                            className="rounded-full border border-brand bg-brand-100 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand-200"
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
