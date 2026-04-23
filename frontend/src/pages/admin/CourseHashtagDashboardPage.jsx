import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, ExternalLink, LayoutDashboard } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import { ViewPostAnalysisButton } from "../components/AnalyticsShared";

const SUMMARY_TILES = [
  { key: "total_posts", label: "Total Posts", icon: "✏️" },
  { key: "total_likes", label: "Total Likes", icon: "👍" },
  { key: "total_comments", label: "Total Comments", icon: "💬" },
  { key: "total_views", label: "Total Views", icon: "👀" },
];

function SummaryCard({ item, value }) {
  return (
    <div
      className={[
        "rounded-[28px] border border-brand-100/80 bg-white/90 p-5 shadow-sm",
        "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        <span>{item.label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-50 text-base shadow-inner">
          {item.icon}
        </span>
      </div>
      <p className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">
        {Number(value ?? 0).toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-slate-500">Posts using this tag in the selected course.</p>
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
  const authUserId = authUser?.id ?? null;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const isAdmin = useMemo(
    () => Boolean(authUser && (authUser.is_superuser || authUser.is_staff)),
    [authUser]
  );

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUserId) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate("/courses", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId) || !hashtag) {
      setStatus({ loading: false, error: "Invalid course or hashtag." });
      return;
    }

    setStatus({ loading: true, error: "" });
    const encoded = encodeURIComponent(hashtag);
    getJson(`/api/admin/dashboard/courses/${courseId}/hashtags/${encoded}/`)
      .then((payload) => {
        setData(payload.hashtag || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load hashtag analytics.",
        });
      });
  }, [authCheckComplete, authUserId, isAdmin, courseId, hashtag, navigate]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const summary = data?.summary || {};
  const topPosts = data?.top_posts || [];
  const courseMeta = data?.course;

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${courseMeta.term ? ` · ${courseMeta.term}` : ""}`
    : "Hashtag analytics overview";

  return (
    <AuthenticatedShell
      title={`#${hashtag}`}
      subtitle={subtitle}
      hideSidebar
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-brand-100/80 bg-white/90 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-50"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                onClick={() => navigate(`/dashboard/courses/${courseId}`)}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                Course Dashboard
              </button>
              {courseMeta ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-brand bg-brand-100 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand-200"
                  onClick={() => navigate(`/courses/${courseMeta.id}`)}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Open Course
                </button>
              ) : null}
            </div>

            {data?.calculated_at ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1.5 text-xs font-medium text-slate-500">
                <Clock3 className="h-3.5 w-3.5 text-brand-700" aria-hidden />
                Generated at {formatDate(data.calculated_at)}
              </div>
            ) : null}
          </div>
        </section>

        {status.error ? <Feedback error={status.error} /> : null}
        {status.loading ? (
          <div className="rounded-[28px] border border-brand-100 bg-white/85 px-5 py-6 text-sm text-slate-500 shadow-sm">
            Loading hashtag analytics...
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {SUMMARY_TILES.map((tile) => (
                <SummaryCard key={tile.key} item={tile} value={summary[tile.key]} />
              ))}
            </section>

            <section className="rounded-[32px] border border-brand-100/80 bg-white/92 p-5 shadow-sm sm:p-6">
              <header className="flex flex-col gap-3 border-b border-brand-100/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Top Posts by Engagement
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-500">
                    Most active posts using #{hashtag}, ranked by total interactions.
                  </p>
                </div>
              </header>

              {topPosts.length === 0 ? (
                <div className="mt-5 rounded-[24px] border border-dashed border-amber-200 bg-gradient-to-br from-amber-50 to-white px-5 py-8 text-sm text-slate-500">
                  No posts found for this hashtag.
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-[24px] border border-brand-100/90 bg-white">
                  <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
                    <table className="min-w-full divide-y divide-brand-100 text-sm">
                      <thead className="bg-brand-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Post</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Author</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Likes</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Comments</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Views</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Total Interactions</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold">Created</th>
                          <th className="sticky top-0 z-10 bg-brand-50/70 px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-50 bg-white/90">
                        {topPosts.map((post) => (
                          <tr key={post.post_id} className="align-top transition-colors hover:bg-brand-50/40">
                            <td className="max-w-xl px-4 py-4 text-slate-700">
                              <div className="line-clamp-3">{post.preview || "No content"}</div>
                            </td>
                            <td className="px-4 py-4 text-slate-700">{post.author_name}</td>
                            <td className="px-4 py-4 text-slate-600">{post.likes}</td>
                            <td className="px-4 py-4 text-slate-600">{post.comments}</td>
                            <td className="px-4 py-4 text-slate-600">{post.views}</td>
                            <td className="px-4 py-4 font-semibold text-slate-800">
                              {post.interactions}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                              {formatDate(post.created_at)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <ViewPostAnalysisButton
                                onClick={() =>
                                  navigate(
                                    `/courses/${courseId}/posts/${post.post_id}/analytics`
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AuthenticatedShell>
  );
}
