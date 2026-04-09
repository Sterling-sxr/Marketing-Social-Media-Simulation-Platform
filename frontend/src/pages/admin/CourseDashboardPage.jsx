import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

const SUMMARY_TILES = [
  { key: "total_posts", label: "Total Posts" },
  { key: "total_interactions", label: "Total Interactions" },
  { key: "registered_students", label: "Registered Students" },
];

/* ---------------------------- Shared button component ---------------------------- */
function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary", // primary / secondary / link
  className = "",
  disabled = false,
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand " +
    "active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

  const styles = {
    primary: "border border-brand bg-brand-100 text-brand hover:bg-brand-200",
    secondary:
      "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand",
    link:
      "border border-transparent bg-transparent text-brand underline decoration-dotted underline-offset-4 " +
      "hover:text-brand/80 hover:decoration-solid",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
/* -------------------------------------------------------------------- */

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function ChangeBadge({ value }) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
        —
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
        0%
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {formatPercent(value)}
    </span>
  );
}

/* ---------------------------- KPI Summary Card ---------------------------- */
function SummaryCard({ item, value, onClick }) {
  const card =
    "group rounded-2xl p-6 text-center select-none border border-accent-400 bg-white " +
    "transition-all duration-200 ease-out will-change-transform " +
    "hover:-translate-y-0.5 hover:shadow-md " +
    "hover:bg-gradient-to-br hover:from-brand-100 hover:to-accent-100";

  const inner = (
    <>
      <div className="text-base text-slate-600 transition-colors group-hover:text-white">
        {item.label}
      </div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900 transition-colors group-hover:text-white">
        {value ?? 0}
      </div>
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${card} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-200`}
      aria-label={`${item.label}: ${value ?? 0}`}
    >
      {inner}
    </button>
  ) : (
    <div
      className={card}
      role="status"
      aria-label={`${item.label}: ${value ?? 0}`}
    >
      {inner}
    </div>
  );
}
/* ------------------------------------------------------------------------- */

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function formatRate(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.0%";
  return `${(num * 100).toFixed(1)}%`;
}

function SegmentationCoverage({ coverage, overlapping }) {
  if (!coverage) return null;
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-slate-600">
      <p>
        Audience size: <span className="font-semibold text-slate-800">{coverage.total_audience ?? 0}</span>
        {" · "}
        Missing profile data: <span className="font-semibold text-slate-800">{coverage.missing_profile_count ?? 0}</span>
        {" · "}
        Unattributed interactions: <span className="font-semibold text-slate-800">{coverage.missing_actor_identity_count ?? 0}</span>
      </p>
      <p className="mt-1">
        {overlapping
          ? "Interest buckets overlap: a single student can appear in multiple interest segments."
          : "Each student appears in at most one bucket for this lens."}
      </p>
    </div>
  );
}

function SegmentBreakdownTable({ segments }) {
  if (!segments?.length) {
    return <EmptyState message="No segment data available for this lens yet." />;
  }
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
      <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] border-b border-accent-100">
            <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-slate-700">
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Segment</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Audience</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Engaged</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Views</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Likes</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">Comments</th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3 text-right">Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {segments.map((segment) => (
              <tr key={segment.key} className="odd:bg-white even:bg-brand-50/30">
                <td className="px-4 py-3 font-semibold text-slate-800">{segment.label}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{segment.audience_count}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{segment.engaged_user_count}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{segment.metrics?.views ?? 0}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{segment.metrics?.likes ?? 0}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{segment.metrics?.comments ?? 0}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand">{formatRate(segment.metrics?.engagement_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function capitalize(label) {
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SentimentCell({ sentiment }) {
  const breakdown = sentiment?.breakdown || {};
  const topLabel = sentiment?.top_label;
  const topPercent = sentiment?.top_percent;
  const totalComments = sentiment?.total_comments;

  const hasComments =
    typeof totalComments === "number"
      ? totalComments > 0
      : Object.values(breakdown).some(
          (value) => typeof value === "number" && value > 0
        );

  const formattedTopPercent =
    typeof topPercent === "number"
      ? `${topPercent.toFixed(1)}%`
      : topPercent ?? "";

  if (!hasComments) {
    return <div className="text-xs text-slate-400">No comments yet</div>;
  }

  return (
    <div>
      <p
        className={`text-sm font-semibold ${
          topLabel === "positive"
            ? "text-emerald-700"
            : topLabel === "negative"
            ? "text-rose-700"
            : "text-slate-600"
        }`}
      >
        {capitalize(topLabel)} · {formattedTopPercent}
      </p>
    </div>
  );
}

/* ---------------------------- Sorting helpers (default view) ---------------------------- */
function sortByNumeric(arr, key, asc) {
  const dir = asc ? 1 : -1;
  return [...arr].sort((a, b) => {
    const va = Number(a?.[key] ?? 0);
    const vb = Number(b?.[key] ?? 0);
    if (Number.isNaN(va) && Number.isNaN(vb)) return 0;
    if (Number.isNaN(va)) return 1; // Place NaN values at the end
    if (Number.isNaN(vb)) return -1;
    if (va === vb) return 0;
    return va > vb ? dir : -dir;
  });
}
/* -------------------------------------------------------------------- */

export default function CourseDashboardPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [selectedLens, setSelectedLens] = useState("interests");
  const [segmentation, setSegmentation] = useState(null);
  const [segmentationStatus, setSegmentationStatus] = useState({
    loading: true,
    error: "",
  });

  // Fixed default sorting (no interactive controls)
  const [hashtagSortKey] = useState("total_posts");
  const [hashtagAsc] = useState(false); // Desc by post count
  const [studentSortKey] = useState("posts_total");
  const [studentAsc] = useState(false); // Desc by post count

  const isAdmin = useMemo(
    () => Boolean(authUser && (authUser.is_superuser || authUser.is_staff)),
    [authUser]
  );

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate("/courses", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId)) {
      setStatus({ loading: false, error: "Invalid course id." });
      return;
    }

    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/`)
      .then((payload) => {
        setData(payload.course || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load course dashboard.",
        });
      });
  }, [authCheckComplete, authUser, isAdmin, courseId, navigate]);

  useEffect(() => {
    if (!authCheckComplete || !authUser || !isAdmin || !Number.isFinite(courseId)) return;
    setSegmentationStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/segmentation?lens=${encodeURIComponent(selectedLens)}`)
      .then((payload) => {
        setSegmentation(payload.segmentation || null);
        setSegmentationStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setSegmentation(null);
        setSegmentationStatus({
          loading: false,
          error: error.message || "Failed to load segmentation analytics.",
        });
      });
  }, [authCheckComplete, authUser, courseId, isAdmin, selectedLens]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const courseMeta = data?.course;
  const summary = data?.summary || {};
  const hashtagsRaw = data?.hashtags || [];
  const studentsRaw = data?.students || [];
  const lastUpdated = data?.calculated_at ? new Date(data.calculated_at) : null;

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${
        courseMeta.term ? ` · ${courseMeta.term}` : ""
      }`
    : "Course analytics overview";

  // Clicking the Total Posts tile routes to the course feed
  const goAllPosts = () => {
    if (courseMeta?.id) {
      navigate(`/courses/${courseMeta.id}`);
    }
  };

  // Apply the fixed default sorting
  const hashtags = useMemo(() => {
    if (!hashtagsRaw?.length) return [];
    return sortByNumeric(hashtagsRaw, hashtagSortKey, hashtagAsc);
  }, [hashtagsRaw, hashtagSortKey, hashtagAsc]);

  const students = useMemo(() => {
    if (!studentsRaw?.length) return [];
    return sortByNumeric(studentsRaw, studentSortKey, studentAsc);
  }, [studentsRaw, studentSortKey, studentAsc]);

  // Scroll into view when landing on the #students-section anchor
  useEffect(() => {
    if (location.hash === "#students-section") {
      const el = document.getElementById("students-section");
      if (el) {
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "start" }),
          0
        );
      }
    }
  }, []);

  return (
    <AuthenticatedShell
      title={
        <span className="text-[35px] md:text-[45px] leading-tight font-extrabold tracking-tight">
          Course Dashboard
        </span>
      }
      subtitle={subtitle}
    >
      {/* Top action buttons styled consistently */}
      <div className="flex items-center gap-2">
        <Btn variant="secondary" onClick={() => navigate(-1)}>
          ← Back
        </Btn>
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading course analytics...</p>
      ) : null}

      {data ? (
        <>
          {lastUpdated ? (
            <p className="text-xs text-slate-500">
              Last updated:{" "}
              {lastUpdated.toLocaleString("en-US", { hour12: false })}
            </p>
          ) : null}

          {/* KPI summary cards (only Total Posts is clickable) */}
          <section className="grid gap-4 sm:grid-cols-3">
            {SUMMARY_TILES.map((item) => (
              <SummaryCard
                key={item.key}
                item={item}
                value={summary[item.key]}
                onClick={item.key === "total_posts" ? goAllPosts : undefined}
              />
            ))}
          </section>

          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <header className="space-y-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Audience Segmentation</h2>
                <p className="text-sm text-slate-500">
                  Explain how different audience groups respond using stable persona-derived buckets.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(segmentation?.available_lenses || []).map((lens) => (
                  <button
                    key={lens.key}
                    type="button"
                    onClick={() => setSelectedLens(lens.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedLens === lens.key
                        ? "bg-brand-100 text-brand"
                        : "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                  >
                    {lens.label}
                  </button>
                ))}
              </div>
            </header>

            {segmentationStatus.error ? <Feedback error={segmentationStatus.error} /> : null}
            {segmentationStatus.loading ? (
              <p className="text-sm text-slate-500">Loading segmentation analytics...</p>
            ) : segmentation ? (
              <>
                <SegmentationCoverage
                  coverage={segmentation.coverage}
                  overlapping={segmentation.lens_meta?.overlapping}
                />
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-800">Course audience distribution</h3>
                    <SegmentBreakdownTable segments={segmentation.segments} />
                  </div>
                  <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-800">Insight summary</h3>
                      <p className="text-sm leading-6 text-slate-600 break-words">
                        {segmentation.insights?.summary_text || "Insights will appear once segment data is available."}
                      </p>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top segment</dt>
                        <dd className="mt-2 break-words font-semibold leading-6 text-slate-800">
                          {segmentation.insights?.top_segment?.label || "—"}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Under-engaged</dt>
                        <dd className="mt-2 break-words font-semibold leading-6 text-slate-800">
                          {segmentation.insights?.under_engaged_segment?.label || "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800">Post segment performance</h3>
                  {!segmentation.posts?.length ? (
                    <EmptyState message="No posts available for segment summaries yet." />
                  ) : (
                    <div className="grid gap-3">
                      {segmentation.posts.map((item) => (
                        <div
                          key={item.post_id}
                          className="rounded-2xl border border-brand-100 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.summary_text}</p>
                            </div>
                            <button
                              type="button"
                              className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                              onClick={() => navigate(`/courses/${courseId}/posts/${item.post_id}/analytics`)}
                            >
                              Open post analytics
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </>
            ) : null}
          </section>

          {/* --------------- Students table (styling polish) --------------- */}
          <section
            id="students-section"
            className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm"
          >
            <header className="mb-2">
              <h2 className="text-2xl font-bold text-slate-900">
                Student Performance Leaderboard
              </h2>
              <p className="text-sm text-slate-500">Ordered by posts (desc).</p>
            </header>

            {students.length === 0 ? (
              <EmptyState message="No student activity data available for this course yet." />
            ) : (
              <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
                <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead
                      className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb]
             border-b border-accent-100 shadow-sm"
                    >
                      <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-slate-600">
                        <th className="sticky top-0 z-10 w-16 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Rank</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Name</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Posts</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Total Interactions</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Sentiment</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3 text-right">WoW Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {students.map((item, idx) => (
                        <tr
                          key={item.user_id}
                          className="odd:bg-white even:bg-brand-50/30 hover:bg-brand-50/60 transition-colors"
                        >
                          <td className="px-5 py-4 font-mono tabular-nums font-bold">
                            <span
                              className={
                                idx === 0
                                  ? "text-[#0e050c]"
                                  : idx === 1
                                  ? "text-[#120811]"
                                  : idx === 2
                                  ? "text-[#161315]"
                                  : "text-slate-400"
                              }
                            >
                              {`No.${idx + 1}`}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-semibold">
                            <Btn
                              variant="link"
                              onClick={() =>
                                navigate(
                                  `/dashboard/courses/${courseId}/students/${item.user_id}`
                                )
                              }
                              className="px-0 py-0"
                            >
                              {item.name}
                            </Btn>
                          </td>
                          <td className="px-5 py-4 text-slate-700 font-mono tabular-nums">
                            {item.posts_total}
                          </td>
                          <td className="px-5 py-4 text-slate-700 font-mono tabular-nums">
                            {item.interactions_total}
                          </td>
                          <td className="px-5 py-4 text-slate-700">
                            <SentimentCell sentiment={item.sentiment} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <ChangeBadge value={item.change_percent} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ---------------- Hashtags table (styling polish) ---------------- */}
          <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <header className="mb-2">
              <h2 className="text-2xl font-bold text-slate-900">
                Most Active Topic Hashtags
              </h2>
              <p className="text-sm text-slate-500">
                Ordered by total posts (desc).
              </p>
            </header>

            {hashtags.length === 0 ? (
              <EmptyState message="No hashtag analytics available for this course yet." />
            ) : (
              <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
                <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead
                      className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb]
             border-b border-accent-100 shadow-sm"
                    >
                      <tr className="text-left text-[13px] font-semibold uppercase tracking-wider text-slate-900">
                        <th className="sticky top-0 z-10 w-16 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Rank</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Hashtag</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Total Posts</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Total Interactions</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3">Sentiment</th>
                        <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-5 py-3 text-right">WoW Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {hashtags.map((item, idx) => (
                        <tr
                          key={item.hashtag}
                          className="odd:bg-white even:bg-brand-50/30 hover:bg-brand-50/60 transition-colors"
                        >
                          <td className="px-5 py-4 font-mono tabular-nums font-bold">
                            <span
                              className={
                                idx === 0
                                  ? "text-[#0e050c]"
                                  : idx === 1
                                  ? "text-[#120811]"
                                  : idx === 2
                                  ? "text-[#161315]"
                                  : "text-slate-400"
                              }
                            >
                              {`No.${idx + 1}`}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-semibold">
                            <Btn
                              variant="link"
                              onClick={() =>
                                navigate(
                                  `/dashboard/courses/${courseId}/hashtags/${encodeURIComponent(
                                    item.hashtag
                                  )}`
                                )
                              }
                              className="px-0 py-0"
                            >
                              #{item.hashtag}
                            </Btn>
                          </td>
                          <td className="px-5 py-4 text-slate-700 font-mono tabular-nums">
                            {item.total_posts}
                          </td>
                          <td className="px-5 py-4 text-slate-700 font-mono tabular-nums">
                            {item.total_interactions}
                          </td>
                          <td className="px-5 py-4 text-slate-700">
                            <SentimentCell sentiment={item.sentiment} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <ChangeBadge value={item.change_percent} />
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
    </AuthenticatedShell>
  );
}
