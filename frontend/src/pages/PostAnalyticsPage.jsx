import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { getJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";
import {
  AnalyticsCoverageBanner,
  AnalyticsSegmentTable,
} from "./components/AnalyticsShared";

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

const SEGMENT_METRICS = [
  { key: "engagement_rate", label: "Engagement Rate" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
];

const SEGMENT_PIE_COLORS = ["#46B97A", "#4F86E8", "#8B5CF6", "#F2A06B", "#F87171"];

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatSegmentLegendValue(metricKey, value) {
  return metricKey === "engagement_rate"
    ? formatRate(value)
    : formatCount(value);
}

function SectionCard({ title, subtitle, children, tone = "default", right }) {
  const toneStyles =
    tone === "peach"
      ? "bg-[linear-gradient(135deg,#FFF7F2_0%,#FFFFFF_62%)] border-[#BDDDE7]"
      : tone === "mint"
      ? "bg-[linear-gradient(135deg,#F5FBFC_0%,#FFFFFF_62%)] border-brand-100"
      : "bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFEFE_100%)] border-brand-100";

  return (
    <section
      className={`rounded-[24px] border p-3.5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-4 ${toneStyles}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[17px]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-slate-500">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function SummaryCard({ title, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid min-h-[94px] rounded-[20px] border px-4 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition ${
        active
          ? "border-brand bg-[linear-gradient(135deg,#ECFDFC_0%,#FFFFFF_70%)] text-brand shadow-[0_10px_24px_rgba(29,175,146,0.12)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight text-slate-900">
        {formatCount(value)}
      </p>
      <p className="mt-2 text-[12px] text-slate-500">
        {active ? "Currently driving the trend chart below." : "Switch trend focus."}
      </p>
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
        const [x] = points[idx];
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
          const align =
            Math.abs(Math.cos(angle)) > 0.35
              ? (Math.cos(angle) > 0 ? "start" : "end")
              : "middle";
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

function formatRate(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.0%";
  return `${(num * 100).toFixed(1)}%`;
}

function formatMetricValue(metricKey, value) {
  if (metricKey === "engagement_rate") {
    return formatRate(value);
  }
  return `${Number(value ?? 0)}`;
}

function getSentimentInterpretation(percentages) {
  const entries = [
    { key: "positive", label: "positive" },
    { key: "neutral", label: "neutral" },
    { key: "negative", label: "negative" },
  ];
  const top = entries.reduce((best, current) =>
    Number(percentages?.[current.key] ?? 0) > Number(percentages?.[best.key] ?? 0)
      ? current
      : best
  );
  const share = Number(percentages?.[top.key] ?? 0).toFixed(1);
  return `Most comments were ${top.label}, making up ${share}% of the discussion.`;
}

function SentimentComposition({ sentiment }) {
  const total = sentiment?.total_comments ?? 0;
  const counts = sentiment?.counts || {};
  const percentages = sentiment?.percentages || {};
  const bars = [
    {
      key: "positive",
      label: "Positive",
      bar: "bg-emerald-400",
      text: "text-emerald-700",
    },
    {
      key: "neutral",
      label: "Neutral",
      bar: "bg-accent-400",
      text: "text-amber-700",
    },
    {
      key: "negative",
      label: "Negative",
      bar: "bg-rose-400",
      text: "text-rose-700",
    },
  ];

  return (
    <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-slate-800">Sentiment Composition</h3>
        <p className="text-xs text-slate-500">
          A quick view of the emotional balance in the comments for classroom discussion.
        </p>
      </header>
      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
          No comments yet. Sentiment breakdown will appear once comments are added.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
            <div
              className="flex h-6 overflow-hidden rounded-full bg-brand-50"
              role="img"
              aria-label="Sentiment composition chart"
            >
              {bars.map((item, index) => {
                const percent = Number(percentages[item.key] ?? 0);
                return (
                  <div
                    key={item.key}
                    className={`${item.bar} ${index === 0 ? "rounded-l-full" : ""} ${
                      index === bars.length - 1 ? "rounded-r-full" : ""
                    }`}
                    style={{ width: `${Math.max(0, percent)}%` }}
                    title={`${item.label}: ${counts[item.key] || 0} comments (${percent.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {bars.map((item) => {
                const percent = Number(percentages[item.key] ?? 0);
                return (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-brand-100 bg-white px-4 py-3"
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wide ${item.text}`}>
                      {item.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-800">
                      {percent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {counts[item.key] || 0} comment{counts[item.key] === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {getSentimentInterpretation(percentages)} Based on {total} classified
            comment{total === 1 ? "" : "s"}.
          </p>
        </>
      )}
    </section>
  );
}

function SegmentResponseChart({ segments, metricKey }) {
  if (!segments?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
        No segment data available for this post yet.
      </p>
    );
  }

  const ranked = [...segments].sort((a, b) => {
    const aValue = Number(a.metrics?.[metricKey] ?? 0);
    const bValue = Number(b.metrics?.[metricKey] ?? 0);
    return bValue - aValue;
  });
  const maxValue = Math.max(
    ...ranked.map((segment) => Number(segment.metrics?.[metricKey] ?? 0)),
    1
  );

  return (
    <div className="space-y-3">
      {ranked.map((segment) => {
        const rawValue = Number(segment.metrics?.[metricKey] ?? 0);
        const width = metricKey === "engagement_rate"
          ? Math.max(0, Math.min(100, rawValue * 100))
          : (rawValue / maxValue) * 100;
        return (
          <div key={segment.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-800">{segment.label}</span>
              <span className="text-slate-600">
                {formatMetricValue(metricKey, rawValue)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-brand-50">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SegmentSharePieChart({ segments, metricKey }) {
  const chartData = useMemo(() => {
    if (!segments?.length) return [];

    const withValues = segments
      .map((segment, index) => ({
        key: segment.key,
        label: segment.label,
        rawValue: Number(segment.metrics?.[metricKey] ?? 0),
        color: SEGMENT_PIE_COLORS[index % SEGMENT_PIE_COLORS.length],
      }))
      .filter((segment) => Number.isFinite(segment.rawValue) && segment.rawValue > 0);

    const total = withValues.reduce((sum, segment) => sum + segment.rawValue, 0);
    if (total <= 0) return [];

    return withValues.map((segment) => ({
      ...segment,
      percentage: (segment.rawValue / total) * 100,
    }));
  }, [metricKey, segments]);

  const activeMetric =
    SEGMENT_METRICS.find((metric) => metric.key === metricKey)?.label || "Metric";

  if (!segments?.length || chartData.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-brand-200 bg-white/80 px-4 py-5 text-sm text-slate-600">
        No pie breakdown is available for the selected audience metric yet.
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.rawValue, 0);

  return (
    <div className="rounded-[20px] border border-brand-100 bg-white/90 p-4">
      <div className="mb-3 space-y-1">
        <h4 className="text-sm font-semibold text-slate-800">Segment share</h4>
        <p className="text-xs text-slate-500">Based on {activeMetric}</p>
      </div>
      <div className="grid items-center gap-4 lg:grid-cols-[168px_minmax(0,1fr)]">
        <div className="relative mx-auto h-[160px] w-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="rawValue"
                innerRadius={44}
                outerRadius={68}
                paddingAngle={2}
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-[24px] font-extrabold leading-none tracking-tight text-slate-900">
              {formatSegmentLegendValue(metricKey, total)}
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          {chartData.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/30 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2 text-slate-700">
                <span
                  className="h-3 w-3 rounded-[4px]"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate font-semibold">{item.label}</span>
              </div>
              <div className="whitespace-nowrap text-right text-[13px] text-slate-600">
                <span className="font-semibold text-slate-800">
                  {formatSegmentLegendValue(metricKey, item.rawValue)}
                </span>
                <span className="ml-2 text-slate-400">({item.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function calculateDelta(postValue, averageValue) {
  const post = Number(postValue ?? 0);
  const average = Number(averageValue ?? 0);
  if (average === 0) {
    if (post === 0) return 0;
    return 100;
  }
  return ((post - average) / average) * 100;
}

function RelativePerformanceChart({ comparison }) {
  if (!comparison) {
    return (
      <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-600">
        No hashtag benchmark is available for this post yet.
      </p>
    );
  }

  const deltas = METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    delta: calculateDelta(
      comparison.post?.[metric.key],
      comparison.average?.[metric.key]
    ),
    postValue: Number(comparison.post?.[metric.key] ?? 0),
    averageValue: Number(comparison.average?.[metric.key] ?? 0),
  }));
  const maxDelta = Math.max(...deltas.map((item) => Math.abs(item.delta)), 1);
  const strongest = deltas.reduce((best, current) =>
    Math.abs(current.delta) > Math.abs(best.delta) ? current : best
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
        {deltas.map((item) => {
          const width = (Math.abs(item.delta) / maxDelta) * 100;
          const positive = item.delta >= 0;
          return (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">{item.label}</span>
                <span className={positive ? "text-emerald-700" : "text-rose-700"}>
                  {positive ? "+" : ""}
                  {item.delta.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-4 rounded-full bg-white">
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                <div
                  className={`absolute top-0 h-4 rounded-full ${
                    positive ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                  style={
                    positive
                      ? { left: "50%", width: `${Math.max(4, width / 2)}%` }
                      : { right: "50%", width: `${Math.max(4, width / 2)}%` }
                  }
                />
              </div>
              <p className="text-xs text-slate-500">
                Post {item.postValue} vs hashtag average {item.averageValue}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-slate-600">
        Against #{comparison.hashtag}, the strongest gap is in {strongest.label.toLowerCase()},
        which is {strongest.delta >= 0 ? "above" : "below"} the hashtag average by{" "}
        {Math.abs(strongest.delta).toFixed(1)}%.
      </p>
    </div>
  );
}

function ComparisonMatrix({ comparison }) {
  if (!comparison?.segments?.length) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{comparison.summary_text}</p>
      <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] border-b border-accent-100">
            <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-slate-700">
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">This Post</th>
              <th className="px-4 py-3">Compare Post</th>
              <th className="px-4 py-3 text-right">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {comparison.segments.map((segment) => (
              <tr key={segment.key} className="odd:bg-white even:bg-brand-50/30">
                <td className="px-4 py-3 font-semibold text-slate-800">{segment.label}</td>
                <td className="px-4 py-3 text-slate-700">{formatRate(segment.post_metrics?.engagement_rate)}</td>
                <td className="px-4 py-3 text-slate-700">{formatRate(segment.compare_metrics?.engagement_rate)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${segment.delta_engagement_rate >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {segment.delta_engagement_rate >= 0 ? "+" : ""}
                  {formatRate(segment.delta_engagement_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PostAnalyticsPage() {
  const { courseId: courseIdParam, postId: postIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const postId = Number(postIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete, pushToast } = useApp();
  const isAdmin = Boolean(authUser && (authUser.is_staff || authUser.is_superuser));

  const [analytics, setAnalytics] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [activeMetric, setActiveMetric] = useState("likes");
  const [activeSegmentMetric, setActiveSegmentMetric] = useState("engagement_rate");
  const [activeHashtag, setActiveHashtag] = useState(null);
  const [selectedLens, setSelectedLens] = useState("interests");
  const [comparePostId, setComparePostId] = useState("");
  const [showSegmentTable, setShowSegmentTable] = useState(false);
  const [showComparisonDetails, setShowComparisonDetails] = useState(false);
  const [segmentation, setSegmentation] = useState(null);
  const [segmentationStatus, setSegmentationStatus] = useState({
    loading: false,
    error: "",
  });

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

  useEffect(() => {
    if (!authCheckComplete || !authUser || !isAdmin) return;
    setSegmentationStatus({ loading: true, error: "" });
    const params = new URLSearchParams({ lens: selectedLens });
    if (comparePostId) {
      params.set("compare_post_id", comparePostId);
    }
    getJson(`/api/admin/courses/${courseId}/posts/${postId}/segmentation?${params.toString()}`)
      .then((payload) => {
        const next = payload.segmentation || null;
        setSegmentation(next);
        const options = next?.compare_options || [];
        const compareExists = options.some((item) => String(item.post_id) === String(comparePostId));
        if (!compareExists) {
          setComparePostId(options[0]?.post_id ? String(options[0].post_id) : "");
        }
        setSegmentationStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setSegmentation(null);
        setSegmentationStatus({
          loading: false,
          error: error.message || "Failed to load audience segmentation.",
        });
      });
  }, [authCheckComplete, authUser, comparePostId, courseId, isAdmin, postId, selectedLens]);

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
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          {pageTitle}
        </span>
      }
      subtitle={pageSubtitle}
      wideContent
      hideSidebar
    >

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading analytics...</p>
      ) : null}

      {analytics ? (
        <div className="space-y-3 pb-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-brand shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand"
                  onClick={() => navigate(`/courses/${courseId}/posts/${postId}`)}
                >
                  View Post
                </button>
              </div>
              <button
                type="button"
                className="inline-flex h-[44px] items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
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
                <Download className="h-4 w-4" aria-hidden />
                Export JSON
              </button>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <SummaryCard
                  key={card.key}
                  title={card.label}
                  value={card.value}
                  active={activeMetric === card.key}
                  onClick={() => setActiveMetric(card.key)}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <SectionCard
              title="Why It Performed This Way"
              subtitle="Use these teaching cues to explain why this post resonated, stalled, or drew mixed feedback."
              tone="peach"
            >
              <div className="grid gap-3">
                <SentimentComposition sentiment={sentimentData} />

                {isAdmin ? (
                  <SectionCard
                    title="Audience Segment Response"
                    subtitle="Show which persona-based audience buckets responded most strongly to this post."
                    tone="mint"
                  >
                    <div className="space-y-4">
                      <header className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {(segmentation?.available_lenses || []).map((lens) => (
                            <button
                              key={lens.key}
                              type="button"
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                selectedLens === lens.key
                                  ? "bg-brand-100 text-brand"
                                  : "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                              }`}
                              onClick={() => setSelectedLens(lens.key)}
                            >
                              {lens.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SEGMENT_METRICS.map((metric) => (
                            <button
                              key={metric.key}
                              type="button"
                              aria-pressed={activeSegmentMetric === metric.key}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                activeSegmentMetric === metric.key
                                  ? "bg-slate-800 text-white"
                                  : "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                              }`}
                              onClick={() => setActiveSegmentMetric(metric.key)}
                            >
                              {metric.label}
                            </button>
                          ))}
                        </div>
                      </header>

                      {segmentationStatus.error ? (
                        <Feedback error={segmentationStatus.error} />
                      ) : null}
                      {segmentationStatus.loading ? (
                        <p className="text-sm text-slate-500">Loading audience segmentation...</p>
                      ) : segmentation ? (
                        <>
                          <AnalyticsCoverageBanner
                            coverage={segmentation.coverage}
                            overlapping={segmentation.lens_meta?.overlapping}
                          />
                          <div className="rounded-[20px] border border-brand-100 bg-white p-4">
                            <p className="text-sm text-slate-700">
                              {segmentation.insights?.summary_text ||
                                "No insight summary available yet."}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                              <div className="rounded-2xl bg-brand-50/50 px-4 py-3">
                                <p className="text-slate-500">Top-performing segment</p>
                                <p className="mt-1 font-semibold text-slate-800">
                                  {segmentation.insights?.top_segment?.label || "—"}
                                </p>
                              </div>
                              <div className="rounded-2xl bg-brand-50/50 px-4 py-3">
                                <p className="text-slate-500">Under-engaged segment</p>
                                <p className="mt-1 font-semibold text-slate-800">
                                  {segmentation.insights?.under_engaged_segment?.label || "—"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
                            <SegmentSharePieChart
                              segments={segmentation.segments}
                              metricKey={activeSegmentMetric}
                            />
                            <div className="space-y-3 rounded-[20px] border border-brand-100 bg-white/90 p-4">
                              <div>
                                <h4 className="text-sm font-semibold text-slate-800">Performance ranking</h4>
                                <p className="mt-1 text-xs text-slate-500">
                                  Use the bar view to compare which segments are strongest in absolute terms.
                                </p>
                              </div>
                              <SegmentResponseChart
                                segments={segmentation.segments}
                                metricKey={activeSegmentMetric}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                              onClick={() => setShowSegmentTable((value) => !value)}
                            >
                              {showSegmentTable ? "Hide segment table" : "View segment table"}
                            </button>
                          </div>
                          {showSegmentTable ? (
                            <AnalyticsSegmentTable
                              segments={segmentation.segments}
                              emptyMessage="No segment data available for this post yet."
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </SectionCard>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Trend and Momentum"
              subtitle={`${METRICS.find((m) => m.key === activeMetric)?.label} across ${analytics.range?.start} → ${analytics.range?.end}`}
              tone="mint"
            >
              <LineChart data={chartSeries} />
            </SectionCard>
          </div>

          <SectionCard
            title="Relative Performance"
            subtitle="Compare this post against hashtag peers before moving into deeper case-to-case analysis."
          >
            <div className="space-y-4">
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
              <RelativePerformanceChart comparison={activeComparison} />
            </div>
          </SectionCard>

          <SectionCard
            title="Comparison Evidence"
            subtitle="Supporting visuals for when you want to go beyond the quick teaching view."
          >
            <div className="grid gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">Hashtag shape comparison</h3>
                    <p className="text-xs text-slate-500">
                      A secondary profile view of the same hashtag benchmark across likes, comments, and views.
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
                </div>

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
              </div>

              {isAdmin ? (
                <div className="space-y-3 rounded-[20px] border border-brand-100 bg-brand-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800">Compare with another post</h4>
                      <p className="text-xs text-slate-500">
                        Keep this optional so teachers can stay in the chart-first flow until they need evidence details.
                      </p>
                    </div>
                    <select
                      value={comparePostId}
                      onChange={(event) => setComparePostId(event.target.value)}
                      className="rounded-full border border-brand-200 bg-white px-4 py-2 text-sm text-slate-700"
                    >
                      <option value="">No comparison</option>
                      {(segmentation?.compare_options || []).map((item) => (
                        <option key={item.post_id} value={item.post_id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {segmentation?.insights?.comparison_summary_text ? (
                    <p className="text-sm text-slate-600">
                      {segmentation.insights.comparison_summary_text}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                      onClick={() => setShowComparisonDetails((value) => !value)}
                    >
                      {showComparisonDetails
                        ? "Hide comparison details"
                        : "View comparison details"}
                    </button>
                  </div>
                  {showComparisonDetails ? (
                    <ComparisonMatrix comparison={segmentation?.comparison} />
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
