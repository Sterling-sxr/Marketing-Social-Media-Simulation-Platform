import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { useApp } from "../context/AppContext";
import {
  Heart,
  MessageCircle,
  Eye,
  BarChart3,
  Download,
  Copy,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Filter,
  RotateCcw,
  Printer,
} from "lucide-react";

/* Function summary: engagementRate drives this behavior. */
function engagementRate(p) {
  const likes = Number(p.likes || 0);
  const comments = Number(p.comments || 0);
  const views = Math.max(1, Number(p.views || 0)); // Inline explanation: this statement is clarified for readability.
  return (likes + comments) / views;
}

function parsePostTime(p) {
  if (!p?.created_at) return null;
  const t = new Date(p.created_at).getTime();
  return Number.isNaN(t) ? null : t;
}

function startOfDayMs(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function endOfDayMs(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}

const SORT_OPTIONS = [
  { value: "engagement_desc", label: "Engagement rate (high → low)" },
  { value: "engagement_asc", label: "Engagement rate (low → high)" },
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "likes_desc", label: "Most likes" },
  { value: "views_desc", label: "Most views" },
];

function filterAndSortPosts(posts, f) {
  const {
    courseId,
    dateFrom,
    dateTo,
    erMin,
    erMax,
    sortKey = "engagement_desc",
  } = f;
  let list = posts.slice();

  if (courseId) {
    list = list.filter((p) => String(p.course_id) === String(courseId));
  }
  if (dateFrom) {
    const t0 = startOfDayMs(new Date(dateFrom));
    list = list.filter((p) => {
      const t = parsePostTime(p);
      return t != null && t >= t0;
    });
  }
  if (dateTo) {
    const t1 = endOfDayMs(new Date(dateTo));
    list = list.filter((p) => {
      const t = parsePostTime(p);
      return t != null && t <= t1;
    });
  }
  if (erMin !== "" && erMin != null && !Number.isNaN(Number(erMin))) {
    const v = Number(erMin) / 100;
    list = list.filter((p) => engagementRate(p) >= v);
  }
  if (erMax !== "" && erMax != null && !Number.isNaN(Number(erMax))) {
    const v = Number(erMax) / 100;
    list = list.filter((p) => engagementRate(p) <= v);
  }

  const sorters = {
    engagement_desc: (a, b) => engagementRate(b) - engagementRate(a),
    engagement_asc: (a, b) => engagementRate(a) - engagementRate(b),
    date_desc: (a, b) => (parsePostTime(b) ?? 0) - (parsePostTime(a) ?? 0),
    date_asc: (a, b) => (parsePostTime(a) ?? 0) - (parsePostTime(b) ?? 0),
    likes_desc: (a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0),
    views_desc: (a, b) => (Number(b.views) || 0) - (Number(a.views) || 0),
  };
  const cmp = sorters[sortKey] || sorters.engagement_desc;
  list.sort(cmp);
  return list;
}

const STORAGE_INSIGHTS_OPEN = "bread.studentAnalysis.insightsOpen";

function readStoredBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function writeStoredBool(key, value) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* Section summary: this block is documented for clarity. */
  }
}

function escapeCsvCell(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function postsToCsv(posts) {
  const headers = [
    "post_id",
    "course_id",
    "title",
    "created_at",
    "likes",
    "comments",
    "views",
    "engagement_rate",
    "hashtags",
  ];
  const lines = [headers.join(",")];
  for (const p of posts) {
    const er = engagementRate(p);
    const tags = (p.hashtags || []).map((t) => String(t).replace(/^#/, "")).join(";");
    lines.push(
      [
        p.id,
        p.course_id,
        escapeCsvCell(p.title),
        escapeCsvCell(p.created_at),
        p.likes ?? 0,
        p.comments ?? 0,
        p.views ?? 0,
        er.toFixed(4),
        escapeCsvCell(tags),
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

/* Function summary: computeLocalInsights drives this behavior. */
function computeLocalInsights(posts) {
  if (!posts.length) {
    return [
      "Once you have a few posts, this panel will highlight timing patterns and engagement ideas.",
    ];
  }

  const tips = [];
  const byHour = Array(24).fill(0);
  const byDay = Array(7).fill(0);
  posts.forEach((p) => {
    const dt = p.created_at ? new Date(p.created_at) : null;
    if (!dt || Number.isNaN(dt.getTime())) return;
    const score = Number(p.likes || 0) + Number(p.comments || 0);
    byHour[dt.getHours()] += score;
    byDay[dt.getDay()] += score;
  });

  const maxH = Math.max(...byHour);
  if (maxH > 0) {
    const bestHour = byHour.indexOf(maxH);
    tips.push(
      `Likes + comments cluster around ${bestHour}:00 (your local time). Consider posting more often near that hour.`
    );
  }

  const maxD = Math.max(...byDay);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (maxD > 0) {
    tips.push(
      `${dow[byDay.indexOf(maxD)]} shows the strongest total engagement in your history so far.`
    );
  }

  const sortedByEr = posts
    .map((p) => ({ p, er: engagementRate(p) }))
    .sort((a, b) => b.er - a.er);
  const best = sortedByEr[0];
  if (best && best.er > 0) {
    const label = (best.p.title || `Post #${best.p.id}`).slice(0, 72);
    tips.push(
      `Your highest engagement rate is on "${label}". Note topic, tone, and time — repeating that pattern may help.`
    );
  }

  const withViews = posts.filter((p) => Number(p.views || 0) > 0);
  const lowReach = withViews.filter((p) => engagementRate(p) < 0.02);
  if (withViews.length >= 3 && lowReach.length >= Math.ceil(withViews.length * 0.4)) {
    tips.push(
      "Several posts have views but very low likes or comments. Try a clearer call to action or a question at the end to invite replies."
    );
  }

  const tagCounts = {};
  posts.forEach((p) => {
    (p.hashtags || []).forEach((t) => {
      const k = String(t).replace(/^#/, "").toLowerCase();
      if (k) tagCounts[k] = (tagCounts[k] || 0) + 1;
    });
  });
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
  if (topTag) {
    tips.push(
      `You often use #${topTag[0]}. Open analytics on posts with and without it to see if it lines up with better reach.`
    );
  }

  return tips;
}

function buildAnalysisSummaryText(metrics, insightLines) {
  const lines = [
    "Bread — My Post Analysis (summary)",
    `Posts: ${metrics.totalPosts} · Likes: ${metrics.totalLikes} · Comments: ${metrics.totalComments} · Views: ${metrics.totalViews}`,
    "",
    "Suggestions (generated locally from your data):",
    ...insightLines.map((t, i) => `${i + 1}. ${t}`),
  ];
  return lines.join("\n");
}

function AnalysisToolbar({ posts, metrics, insightLines, pushToast }) {
  const onCsv = () => {
    if (!posts.length) {
      pushToast?.({
        title: "Nothing to export",
        message: "You have no posts to include in the CSV yet.",
      });
      return;
    }
    const name = `bread-post-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(name, postsToCsv(posts));
    pushToast?.({ title: "Download started", message: "Your CSV file should appear in your downloads folder." });
  };

  const onCopy = async () => {
    const text = buildAnalysisSummaryText(metrics, insightLines);
    try {
      await navigator.clipboard.writeText(text);
      pushToast?.({ title: "Copied", message: "Summary text is on the clipboard." });
    } catch {
      pushToast?.({
        title: "Copy failed",
        message: "Your browser blocked clipboard access. Try selecting and copying manually.",
      });
    }
  };

  return (
    <div className="print:hidden flex flex-wrap items-center gap-2 rounded-2xl border border-brand-100 bg-white/80 px-3 py-2 shadow-sm">
      <span className="text-xs font-semibold text-slate-500 mr-1">Local tools</span>
      <button
        type="button"
        onClick={onCsv}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Export CSV
      </button>
      <button
        type="button"
        onClick={() => void onCopy()}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Copy summary
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
        aria-label="Print this analysis page without navigation"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        Print
      </button>
    </div>
  );
}

function LocalInsightsSection({ lines }) {
  const [open, setOpen] = useState(() => readStoredBool(STORAGE_INSIGHTS_OPEN, true));

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      writeStoredBool(STORAGE_INSIGHTS_OPEN, next);
      return next;
    });
  };

  return (
    <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white p-6 shadow-sm">
      <button
        type="button"
        id="student-insights-toggle"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls="student-insights-panel"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Quick suggestions</h2>
            <p className="text-xs text-slate-500">
              Heuristic tips from your numbers only — no server changes required.
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400 shrink-0" aria-hidden />
        )}
      </button>
      {open ? (
        <ul
          id="student-insights-panel"
          role="region"
          aria-labelledby="student-insights-toggle"
          className="mt-4 space-y-3 text-sm text-slate-700"
        >
          {lines.map((line, i) => (
            <li
              key={i}
              className="flex gap-2 rounded-xl border border-amber-100/80 bg-white/70 px-3 py-2.5"
            >
              <span className="font-mono text-xs text-amber-700 tabular-nums">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* Function summary: KPI drives this behavior. */
function KPI({ label, value }) {
  return (
    <div
      className={[
        "rounded-2xl p-6 text-center select-none",
        "border-[1px] border-accent-400 bg-white",
        "transition-colors transition-transform duration-200 ease-out",
        "hover:border-accent-30",
        "hover:bg-gradient-to-br hover:from-brand-100 hover:to-accent-100",
        "focus-within:outline-none motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
      ].join(" ")}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className="text-base text-slate-600 hover:text-white transition-colors">
        {label}
      </div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900 hover:text-white transition-colors">
        {value}
      </div>
    </div>
  );
}

/* Function summary: HourLineChart drives this behavior. */
function HourLineChart({
  title = "Best Hour to Post",
  values = [],
  height = 340,
  canvasWidth = 880,
  yLabel = "Engagement (likes + comments)",
}) {
  const safe = Array.from({ length: 24 }, (_, h) =>
    Number.isFinite(values[h]) ? Number(values[h]) : 0
  );
  const hasData = safe.some((v) => v > 0);
  const peak = safe.reduce(
    (acc, v, i) => (v > acc.v ? { v, i } : acc),
    { v: -1, i: 0 }
  );
  const chartAriaLabel = !hasData
    ? `${title}: no engagement data yet.`
    : `${title}: likes plus comments totals by hour from 0 to 23. Peak at hour ${peak.i} with value ${peak.v}.`;

  // Section summary: this block is documented for clarity.
  const H = height;
  const PAD_L = 60,
    PAD_R = 16,
    PAD_T = 30,
    PAD_B = 44;
  const innerW = Math.max(560, canvasWidth - PAD_L - PAD_R);
  const W = innerW + PAD_L + PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Section summary: this block is documented for clarity.
  const yMax = Math.max(1, ...safe);
  const yTicks = 5;
  const yVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((yMax / yTicks) * i)
  );
  const toX = (i) => PAD_L + (i / 23) * innerW;
  const toY = (v) => PAD_T + innerH - (v / yMax) * innerH;

  // Section summary: this block is documented for clarity.
  const pts = safe.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Section summary: this block is documented for clarity.
  const [hoverIdx, setHoverIdx] = useState(null);
  const onMove = (e) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    const ratio = (loc.x - PAD_L) / innerW;
    const i = Math.round(ratio * 23);
    setHoverIdx(Math.max(0, Math.min(23, i)));
  };

  return (
    <section className="rounded-3xl border border-accent-100 bg-white p-6 shadow-sm">
      <h5 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-accent-600">
        {title}
      </h5>
      {!hasData ? (
        <div className="h-44 grid place-items-center text-base text-slate-600 bg-accent-50 rounded-xl border border-dashed border-accent-200">
          No data yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={chartAriaLabel}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <filter
              id="dotGlowHour"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="g" />
              <feMerge>
                <feMergeNode in="g" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Section summary: this UI block is explained for clarity. */}
          {yVals.map((t, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={toY(t)}
                y2={toY(t)}
                stroke="#f6d6b8"
                strokeDasharray="4 3"
                strokeWidth="1.2"
              />
              <text
                x={PAD_L - 8}
                y={toY(t) + 5}
                textAnchor="end"
                fontSize="14"
                fill="#475569"
              >
                {t}
              </text>
            </g>
          ))}

          {/* Section summary: this UI block is explained for clarity. */}
          <line
            x1={PAD_L}
            y1={PAD_T + innerH}
            x2={W - PAD_R}
            y2={PAD_T + innerH}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L}
            y2={PAD_T + innerH}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {/* Section summary: this UI block is explained for clarity. */}
          {Array.from({ length: 12 }, (_, k) => k * 2).map((h) => (
            <g key={`xh-${h}`}>
              <line
                x1={toX(h)}
                x2={toX(h)}
                y1={PAD_T + innerH}
                y2={PAD_T + innerH + 6}
                stroke="#cbd5e1"
                strokeWidth="1.2"
              />
              <text
                x={toX(h)}
                y={PAD_T + innerH + 22}
                textAnchor="middle"
                fontSize="14"
                fill="#475569"
              >
                {h}
              </text>
            </g>
          ))}

          {/* Section summary: this UI block is explained for clarity. */}
          <polyline
            points={pts}
            fill="none"
            stroke="#fb923c"
            strokeWidth="3.0"
            strokeLinejoin="round"
          />

          {/* Section summary: this UI block is explained for clarity. */}
          {safe.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r="3.5" fill="#fb923c">
              <title>{`Hour ${i}: ${v}`}</title>
            </circle>
          ))}

          {/* Section summary: this UI block is explained for clarity. */}
          {hoverIdx != null && (
            <>
              <line
                x1={toX(hoverIdx)}
                x2={toX(hoverIdx)}
                y1={PAD_T}
                y2={PAD_T + innerH}
                stroke="#7c3aed"
                strokeDasharray="4 3"
                strokeWidth="1.2"
                opacity="0.85"
              />
              <circle
                cx={toX(hoverIdx)}
                cy={toY(safe[hoverIdx])}
                r="7"
                fill="white"
                stroke="#6d28d9"
                strokeWidth="2"
                filter="url(#dotGlowHour)"
              />
              <g
                transform={`translate(${Math.min(
                  W - 200,
                  Math.max(PAD_L, toX(hoverIdx) + 12)
                )}, ${Math.max(PAD_T + 10, toY(safe[hoverIdx]) - 46)})`}
              >
                <rect
                  width="180"
                  height="44"
                  rx="10"
                  fill="white"
                  stroke="#a78bfa"
                  strokeWidth="1.2"
                />
                <text
                  x="12"
                  y="18"
                  fontSize="14"
                  fill="#0f172a"
                  fontWeight="600"
                >
                  Hour {hoverIdx}
                </text>
                <text x="12" y="34" fontSize="14" fill="#6d28d9">
                  Engagement: {safe[hoverIdx]}
                </text>
              </g>
            </>
          )}

          {/* Section summary: this UI block is explained for clarity. */}
          <text
            x={(PAD_L + (W - PAD_R)) / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize="14"
            fill="#334155"
          >
            Hour of day
          </text>
          <text
            x={16}
            y={(PAD_T + PAD_B + innerH) / 2}
            textAnchor="middle"
            fontSize="14"
            fill="#334155"
            transform={`rotate(-90 16 ${(PAD_T + PAD_B + innerH) / 2})`}
          >
            {yLabel}
          </text>
        </svg>
      )}
    </section>
  );
}

function BarChart({
  title,
  labels,
  values,
  height = 340,
  xLabel = "",
  yLabel = "",
  yMax,
  valueFormatter = (v) => v,
  barColorClass = "fill-brand-400",
  hoverBarClass = "fill-accent-500",
  canvasWidth = 880,
  xTickStep = 1,
  maxLabelLen = 12,

  // Section summary: this block is documented for clarity.
  tickFontSize = 16, // Inline explanation: this statement is clarified for readability.
  labelFontSize = 16, // Inline explanation: this statement is clarified for readability.
  valueFontSize = 18, // Inline explanation: this statement is clarified for readability.
  axisTitleFontSize = 16, // Inline explanation: this statement is clarified for readability.
  gapPx = 24, // Inline explanation: this statement is clarified for readability.
  barMaxWidth = 28, // Inline explanation: this statement is clarified for readability.
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const safeVals = (values || []).map((v) =>
    Number.isFinite(v) ? Number(v) : 0
  );
  const hasData = safeVals.some((v) => v > 0);
  const allIntegers = safeVals.every((v) => Number.isInteger(v));
  const chartAriaLabel = !hasData
    ? `${title}: no data yet.`
    : `${title}: bar chart with one bar per weekday showing engagement totals.`;

  // Section summary: this block is documented for clarity.
  let maxVal;
  if (Number.isFinite(yMax) && yMax > 0) {
    maxVal = yMax;
  } else if (allIntegers) {
    const maxInt = Math.max(1, ...safeVals);
    maxVal = Math.ceil(maxInt * 1.1);
  } else {
    maxVal = Math.max(1, ...safeVals);
  }

  let tickVals = [];
  if (allIntegers) {
    const maxInt = Math.ceil(maxVal);
    const step = Math.max(1, Math.ceil(maxInt / 6));
    const last = Math.ceil(maxInt / step) * step;
    tickVals = Array.from({ length: last / step + 1 }, (_, i) => i * step);
    maxVal = last;
  } else {
    const yTicks = 5;
    tickVals = Array.from(
      { length: yTicks + 1 },
      (_, i) => (maxVal / yTicks) * i
    );
  }

  // Section summary: this block is documented for clarity.
  const H = height;
  const PAD_L = 70,
    PAD_R = 16,
    PAD_T = 34,
    PAD_B = 56;
  const innerW = Math.max(560, canvasWidth - PAD_L - PAD_R);
  const W = innerW + PAD_L + PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Section summary: this block is documented for clarity.
  const computed = Math.floor(innerW / Math.max(1, labels.length)) - gapPx;
  const barW = Math.max(8, Math.min(barMaxWidth, computed));
  const gap = gapPx;

  const toY = (v) =>
    PAD_T + innerH - (Math.max(0, v) / Math.max(1e-9, maxVal)) * innerH;

  const trunc = (s) => {
    const str = String(s ?? "");
    return str.length > maxLabelLen ? str.slice(0, maxLabelLen - 1) + "…" : str;
  };

  return (
    <section className="rounded-3xl border border-accent-100 bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-2xl font-semibold text-slate-800">{title}</h3>

      {!hasData ? (
        <div className="h-44 grid place-items-center text-base text-slate-600 bg-accent-50 rounded-xl border border-dashed border-accent-200">
          No data yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={chartAriaLabel}
        >
          {/* Section summary: this UI block is explained for clarity. */}
          {tickVals.map((t, i) => (
            <g key={`g-${i}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={toY(t)}
                y2={toY(t)}
                stroke="#fde68a" /* Lighter yellow dashed grid */
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text
                x={PAD_L - 10}
                y={toY(t) + 6}
                textAnchor="end"
                fontSize={tickFontSize}
                fill="#334155"
              >
                {allIntegers ? String(t) : valueFormatter(t)}
              </text>
            </g>
          ))}

          {/* Section summary: this UI block is explained for clarity. */}
          <line
            x1={PAD_L}
            y1={PAD_T + innerH}
            x2={W - PAD_R}
            y2={PAD_T + innerH}
            stroke="#cbd5e1"
            strokeWidth="1.6"
          />
          <line
            x1={PAD_L}
            y1={PAD_T}
            x2={PAD_L}
            y2={PAD_T + innerH}
            stroke="#cbd5e1"
            strokeWidth="1.6"
          />

          {/* Section summary: this UI block is explained for clarity. */}
          {safeVals.map((v, i) => {
            const x = PAD_L + i * (barW + gap) + gap / 2;
            const y = toY(v);
            const h = PAD_T + innerH - y;
            const showLabel = i % Math.max(1, xTickStep) === 0;
            const hovered = i === hoverIdx;

            return (
              <g
                key={`b-${i}`}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="8"
                  className={hovered ? hoverBarClass : barColorClass}
                >
                  <title>
                    {labels[i]}: {allIntegers ? v : valueFormatter(v)}
                  </title>
                </rect>

                {/* Section summary: this UI block is explained for clarity. */}
                <text
                  x={x + barW / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize={valueFontSize}
                  fill={hovered ? "#7c3aed" : "#ca8a04"} // Inline explanation: this statement is clarified for readability.
                  fontWeight="800"
                >
                  {allIntegers ? v : valueFormatter(v)}
                </text>

                {/* Section summary: this UI block is explained for clarity. */}
                {showLabel && (
                  <text
                    x={x + barW / 2}
                    y={PAD_T + innerH + 24}
                    textAnchor="middle"
                    fontSize={labelFontSize}
                    fill={hovered ? "#0f172a" : "#334155"}
                  >
                    <tspan>{trunc(labels[i])}</tspan>
                    <title>{labels[i]}</title>
                  </text>
                )}
              </g>
            );
          })}

          {/* Section summary: this UI block is explained for clarity. */}
          {xLabel ? (
            <text
              x={(PAD_L + (W - PAD_R)) / 2}
              y={H - 10}
              textAnchor="middle"
              fontSize={axisTitleFontSize}
              fill="#334155"
            >
              {xLabel}
            </text>
          ) : null}
          {yLabel ? (
            <text
              x={18}
              y={(PAD_T + PAD_B + innerH) / 2}
              textAnchor="middle"
              fontSize={axisTitleFontSize}
              fill="#334155"
              transform={`rotate(-90 18 ${(PAD_T + PAD_B + innerH) / 2})`}
            >
              {yLabel}
            </text>
          ) : null}
        </svg>
      )}
    </section>
  );
}

function EmptyAnalysisGuidance() {
  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-dashed border-brand-300 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">No posts to analyze yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        After you publish in a course, your metrics and charts will appear here.
      </p>
      <ol className="mt-6 space-y-3 text-left text-sm text-slate-700">
        <li className="flex gap-2">
          <span className="font-mono text-brand">1.</span>
          <span>
            Open{" "}
            <Link
              to="/courses"
              className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark"
            >
              Course Center
            </Link>{" "}
            and enter a course.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-mono text-brand">2.</span>
          <span>Finish your course persona if the app asks — you need it before the feed unlocks.</span>
        </li>
        <li className="flex gap-2">
          <span className="font-mono text-brand">3.</span>
          <span>Publish a post in the course feed, then return to Analysis.</span>
        </li>
      </ol>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/courses"
          className="rounded-full border border-brand bg-brand-100 px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
        >
          Go to courses
        </Link>
        <Link
          to="/studenthome"
          className="rounded-full border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
        >
          Home
        </Link>
      </div>
    </section>
  );
}

function PostsFilterBar({
  courseOptions,
  courseId,
  setCourseId,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  erMin,
  setErMin,
  erMax,
  setErMax,
  sortKey,
  setSortKey,
  onReset,
  showingCount,
  totalCount,
}) {
  return (
    <section
      className="print:hidden rounded-3xl border border-brand-100 bg-white p-4 shadow-sm sm:p-5"
      aria-label="Filter and sort your posts"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-800">
          <Filter className="h-4 w-4 text-brand shrink-0" aria-hidden />
          <h2 className="text-base font-semibold">Filter &amp; sort</h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{showingCount}</span> of{" "}
        <span className="font-semibold text-slate-700">{totalCount}</span> posts (loaded in your browser).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Course
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            <option value="">All courses</option>
            {courseOptions.map((id) => (
              <option key={id} value={String(id)}>
                Course #{id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          From date
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          To date
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Min engagement rate (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            placeholder="e.g. 5"
            value={erMin}
            onChange={(e) => setErMin(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Max engagement rate (%)
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            placeholder="e.g. 80"
            value={erMax}
            onChange={(e) => setErMax(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function CompareMetric({ label, a, b }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-semibold text-slate-800">
        {a} <span className="mx-1 font-normal text-slate-400">vs</span> {b}
      </span>
    </div>
  );
}

function CompareTwoPosts({ posts, navigate }) {
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");

  const postA = posts.find((p) => String(p.id) === idA);
  const postB = posts.find((p) => String(p.id) === idB);

  if (posts.length < 2) return null;

  return (
    <section
      className="print:hidden rounded-3xl border border-brand-100 bg-white p-4 shadow-sm sm:p-6"
      aria-label="Compare two posts side by side"
    >
      <div className="mb-4 flex items-center gap-2">
        <GitCompare className="h-5 w-5 text-brand shrink-0" aria-hidden />
        <h2 className="text-lg font-semibold text-slate-800">Compare two posts</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Pick two posts (respects your filters). Metrics use engagement rate = (likes + comments) ÷ views.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Post A
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            <option value="">Select…</option>
            {posts.map((p) => (
              <option key={p.id} value={String(p.id)} disabled={String(p.id) === idB}>
                {(p.title || `Post #${p.id}`).slice(0, 56)}
                {p.title && p.title.length > 56 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Post B
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            <option value="">Select…</option>
            {posts.map((p) => (
              <option key={`b-${p.id}`} value={String(p.id)} disabled={String(p.id) === idA}>
                {(p.title || `Post #${p.id}`).slice(0, 56)}
                {p.title && p.title.length > 56 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {postA && postB ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[postA, postB].map((p, idx) => {
            const er = engagementRate(p);
            const pct = `${(er * 100).toFixed(1)}%`;
            return (
              <article
                key={p.id}
                className="flex flex-col rounded-2xl border border-accent-200 bg-accent-50/40 p-4"
                aria-label={idx === 0 ? "Post A details" : "Post B details"}
              >
                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                  {p.title || `Post #${p.id}`}
                </h3>
                <p className="mt-1 text-xs text-slate-500">Course #{p.course_id}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-600">Likes</dt>
                    <dd className="font-semibold tabular-nums">{p.likes ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-600">Comments</dt>
                    <dd className="font-semibold tabular-nums">{p.comments ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-600">Views</dt>
                    <dd className="font-semibold tabular-nums">{p.views ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-600">Engagement rate</dt>
                    <dd className="font-semibold tabular-nums text-accent-700">{pct}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="mt-4 rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                  onClick={() => navigate(`/courses/${p.course_id}/posts/${p.id}/analytics`)}
                >
                  Open analytics
                </button>
              </article>
            );
          })}
          <div className="md:col-span-2 space-y-2 rounded-2xl border border-dashed border-brand-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Side-by-side</p>
            <CompareMetric label="Likes" a={postA.likes ?? 0} b={postB.likes ?? 0} />
            <CompareMetric label="Comments" a={postA.comments ?? 0} b={postB.comments ?? 0} />
            <CompareMetric label="Views" a={postA.views ?? 0} b={postB.views ?? 0} />
            <CompareMetric
              label="Engagement %"
              a={(engagementRate(postA) * 100).toFixed(1)}
              b={(engagementRate(postB) * 100).toFixed(1)}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Choose two different posts to see a comparison.</p>
      )}
    </section>
  );
}

/* Section summary: this block is documented for clarity. */
// Function summary: TopPostsList drives this unit of behavior.
function TopPostsList({ posts, onOpenAnalytics, totalDatasetSize }) {
  const top = useMemo(
    () =>
      posts
        .slice()
        .sort((a, b) => engagementRate(b) - engagementRate(a))
        .slice(0, 5),
    [posts]
  );

  if (!top.length) {
    const narrowed = (totalDatasetSize ?? 0) > 0;
    return (
      <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
        <h4 className="text-1xl font-semibold text-slate-800">
          Top 5 Most Engaging Posts
        </h4>
        <p className="mt-2 text-base text-slate-600">
          {narrowed
            ? "No posts match your current filters. Adjust dates, course, or engagement range, or tap Reset."
            : "You haven't posted anything yet."}
        </p>
      </section>
    );
  }

  const maxER = engagementRate(top[0]);

  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
      <header className="mb-3">
        <h5 className="text-xl font-semibold text-slate-800">
          Top 5 Most Engaging Posts
        </h5>
        <p className="text-sm text-slate-600">
          Engagement = (Likes + Comments) / Views
        </p>
      </header>
      <ul className="space-y-3">
        {top.map((p, idx) => {
          const er = engagementRate(p);
          const pct = Math.round(er * 100);
          return (
            <li
              key={p.id}
              className={[
                "rounded-2xl border border-accent-100 bg-accent-50/60 p-5",
                "transition-all duration-200 ease-out",
                "hover:bg-accent-100 hover:border-accent-300 hover:shadow-sm",
              ].join(" ")}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate  font-semibold text-slate-900 hover:text-accent-700 transition-colors">
                    {idx + 1}. {p.title || `(Post #${p.id})`}
                  </p>

                  <div className="mt-1 flex items-center flex-wrap gap-x-6 gap-y-1 text-base text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Heart size={16} className="text-accent-600" aria-hidden />
                      {p.likes ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle
                        size={16}
                        className="text-accent-600"
                        aria-hidden
                      />
                      {p.comments ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Eye size={16} className="text-accent-600" aria-hidden />
                      {p.views ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-300 bg-accent-50 px-2 py-0.5 font-semibold text-accent-700">
                      <BarChart3
                        size={16}
                        className="text-accent-300"
                        aria-hidden
                      />
                      <span>ER</span>
                      <span className="ml-0.5">{pct}%</span>
                    </span>
                  </div>
                </div>

                {p.course_id && p.id ? (
                  <button
                    type="button"
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-semibold",
                      "border-accent-400/50 text-accent-700",
                      "hover:bg-accent-500 hover:text-white transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
                    ].join(" ")}
                    onClick={() => onOpenAnalytics?.(p)}
                  >
                    View analytics
                  </button>
                ) : null}
              </div>

              <div className="mt-3 h-2.5 w-full rounded-full bg-slate-50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-300 via-accent-300 to-indigo-300 transition-all"
                  style={{
                    width: `${Math.max(
                      6,
                      Math.min(
                        100,
                        Math.round((er / Math.max(0.001, maxER)) * 100)
                      )
                    )}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Function summary: BestTimeSection drives this unit of behavior.
function BestTimeSection({ posts }) {
  const byHour = useMemo(() => {
    const arr = Array(24).fill(0);
    posts.forEach((p) => {
      const dt = p.created_at ? new Date(p.created_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;
      const h = dt.getHours();
      const score = Number(p.likes || 0) + Number(p.comments || 0);
      arr[h] += score;
    });
    return arr;
  }, [posts]);

  const byDay = useMemo(() => {
    const arr = Array(7).fill(0);
    posts.forEach((p) => {
      const dt = p.created_at ? new Date(p.created_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;
      const dow = dt.getDay();
      const score = Number(p.likes || 0) + Number(p.comments || 0);
      arr[dow] += score;
    });
    return arr;
  }, [posts]);

  return (
    <section className="rounded-3xl border border-accent-100 bg-white p-6 shadow-sm">
      <h4 className="text-2xl font-semibold text-slate-800">
        Best Time to Post
      </h4>
      <p className="text-sm text-slate-600 mb-4">
        Engagement is measured by{" "}
        <span className="font-semibold">likes + comments</span>.
      </p>

      <div className="space-y-8">
        {/* Section summary: this UI block is explained for clarity. */}
        <HourLineChart
          title="Best Hour to Post"
          values={byHour}
          height={200}
          canvasWidth={200}
          yLabel="Engagement (likes + comments)"
        />

        {/* Section summary: this UI block is explained for clarity. */}
        <BarChart
          title="Best Day to Post"
          labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
          values={byDay}
          xLabel="Day of week"
          yLabel="Engagement (likes + comments)"
          height={300}
          canvasWidth={400}
          barColorClass="fill-yellow-300" // Inline explanation: this statement is clarified for readability.
          hoverBarClass="fill-accent-300" // Inline explanation: this statement is clarified for readability.
          // Section summary: this block is documented for clarity.
          tickFontSize={15}
          labelFontSize={15}
          valueFontSize={15}
          axisTitleFontSize={15}
          gapPx={30} // Inline explanation: this statement is clarified for readability.
          barMaxWidth={80} // Inline explanation: this statement is clarified for readability.
        />
      </div>
    </section>
  );
}

/* Function summary: StudentAnalysisPage drives this behavior. */
export default function StudentAnalysisPage() {
  const { authUser, pushToast } = useApp();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterCourseId, setFilterCourseId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterErMin, setFilterErMin] = useState("");
  const [filterErMax, setFilterErMax] = useState("");
  const [filterSortKey, setFilterSortKey] = useState("engagement_desc");

  const filterPayload = useMemo(
    () => ({
      courseId: filterCourseId,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      erMin: filterErMin,
      erMax: filterErMax,
      sortKey: filterSortKey,
    }),
    [
      filterCourseId,
      filterDateFrom,
      filterDateTo,
      filterErMin,
      filterErMax,
      filterSortKey,
    ]
  );

  const filteredPosts = useMemo(
    () => filterAndSortPosts(posts, filterPayload),
    [posts, filterPayload]
  );

  const courseOptions = useMemo(() => {
    const ids = new Set();
    posts.forEach((p) => {
      if (p.course_id != null) ids.add(p.course_id);
    });
    return Array.from(ids).sort((a, b) => Number(a) - Number(b));
  }, [posts]);

  const resetFilters = () => {
    setFilterCourseId("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterErMin("");
    setFilterErMax("");
    setFilterSortKey("engagement_desc");
  };

  // Section summary: this block is documented for clarity.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${authUser.id}/posts/analytics/`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`analytics list: HTTP ${res.status}`);
        const payload = await res.json();
        const rawItems = Array.isArray(payload)
          ? payload
          : payload.items || payload.posts || payload.results || [];

        const normalized = rawItems
          .map((item) => ({
            id: item.id ?? item.post_id,
            course_id: item.course_id ?? item.course?.id,
            title:
              item.title ||
              (typeof item.content === "string"
                ? item.content.slice(0, 60)
                : item.id
                ? `Post #${item.id}`
                : "Post"),
            content: item.content,
            created_at: item.created_at || item.created || item.date || null,
            hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
            likes: Number(item.likes || 0),
            comments: Number(item.comments || 0),
            views: Number(item.views || 0),
            sentiment:
              item.sentiment && typeof item.sentiment === "object"
                ? {
                    positive: Number(item.sentiment.positive || 0),
                    neutral: Number(item.sentiment.neutral || 0),
                    negative: Number(item.sentiment.negative || 0),
                  }
                : { positive: 0, neutral: 0, negative: 0 },
            _range: item.range || null,
          }))
          .filter((p) => p.id && p.course_id);

        if (!cancelled) {
          setPosts(normalized);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPosts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Section summary: this block is documented for clarity.
  const metrics = useMemo(() => {
    const totalPosts = filteredPosts.length;
    const totalLikes = filteredPosts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = filteredPosts.reduce((s, p) => s + (p.comments || 0), 0);
    const totalViews = filteredPosts.reduce((s, p) => s + (p.views || 0), 0);
    return { totalPosts, totalLikes, totalComments, totalViews };
  }, [filteredPosts]);

  const insightLines = useMemo(() => {
    if (posts.length > 0 && filteredPosts.length === 0) {
      return [
        "No posts match the current filter. Reset filters or widen the date or engagement range to see suggestions based on your data.",
      ];
    }
    return computeLocalInsights(filteredPosts);
  }, [posts.length, filteredPosts]);

  return (
    <AuthenticatedShell
      title="My Post Analysis"
      subtitle="Overview of your post performance. Filters apply only in your browser to the posts already loaded."
      printFriendlyChrome
    >
      {loading ? (
        <p className="text-slate-600 text-base">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyAnalysisGuidance />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <AnalysisToolbar
              posts={filteredPosts}
              metrics={metrics}
              insightLines={insightLines}
              pushToast={pushToast}
            />
          </div>

          <div className="mb-4">
            <PostsFilterBar
              courseOptions={courseOptions}
              courseId={filterCourseId}
              setCourseId={setFilterCourseId}
              dateFrom={filterDateFrom}
              setDateFrom={setFilterDateFrom}
              dateTo={filterDateTo}
              setDateTo={setFilterDateTo}
              erMin={filterErMin}
              setErMin={setFilterErMin}
              erMax={filterErMax}
              setErMax={setFilterErMax}
              sortKey={filterSortKey}
              setSortKey={setFilterSortKey}
              onReset={resetFilters}
              showingCount={filteredPosts.length}
              totalCount={posts.length}
            />
          </div>

          {filteredPosts.length === 0 ? (
            <div
              className="print:hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              No posts match these filters.{" "}
              <button
                type="button"
                onClick={resetFilters}
                className="font-semibold underline underline-offset-2 hover:text-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded"
              >
                Reset filters
              </button>{" "}
              to see all {posts.length} loaded post{posts.length === 1 ? "" : "s"}.
            </div>
          ) : null}

          {/* Section summary: this UI block is explained for clarity. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Posts" value={metrics.totalPosts} />
            <KPI label="Likes" value={metrics.totalLikes} />
            <KPI label="Comments" value={metrics.totalComments} />
            <KPI label="Views" value={metrics.totalViews} />
          </div>

          <div className="mt-4">
            <LocalInsightsSection lines={insightLines} />
          </div>

          <div className="mt-4">
            <CompareTwoPosts posts={filteredPosts} navigate={navigate} />
          </div>

          {/* Section summary: this UI block is explained for clarity. */}
          <div className="mt-4">
            <TopPostsList
              posts={filteredPosts}
              totalDatasetSize={posts.length}
              onOpenAnalytics={(p) =>
                navigate(`/courses/${p.course_id}/posts/${p.id}/analytics`)
              }
            />
          </div>

          {/* Section summary: this UI block is explained for clarity. */}
          <div className="mt-4">
            <BestTimeSection posts={filteredPosts} />
          </div>
        </>
      )}
    </AuthenticatedShell>
  );
}
