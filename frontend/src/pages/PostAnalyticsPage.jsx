import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { getJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const METRICS = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "views", label: "Views" },
];

function SummaryCard({ title, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-brand bg-brand-50 text-brand shadow-sm"
          : "border-brand-100 bg-white text-slate-600 hover:border-brand hover:text-brand"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
    </button>
  );
}

function LineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50 text-sm text-slate-500">
        No data available for the selected range.
      </div>
    );
  }
  const padding = 16;
  const height = 180;
  const width = 560;

  const maxValue = data.reduce((acc, item) => Math.max(acc, item.count), 0);
  const safeMax = Math.max(1, maxValue);

  const points = data.map((item, index) => {
    const x =
      padding +
      ((width - padding * 2) * (data.length <= 1 ? 0 : index / (data.length - 1)));
    const y =
      height - padding - ((height - padding * 2) * item.count) / safeMax;
    return [x, y];
  });

  const polyline = points.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full text-brand"
      role="img"
      aria-label="Metric trend line chart"
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="url(#grid)"
        opacity="0.4"
      />
      <defs>
        <pattern
          id="grid"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(226, 232, 240, 0.6)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      {points.map(([x, y], idx) => (
        <circle
          key={`point-${idx}`}
          cx={x}
          cy={y}
          r="4"
          fill="white"
          stroke="currentColor"
          strokeWidth="2"
        />
      ))}
      {data.map((item, idx) => {
        const [x, y] = points[idx];
        return (
          <text
            key={`label-${item.date}`}
            x={x}
            y={height - 4}
            textAnchor="middle"
            className="text-[10px] fill-slate-400"
          >
            {item.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

function RadarChart({ comparison }) {
  const size = 360;
  const center = size / 2;
  const radius = size / 2 - 48;
  const metrics = METRICS;

  const postValues = metrics.map((metric) => comparison.post?.[metric.key] ?? 0);
  const avgValues = metrics.map((metric) => comparison.average?.[metric.key] ?? 0);
  const maxValue = Math.max(...postValues, ...avgValues, 1);

  const buildPoints = (values) =>
    values
      .map((value, index) => {
        const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
        const radiusFactor = (value / maxValue) * radius;
        const x = center + radiusFactor * Math.cos(angle);
        const y = center + radiusFactor * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");

  const axisLines = metrics.map((metric, index) => {
    const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return (
      <line
        key={`axis-${metric.key}`}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="rgba(148, 163, 184, 0.35)"
        strokeWidth="1"
      />
    );
  });

  return (
    <div className="max-w-md">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full text-brand"
        role="img"
        aria-label="Hashtag comparison radar chart"
      >
        {[1, 0.66, 0.33].map((factor) => (
          <circle
            key={`ring-${factor}`}
            cx={center}
            cy={center}
            r={radius * factor}
            fill={factor === 1 ? "rgba(248, 250, 252, 0.8)" : "none"}
            stroke="rgba(148, 163, 184, 0.35)"
            strokeWidth="1"
          />
        ))}
        {axisLines}
        <polyline
          points={buildPoints(avgValues)}
          fill="rgba(251, 191, 36, 0.15)"
          stroke="rgba(251, 191, 36, 0.6)"
          strokeWidth="2"
        />
        <polyline
          points={buildPoints(postValues)}
          fill="rgba(255, 99, 132, 0.2)"
          stroke="rgba(255, 99, 132, 0.7)"
          strokeWidth="2"
        />
        {metrics.map((metric, index) => {
          const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
      const labelRadius = radius + 36;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);
      const align = Math.abs(Math.cos(angle)) > 0.35 ? (Math.cos(angle) > 0 ? "start" : "end") : "middle";
          return (
            <text
              key={`label-${metric.key}`}
              x={x}
              y={y}
              textAnchor={align}
              className="text-[11px] fill-slate-500"
            >
              {metric.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" /> Post performance
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-accent-400" /> Hashtag average
        </span>
      </div>
    </div>
  );
}

function SentimentDistribution({ sentiment }) {
  const total = sentiment?.total_comments ?? 0;
  const counts = sentiment?.counts || {};
  const percentages = sentiment?.percentages || {};
  const bars = [
    { key: "positive", label: "Positive", bar: "bg-emerald-400" },
    { key: "neutral", label: "Neutral", bar: "bg-accent-400" },
    { key: "negative", label: "Negative", bar: "bg-rose-400" },
  ];

  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Student post sentiment distribution
        </h2>
        <p className="text-xs text-slate-500">
          Based on the classified sentiments of this post's comments.
        </p>
      </header>
      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
          No comments yet. Sentiment breakdown will appear once comments are added.
        </p>
      ) : (
        <div className="space-y-4">
          {bars.map((item) => {
            const percent = Number(percentages[item.key] ?? 0);
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>{item.label}</span>
                  <span>{percent.toFixed(1)}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-brand-50">
                  <div
                    className={`h-full rounded-full transition-all ${item.bar}`}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  {counts[item.key] || 0} comment{counts[item.key] === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function PostAnalyticsPage() {
  const { courseId: courseIdParam, postId: postIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const postId = Number(postIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete, pushToast } = useApp();

  const [analytics, setAnalytics] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [activeMetric, setActiveMetric] = useState("likes");
  const [activeHashtag, setActiveHashtag] = useState(null);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId) || !Number.isFinite(postId)) {
      setStatus({ loading: false, error: "Invalid post or course id." });
      return;
    }
    setStatus({ loading: true, error: "" });
    getJson(`/api/courses/${courseId}/posts/${postId}/analytics/`)
      .then((data) => {
        setAnalytics(data);
        if (data.hashtags && data.hashtags.length) {
          setActiveHashtag((prev) => prev || data.hashtags[0].hashtag);
        }
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load analytics.",
        });
      });
  }, [authUser, authCheckComplete, courseId, postId, navigate]);

  useEffect(() => {
    const list = analytics?.hashtags || [];
    if (!list.length) {
      if (activeHashtag !== null) setActiveHashtag(null);
      return;
    }
    const exists = list.some((item) => item.hashtag === activeHashtag);
    if (!exists) {
      setActiveHashtag(list[0].hashtag);
    }
  }, [analytics, activeHashtag]);

  const summaryCards = useMemo(() => {
    if (!analytics) return [];
    return METRICS.map((metric) => ({
      ...metric,
      value: analytics.totals?.[metric.key] ?? 0,
    }));
  }, [analytics]);

  const sentimentData = useMemo(() => {
    if (!analytics?.sentiment) {
      return {
        counts: { positive: 0, neutral: 0, negative: 0 },
        percentages: { positive: 0, neutral: 0, negative: 0 },
        total_comments: 0,
      };
    }
    const { counts = {}, percentages = {}, total_comments = 0 } = analytics.sentiment;
    return {
      counts: {
        positive: counts.positive ?? 0,
        neutral: counts.neutral ?? 0,
        negative: counts.negative ?? 0,
      },
      percentages: {
        positive: percentages.positive ?? 0,
        neutral: percentages.neutral ?? 0,
        negative: percentages.negative ?? 0,
      },
      total_comments: total_comments ?? 0,
    };
  }, [analytics]);

  const chartSeries = useMemo(() => {
    if (!analytics) return [];
    return analytics.series?.[activeMetric] || [];
  }, [analytics, activeMetric]);

  const hashtagComparisons = analytics?.hashtags || [];
  const activeComparison = useMemo(
    () => hashtagComparisons.find((item) => item.hashtag === activeHashtag),
    [hashtagComparisons, activeHashtag]
  );

  const pageTitle = "Post Analytics";
  const pageSubtitle = `Course #${courseId} · Post #${postId}`;

  return (
    <AuthenticatedShell title={pageTitle} subtitle={pageSubtitle}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <button
            type="button"
            className="rounded-full border border-brand bg-brand-100 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand-200"
            onClick={() => navigate(`/courses/${courseId}/posts/${postId}`)}
          >
            View Post
          </button>
        </div>
        {analytics ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
            onClick={() => {
              downloadJsonFile(
                `post-${postId}-analytics.json`,
                analytics
              );
              pushToast?.({
                title: "Download started",
                message: "JSON snapshot saved from the data already on this page.",
              });
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export JSON
          </button>
        ) : null}
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading analytics...</p>
      ) : null}

      {analytics ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.key}
                title={card.label}
                value={card.value}
                active={activeMetric === card.key}
                onClick={() => setActiveMetric(card.key)}
              />
            ))}
          </section>

          <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <header className="flex items-center justify-between pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {METRICS.find((m) => m.key === activeMetric)?.label} · 7-day trend
                </h2>
                <p className="text-xs text-slate-500">
                  {analytics.range?.start} → {analytics.range?.end}
                </p>
              </div>
            </header>
            <LineChart data={chartSeries} />
          </section>

          <section className="space-y-3 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Hashtag comparison
                </h2>
                <p className="text-xs text-slate-500">
                  Compare this post with the average engagement of other posts using the same hashtag.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {hashtagComparisons.map((item) => (
                  <button
                    key={item.hashtag}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      activeHashtag === item.hashtag
                        ? "bg-brand-100 text-brand"
                        : "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                    onClick={() => setActiveHashtag(item.hashtag)}
                  >
                    #{item.hashtag}
                  </button>
                ))}
              </div>
            </header>

            {hashtagComparisons.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
                No hashtags detected in this post.
              </p>
            ) : activeComparison ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  {METRICS.map((metric) => (
                    <div
                      key={metric.key}
                      className="flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {metric.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Average across {activeComparison.cohort_size} post
                          {activeComparison.cohort_size === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-rose-500">
                          Post: {activeComparison.post?.[metric.key] ?? 0}
                        </p>
                        <p className="text-slate-500">
                          Avg: {activeComparison.average?.[metric.key] ?? 0}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <RadarChart comparison={activeComparison} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a hashtag to view details.</p>
            )}
          </section>

          <SentimentDistribution sentiment={sentimentData} />
        </>
      ) : null}
    </AuthenticatedShell>
  );
}
