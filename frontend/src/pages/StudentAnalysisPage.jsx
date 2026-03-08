import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { useApp } from "../context/AppContext";
import {
  Home,
  Bell,
  UserRound,
  Users,
  FileText,
  BookOpen,
  Wrench,
  LayoutDashboard,
  Heart,
  MessageCircle,
  Eye,
  BarChart3,
  Calendar,
  Clock,
  Hash,
} from "lucide-react";

/* ========================= Utility helpers ========================= */
function engagementRate(p) {
  const likes = Number(p.likes || 0);
  const comments = Number(p.comments || 0);
  const views = Math.max(1, Number(p.views || 0)); // Avoid divide-by-zero
  return (likes + comments) / views;
}

/* ========================= Shared components ========================= */
function KPI({ label, value }) {
  return (
    <div
      className={[
        "rounded-2xl p-6 text-center select-none",
        "border-[1px] border-amber-400 bg-white",
        "transition-colors transition-transform duration-200 ease-out",
        "hover:border-violet-30",
        "hover:bg-gradient-to-br hover:from-orange-100 hover:to-violet-100",
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

/* ============ Reusable SVG bar chart (size configurable) ============ */
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

  // Canvas
  const H = height;
  const PAD_L = 60,
    PAD_R = 16,
    PAD_T = 30,
    PAD_B = 44;
  const innerW = Math.max(560, canvasWidth - PAD_L - PAD_R);
  const W = innerW + PAD_L + PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Tick marks
  const yMax = Math.max(1, ...safe);
  const yTicks = 5;
  const yVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((yMax / yTicks) * i)
  );
  const toX = (i) => PAD_L + (i / 23) * innerW;
  const toY = (v) => PAD_T + innerH - (v / yMax) * innerH;

  // Line path
  const pts = safe.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  // Hover state
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
    <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
      <h5 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-violet-600">
        {title}
      </h5>
      {!hasData ? (
        <div className="h-44 grid place-items-center text-base text-slate-600 bg-amber-50 rounded-xl border border-dashed border-amber-200">
          No data yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
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

          {/* Grid + Y-axis ticks */}
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

          {/* Axis line */}
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

          {/* X-axis ticks (label every 2 hours) */}
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

          {/* Orange trend line */}
          <polyline
            points={pts}
            fill="none"
            stroke="#fb923c"
            strokeWidth="3.0"
            strokeLinejoin="round"
          />

          {/* Nodes */}
          {safe.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r="3.5" fill="#fb923c">
              <title>{`Hour ${i}: ${v}`}</title>
            </circle>
          ))}

          {/* Hover guide line + emphasis dot + tooltip (purple accent) */}
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

          {/* Axis title */}
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
  barColorClass = "fill-orange-400",
  hoverBarClass = "fill-violet-500",
  canvasWidth = 880,
  xTickStep = 1,
  maxLabelLen = 12,

  // Added: appearance controls
  tickFontSize = 16, // Axis tick font size (default 16)
  labelFontSize = 16, // Category label font size (default 16)
  valueFontSize = 18, // Value label font size (default 18)
  axisTitleFontSize = 16, // Axis title font size (default 16)
  gapPx = 24, // Gap between bars (default 24)
  barMaxWidth = 28, // Max width per bar (default 28; smaller -> thinner)
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const safeVals = (values || []).map((v) =>
    Number.isFinite(v) ? Number(v) : 0
  );
  const hasData = safeVals.some((v) => v > 0);
  const allIntegers = safeVals.every((v) => Number.isInteger(v));

  // ==== Y axis ====
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

  // ==== Canvas ====
  const H = height;
  const PAD_L = 70,
    PAD_R = 16,
    PAD_T = 34,
    PAD_B = 56;
  const innerW = Math.max(560, canvasWidth - PAD_L - PAD_R);
  const W = innerW + PAD_L + PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Bar widths: enforce a max value and configurable spacing
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
    <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-2xl font-semibold text-slate-800">{title}</h3>

      {!hasData ? (
        <div className="h-44 grid place-items-center text-base text-slate-600 bg-amber-50 rounded-xl border border-dashed border-amber-200">
          No data yet.
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Grid + Y-axis ticks */}
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

          {/* Axis line */}
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

          {/* Bars and labels (hover detail) */}
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

                {/* Top value labels (larger) */}
                <text
                  x={x + barW / 2}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize={valueFontSize}
                  fill={hovered ? "#7c3aed" : "#ca8a04"} // Hover purple / default yellow-600
                  fontWeight="800"
                >
                  {allIntegers ? v : valueFormatter(v)}
                </text>

                {/* X-axis labels (larger) */}
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

          {/* Axis title (larger) */}
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

/* ========================= Six analysis modules (per requested tweaks) ========================= */
// 1) Top 5 Most Engaging Posts
function TopPostsList({ posts, onOpenAnalytics }) {
  const top = useMemo(
    () =>
      posts
        .slice()
        .sort((a, b) => engagementRate(b) - engagementRate(a))
        .slice(0, 5),
    [posts]
  );

  if (!top.length)
    return (
      <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
        <h4 className="text-1xl font-semibold text-slate-800">
          Top 5 Most Engaging Posts
        </h4>
        <p className="mt-2 text-base text-slate-600">
          You haven't posted anything yet.
        </p>
      </section>
    );

  const maxER = engagementRate(top[0]);

  return (
    <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
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
                "rounded-2xl border border-amber-100 bg-amber-50/60 p-5",
                "transition-all duration-200 ease-out",
                "hover:bg-amber-100 hover:border-amber-300 hover:shadow-sm",
              ].join(" ")}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate  font-semibold text-slate-900 hover:text-violet-700 transition-colors">
                    {idx + 1}. {p.title || `(Post #${p.id})`}
                  </p>

                  <div className="mt-1 flex items-center flex-wrap gap-x-6 gap-y-1 text-base text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      <Heart size={16} className="text-amber-600" aria-hidden />
                      {p.likes ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle
                        size={16}
                        className="text-violet-600"
                        aria-hidden
                      />
                      {p.comments ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Eye size={16} className="text-sky-600" aria-hidden />
                      {p.views ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                      <BarChart3
                        size={16}
                        className="text-amber-300"
                        aria-hidden
                      />
                      <span>ER</span>
                      <span className="ml-0.5">{pct}%</span>
                    </span>
                  </div>
                </div>

                {p.course_id && p.id ? (
                  <button
                    className={[
                      "rounded-full border px-4 py-2 text-sm font-semibold",
                      "border-violet-400/50 text-violet-700",
                      "hover:bg-violet-500 hover:text-white transition-colors",
                    ].join(" ")}
                    onClick={() => onOpenAnalytics?.(p)}
                  >
                    View analytics
                  </button>
                ) : null}
              </div>

              <div className="mt-3 h-2.5 w-full rounded-full bg-slate-50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-300 via-fuchsia-300 to-indigo-300 transition-all"
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

// 2) Best Time to Post (vertical layout within one card, larger text)
function BestTimeSection({ posts }) {
  const byHour = useMemo(() => {
    const arr = Array(24).fill(0);
    posts.forEach((p) => {
      const dt = p.created_at ? new Date(p.created_at) : null;
      if (!dt || isNaN(dt)) return;
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
      if (!dt || isNaN(dt)) return;
      const dow = dt.getDay();
      const score = Number(p.likes || 0) + Number(p.comments || 0);
      arr[dow] += score;
    });
    return arr;
  }, [posts]);

  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm">
      <h4 className="text-2xl font-semibold text-slate-800">
        Best Time to Post
      </h4>
      <p className="text-sm text-slate-600 mb-4">
        Engagement is measured by{" "}
        <span className="font-semibold">likes + comments</span>.
      </p>

      <div className="space-y-8">
        {/* Hourly trend → line chart (orange primary, purple accent) */}
        <HourLineChart
          title="Best Hour to Post"
          values={byHour}
          height={200}
          canvasWidth={200}
          yLabel="Engagement (likes + comments)"
        />

        {/* Day-of-week trend → bar chart */}
        <BarChart
          title="Best Day to Post"
          labels={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]}
          values={byDay}
          xLabel="Day of week"
          yLabel="Engagement (likes + comments)"
          height={300}
          canvasWidth={400}
          barColorClass="fill-yellow-300" // Default pale yellow
          hoverBarClass="fill-amber-300" // Slightly deeper color on hover
          // Added: extra appearance parameters
          tickFontSize={15}
          labelFontSize={15}
          valueFontSize={15}
          axisTitleFontSize={15}
          gapPx={30} // Increased spacing
          barMaxWidth={80} // Use slimmer bars
        />
      </div>
    </section>
  );
}

/* ========================= Page component ========================= */
export default function StudentAnalysisPage() {
  const { authUser } = useApp();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load "My posts" plus analytics
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

  // Summary KPIs (Avg Engagement removed)
  const metrics = useMemo(() => {
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
    const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    return { totalPosts, totalLikes, totalComments, totalViews };
  }, [posts]);

  return (
    <AuthenticatedShell
      title="My Post Analysis"
      subtitle="Overview of your post performance."
    >
      {loading ? (
        <p className="text-slate-600 text-base">Loading…</p>
      ) : (
        <>
          {/* 🔢 Summary KPIs (four cards) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Posts" value={metrics.totalPosts} />
            <KPI label="Likes" value={metrics.totalLikes} />
            <KPI label="Comments" value={metrics.totalComments} />
            <KPI label="Views" value={metrics.totalViews} />
          </div>

          {/* ⭐ Top 5 Posts */}
          <TopPostsList
            posts={posts}
            onOpenAnalytics={(p) =>
              navigate(`/courses/${p.course_id}/posts/${p.id}/analytics`)
            }
          />

          {/* 🕒 Best Time to Post (vertical layout within one card) */}
          <BestTimeSection posts={posts} />

          {/* 📈 Personal Growth Trend (date axis + hover tooltip)
          <GrowthTrend posts={posts} /> */}
        </>
      )}
    </AuthenticatedShell>
  );
}
