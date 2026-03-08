import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
// import { Sparkles, X } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip as RadarTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
// Added: floating-button icon
import { Sparkles } from "lucide-react";

/* ========================= Donut pastel palette (pink · orange · purple) ========================= */
const DONUT = {
  peach50: "#FFF1EB",
  peach100: "#FFE6DA",
  apricot80: "#FEE8D9",
  amber80: "#FDECC8",
  lavender50: "#EDEAFF",
  lilac300: "#C4B5FD",
  peach300: "#FDBA94",
  rose50: "#FDE7F1",
  rose400: "#FB7185",
  amber600: "#D97706",
  pink600: "#DB2777",
  slate600: "#475569",
  grid: "#F7E6DA",
  border: "#FFE4CC",
  borderStrong: "#F9C56F",
};

/* ========================= Summary tiles ========================= */
const SUMMARY_TILES = [
  { key: "total_courses", label: "Courses", clickable: true },
  { key: "registered_students", label: "Students" },
  { key: "total_posts", label: "Total Posts" },
  { key: "total_interactions", label: "Total Interactions" },
];

/* ========================= Sentiment colors ========================= */
const SENTIMENT_TEXT_COLORS = {
  positive: "text-emerald-600",
  neutral: "text-amber-600",
  negative: "text-rose-600",
};

// Kept for potential progress-bar fallback
function SentimentBar({ label, value }) {
  const pct = Math.min(Math.max(value ?? 0, 0), 100);
  const width = `${pct}%`;
  const SENTIMENT_COLORS = {
    positive: "bg-pink-500",
    neutral: "bg-amber-500",
    negative: "bg-rose-500",
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span className="capitalize">{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div
        className="h-3 rounded-full"
        style={{ backgroundColor: DONUT.peach50 }}
      >
        <div
          className={`h-full rounded-full ${SENTIMENT_COLORS[label]} transition-all`}
          style={{ width }}
        />
      </div>
    </div>
  );
}

// Custom tooltip (course name + two lines of data)
function CompareTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const courseName = payload[0]?.payload?.__fullname || label || "";
  const interactions =
    payload.find((p) => p.dataKey === "interactions")?.value ?? 0;
  const posts = payload.find((p) => p.dataKey === "posts")?.value ?? 0;
  return (
    <div
      className="rounded-2xl bg-white px-4 py-3 shadow-md"
      style={{ minWidth: 240, border: `1px solid ${DONUT.border}` }}
    >
      <div className="text-[15px] font-semibold text-slate-800 mb-1">
        {courseName}
      </div>
      <div className="text-[14px] leading-6">
        <div style={{ color: DONUT.peach300 }}>
          Interactions : {interactions}
        </div>
        <div style={{ color: DONUT.lilac300 }}>Posts : {posts}</div>
      </div>
    </div>
  );
}

/* ========================= Circular info badge component (new) ========================= */
function InfoBubble({ text }) {
  return (
    <div className="group relative inline-flex ml-2 align-middle">
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-[11px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-200"
        aria-label="More information"
      >
        ?
      </button>

      <div className="pointer-events-none absolute left-1/2 z-30 mt-2 w-64 -translate-x-1/2 rounded-xl bg-slate-900/95 px-3 py-2 text-xs text-slate-50 shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </div>
    </div>
  );
}

/* ========================= Auto summary generator ========================= */
function makeAutoSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return "No dashboard data available yet. Once activity is recorded, I’ll generate an automatic summary here.";
  }

  const totalCourses = Number(summary.total_courses ?? 0);
  const totalStudents = Number(summary.registered_students ?? 0);
  const totalPosts = Number(summary.total_posts ?? 0);
  const totalInter = Number(summary.total_interactions ?? 0);

  const sentiment = summary.sentiment || {};
  const sPos = Math.round(
    Math.min(Math.max(Number(sentiment.positive || 0), 0), 100)
  );
  const sNeu = Math.round(
    Math.min(Math.max(Number(sentiment.neutral || 0), 0), 100)
  );
  const sNeg = Math.round(
    Math.min(Math.max(Number(sentiment.negative || 0), 0), 100)
  );

  const courses = Array.isArray(summary.courses) ? summary.courses.slice() : [];

  // Sort descending by interactions
  courses.sort(
    (a, b) =>
      Number(b.total_interactions || 0) - Number(a.total_interactions || 0)
  );

  // Top 3 by interactions
  const top3 = courses.slice(0, 3).map((c) => ({
    id: c.id,
    code: c.course_code || String(c.id),
    name: c.name || "",
    posts: Number(c.total_posts || 0),
    inter: Number(c.total_interactions || 0),
    students: Number(c.registered_students || 0),
  }));

  // Highest engagement per post
  const engPerPostRanked = courses
    .map((c) => {
      const posts = Number(c.total_posts || 0);
      const inter = Number(c.total_interactions || 0);
      const val = posts > 0 ? inter / posts : 0;
      return {
        id: c.id,
        code: c.course_code || String(c.id),
        name: c.name || "",
        value: val,
      };
    })
    .sort((a, b) => b.value - a.value);

  const bestEPP = engPerPostRanked[0];

  // Highest posts per student
  const postsPerStudentRanked = courses
    .map((c) => {
      const posts = Number(c.total_posts || 0);
      const students = Number(c.registered_students || 0);
      const val = students > 0 ? posts / students : 0;
      return {
        id: c.id,
        code: c.course_code || String(c.id),
        name: c.name || "",
        value: val,
      };
    })
    .sort((a, b) => b.value - a.value);

  const bestPPS = postsPerStudentRanked[0];

  const lines = [];

  // Overview
  lines.push(
    `Overview: ${totalCourses} course(s), ${totalStudents} student(s), ${totalPosts} post(s), and ${totalInter} interaction(s) recorded.`
  );

  // Sentiment
  if (sPos + sNeu + sNeg > 0) {
    lines.push(
      `Sentiment snapshot: ${sPos}% positive, ${sNeu}% neutral, ${sNeg}% negative.`
    );
  }

  // Top3
  if (top3.length > 0) {
    const topDesc = top3
      .map(
        (c, i) =>
          `${i + 1}) ${c.code}${c.name ? ` · ${c.name}` : ""} — ${
            c.inter
          } interactions from ${c.posts} posts`
      )
      .join("; ");
    lines.push(`Top courses by interactions: ${topDesc}.`);
  } else {
    lines.push(`No course activity yet.`);
  }

  // Engagement per post highlight
  if (bestEPP && bestEPP.value > 0) {
    lines.push(
      `Highest engagement per post: ${bestEPP.code}${
        bestEPP.name ? ` · ${bestEPP.name}` : ""
      } — ${bestEPP.value.toFixed(2)} interactions/post.`
    );
  }

  // Posts per student highlight
  if (bestPPS && bestPPS.value > 0) {
    lines.push(
      `Strongest posting intensity: ${bestPPS.code}${
        bestPPS.name ? ` · ${bestPPS.name}` : ""
      } — ${bestPPS.value.toFixed(2)} posts/student.`
    );
  }

  // Recommendations (based on negative sentiment or low activity)
  const hasData = totalPosts > 0 || totalInter > 0;
  if (hasData) {
    if (sNeg >= 30) {
      lines.push(
        `Recommendation: investigate recurring pain points in negative threads and introduce quick-win fixes or office hours.`
      );
    } else if (totalPosts > 0 && totalInter / Math.max(totalPosts, 1) < 1) {
      lines.push(
        `Recommendation: encourage replies and reactions (e.g., pin engaging prompts, highlight best answers) to boost interactions per post.`
      );
    } else {
      lines.push(
        `Recommendation: sustain momentum by spotlighting top-performing posts and replicating their formats.`
      );
    }
  }

  return lines.join(" ");
}

export default function DashboardPage() {
  const { authUser, authCheckComplete } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [showCoursesModal, setShowCoursesModal] = useState(false);

  // Added: summary floating-button state
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sparkSummary, setSparkSummary] = useState("");
  const [sparkStatus, setSparkStatus] = useState({ loading: false, error: "" });

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
    setStatus({ loading: true, error: "" });
    getJson("/api/admin/dashboard/")
      .then((payload) => {
        setData(payload.summary || {});
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load dashboard.",
        });
      });
  }, [authUser, authCheckComplete, isAdmin, navigate]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const sentiment = data?.sentiment || {};
  const lastUpdated = data?.calculated_at ? new Date(data.calculated_at) : null;
  const courses = data?.courses || [];

  const sPos = Math.round(
    Math.min(Math.max(Number(sentiment.positive || 0), 0), 100)
  );
  const sNeu = Math.round(
    Math.min(Math.max(Number(sentiment.neutral || 0), 0), 100)
  );
  const sNeg = Math.round(
    Math.min(Math.max(Number(sentiment.negative || 0), 0), 100)
  );

  const compareData = (data?.courses || [])
    .slice()
    .sort(
      (a, b) =>
        Number(b.total_interactions || 0) - Number(a.total_interactions || 0)
    )
    .map((c) => ({
      name: c.course_code || c.name || String(c.id),
      __fullname: `${c.course_code ? c.course_code + " · " : ""}${
        c.name ?? ""
      }`.trim(),
      posts: Number(c.total_posts || 0),
      interactions: Number(c.total_interactions || 0),
    }));

  const maxY = Math.max(
    1,
    ...compareData.map((d) => Math.max(d.posts, d.interactions))
  );
  const yDomain = [0, Math.ceil(maxY / 100) * 100];

  // Added: auto-generated summary text (reacts to data)
  const autoSummary = useMemo(() => makeAutoSummary(data), [data]);
  const summaryPayloadKey = useMemo(() => JSON.stringify(data || {}), [data]);

  useEffect(() => {
    setSparkSummary("");
    setSparkStatus({ loading: false, error: "" });
  }, [summaryPayloadKey]);

  useEffect(() => {
    if (!showSummaryModal) return;
    setSparkStatus({ loading: true, error: "" });
    const controller = new AbortController();
    fetch("/api/ai/analyze/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "dashboard_spark_summary",
        payload: data || {},
      }),
      signal: controller.signal,
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const detail = await resp.json().catch(() => ({}));
          throw new Error(detail.error || "Failed to generate summary.");
        }
        return resp.json();
      })
      .then((payload) => {
        setSparkSummary(payload.summary || "");
        setSparkStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSparkSummary("");
        setSparkStatus({
          loading: false,
          error: error.message || "Unable to generate AI summary.",
        });
      });
    return () => controller.abort();
  }, [showSummaryModal, summaryPayloadKey, data]);

  useEffect(() => {
    setSparkSummary("");
    setSparkStatus({ loading: false, error: "" });
  }, [summaryPayloadKey]);

  // Shortcut: press ESC to close any modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowCoursesModal(false);
        setShowSummaryModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AuthenticatedShell
      title={
        <span className="text-[35px] md:text-[45px] leading-tight font-extrabold tracking-tight">
          Dashboard
        </span>
      }
      subtitle="Insights for your managed courses"
    >
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      ) : null}

      {!status.loading && data ? (
        <>
          {lastUpdated ? (
            <p className="text-xs text-slate-500">
              Last updated:{" "}
              {lastUpdated.toLocaleString("en-US", { hour12: false })}
            </p>
          ) : null}

          {/* =============================== Summary tiles (KPI-inspired) =============================== */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            {SUMMARY_TILES.map((tile) => {
              const Card = (
                <div
                  className={[
                    "rounded-2xl p-6 text-center select-none",
                    "border-[1px] border-amber-400 bg-white",
                    "transition-colors transition-transform duration-200 ease-out",
                    "hover:translate-y-[-2px]",
                    "hover:bg-gradient-to-br hover:from-orange-100 hover:to-violet-100",
                  ].join(" ")}
                  role="status"
                  aria-label={`${tile.label}: ${data?.[tile.key] ?? 0}`}
                >
                  <div className="text-base text-slate-600 hover:text-white transition-colors">
                    {tile.label}
                  </div>
                  <div className="mt-1 text-3xl font-extrabold text-slate-900 hover:text-white transition-colors">
                    {data?.[tile.key] ?? 0}
                  </div>
                </div>
              );

              return tile.clickable ? (
                <button
                  key={tile.key}
                  type="button"
                  className="text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 rounded-2xl"
                  onClick={() => {
                    if ((data?.courses || []).length === 0) return;
                    setShowCoursesModal(true);
                  }}
                >
                  {Card}
                </button>
              ) : (
                <div key={tile.key}>{Card}</div>
              );
            })}
          </section>

          {/* ======================= Sentiment ======================= */}
          <section
            className="rounded-3xl shadow-sm mt-4"
            style={{
              border: `1px solid ${DONUT.border}`,
              background: "#FFFFFF",
            }}
          >
            <div className="p-6">
              <h2 className="text-2xl font-semibold text-slate-800">
                Sentiment Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Student post sentiment distribution
              </p>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  { key: "positive", label: "Positive", value: sPos },
                  { key: "neutral", label: "Neutral", value: sNeu },
                  { key: "negative", label: "Negative", value: sNeg },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col items-center justify-center rounded-2xl py-8"
                    style={{ background: "rgba(255, 241, 235, 0.9)" }}
                  >
                    <div
                      className={`text-5xl font-extrabold tracking-tight ${
                        SENTIMENT_TEXT_COLORS[item.key]
                      }`}
                    >
                      {item.value}%
                    </div>
                    <div className="mt-2 text-base font-medium text-slate-600">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ====================== Course Comparison (BarChart) ====================== */}
          <section
            className="rounded-3xl shadow-sm mt-4"
            style={{
              border: `1px solid ${DONUT.border}`,
              background: "linear-gradient(135deg, #FFF1EB 0%, #FFFFFF 100%)",
            }}
          >
            <div className="p-6">
              <h2 className="flex items-center text-2xl font-semibold text-slate-800">
                Course Comparison Analysis
                <InfoBubble text="This bar chart compares how many posts and total interactions each course has. Taller bars indicate more activity and engagement in that course." />
              </h2>
              <p className="text-xs text-slate-500">
                Posts and interactions across different courses
              </p>

              {compareData.length === 0 ? (
                <p className="text-sm text-slate-500 mt-3">
                  No course data available.
                </p>
              ) : (
                <div className="mt-4 h-[380px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={compareData}
                      margin={{ top: 10, right: 20, bottom: 28, left: 0 }}
                      barCategoryGap={18}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={DONUT.grid}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: DONUT.slate600, fontSize: 13 }}
                        interval={0}
                        angle={0}
                        tickMargin={12}
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{ fill: DONUT.slate600, fontSize: 13 }}
                      />
                      <Tooltip content={<CompareTooltip />} />
                      <Bar
                        dataKey="posts"
                        name="Posts"
                        fill={DONUT.lilac300}
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="interactions"
                        name="Interactions"
                        fill={DONUT.peach300}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* ============================ Courses modal ============================ */}
      {showCoursesModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "transparent" }}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ border: `1px solid ${DONUT.border}` }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: DONUT.border, background: DONUT.peach50 }}
            >
              <div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Courses
                </h3>
                <p className="text-xs text-slate-500">
                  Select a course to view detailed analytics.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setShowCoursesModal(false)}
                className="rounded-full p-2 text-xl font-bold text-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 transition"
                style={{
                  background: "#FEE2E2", // Pale red base
                  border: "1px solid #FCA5A5", // Red border
                  lineHeight: "1",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FCA5A5"; // Darker red on hover
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#FEE2E2";
                  e.currentTarget.style.color = "#B91C1C";
                }}
              >
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {(data?.courses || []).length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-500">
                  No courses available.
                </p>
              ) : (
                <ul
                  className="divide-y"
                  style={{ borderColor: DONUT.peach100 }}
                >
                  {data.courses.map((course) => (
                    <li key={course.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition"
                        style={{ background: "white" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = DONUT.peach50;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                        }}
                        onClick={() => {
                          setShowCoursesModal(false);
                          navigate(`/dashboard/courses/${course.id}`);
                        }}
                      >
                        <div>
                          <p className="text-[15px] font-semibold text-slate-800">
                            {course.course_code} · {course.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {course.term}
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>Total posts: {course.total_posts}</p>
                          <p>Interactions: {course.total_interactions}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ====== Radar comparison chart ====== */}
      <section
        className="rounded-3xl shadow-sm mt-4"
        style={{ border: `1px solid ${DONUT.border}`, background: "#FFFFFF" }}
      >
        <div className="p-6">
          <h2 className="flex items-center text-2xl font-semibold text-slate-800">
            Course Comparison Radar
            <InfoBubble text="This radar chart normalizes each course on four dimensions: total posts, total interactions, interactions per post, and posts per student. Larger area suggests stronger overall engagement." />
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Compare each course across multiple engagement dimensions.
          </p>

          {courses.length === 0 ? (
            <p className="text-sm text-slate-500">No course data available.</p>
          ) : (
            (() => {
              const maxPosts = Math.max(
                1,
                ...courses.map((c) => Number(c.total_posts || 0))
              );
              const maxInter = Math.max(
                1,
                ...courses.map((c) => Number(c.total_interactions || 0))
              );

              const metrics = [
                "Posts",
                "Interactions",
                "Engagement/Post",
                "Post/Student",
              ];

              const radarData = metrics.map((metric) => {
                const row = { metric };
                courses.forEach((c) => {
                  const key = String(c.course_code || c.id);
                  const posts = Number(c.total_posts || 0);
                  const inter = Number(c.total_interactions || 0);
                  const students = Number(c.registered_students || 0);
                  const engPerPost = posts > 0 ? inter / posts : 0;
                  const perStudent = students > 0 ? posts / students : 0;

                  let value = 0;
                  let raw = 0;

                  if (metric === "Posts") {
                    value = posts / maxPosts;
                    raw = posts;
                  }
                  if (metric === "Interactions") {
                    value = inter / maxInter;
                    raw = inter;
                  }
                  if (metric === "Engagement/Post") {
                    value = Math.min(engPerPost / 10, 1);
                    raw = engPerPost;
                  }
                  if (metric === "Post/Student") {
                    value = Math.min(perStudent / 10, 1);
                    raw = perStudent;
                  }

                  row[key] = value;
                  row[`${key}__raw`] = raw;
                });
                return row;
              });

              return (
                <div className="w-full overflow-x-auto">
                  <div className="h-[440px] w-[720px] mx-auto">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="72%"
                      width={720}
                      height={420}
                      data={radarData}
                    >
                      <PolarGrid stroke={DONUT.grid} />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: "#64748b", fontSize: 13 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 1]}
                        tick={false}
                      />
                      {courses.map((c, i) => {
                        const hues = [280, 18, 320, 36, 260, 12];
                        const hue = hues[i % hues.length];
                        const color = `hsla(${hue}, 70%, 72%, 1)`;
                        return (
                          <Radar
                            key={String(c.course_code || c.id)}
                            name={`${c.course_code} · ${c.name}`}
                            dataKey={String(c.course_code || c.id)}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.22}
                            dot
                          />
                        );
                      })}
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <RadarTooltip
                        contentStyle={{
                          backgroundColor: "white",
                          borderRadius: 10,
                          border: `1px solid ${DONUT.border}`,
                          fontSize: 12,
                        }}
                        formatter={(val, _seriesName, ctx) => {
                          const metric = ctx?.payload?.metric;
                          const dataKey = ctx?.dataKey;
                          const raw = ctx?.payload?.[`${dataKey}__raw`];
                          if (metric === "Engagement/Post")
                            return [
                              `${(raw ?? 0).toFixed(2)} interactions/post`,
                              metric,
                            ];
                          if (metric === "Post/Student")
                            return [
                              `${(raw ?? 0).toFixed(2)} posts/student`,
                              metric,
                            ];
                          if (metric === "Posts" || metric === "Interactions")
                            return [`${raw ?? 0}`, metric];
                          return [`${(Number(val) * 100).toFixed(1)}%`, metric];
                        }}
                      />
                    </RadarChart>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </section>

      {/* ============ Floating Spark Summary ============ */}
      <button
        type="button"
        aria-label="Open auto summary"
        title="Spark Summary"
        onClick={() => setShowSummaryModal(true)}
        className={[
          "fixed z-40 right-6 bottom-6 h-14 w-14 rounded-full",
          "shadow-lg transition-all focus:outline-none focus-visible:ring-4",
          "flex items-center justify-center",
        ].join(" ")}
        style={{
          background:
            "conic-gradient(from 180deg, #FDBA94, #EDEAFF, #FFF1EB, #FDBA94)",
          border: `1px solid ${DONUT.borderStrong}`,
        }}
      >
        <Sparkles className="h-6 w-6 text-slate-800" aria-hidden="true" />
      </button>

      {/* ============ Summary modal ============ */}
      {showSummaryModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "transparent" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spark-summary-title"
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            style={{ border: `1px solid ${DONUT.border}` }}
          >
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{
                borderColor: DONUT.border,
                background: "linear-gradient(135deg, #FFE6DA 0%, #EDEAFF 100%)",
              }}
            >
              <div>
                <h3
                  id="spark-summary-title"
                  className="text-xl font-semibold text-slate-800"
                >
                  Spark Summary
                </h3>
                <p className="text-xs text-slate-500">
                  Auto-generated from your current dashboard data.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setShowSummaryModal(false)}
                className="rounded-full p-2 text-xl font-bold text-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 transition"
                style={{
                  background: "#FEE2E2",
                  border: "1px solid #FCA5A5",
                  lineHeight: "1",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FCA5A5";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#FEE2E2";
                  e.currentTarget.style.color = "#B91C1C";
                }}
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <div className="px-5 py-4">
                <div
                  className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800"
                  style={{
                    background: "#FFFFFF",
                    border: `1px solid ${DONUT.peach100}`,
                    minHeight: 120,
                  }}
                >
                  {sparkStatus.loading
                    ? "Generating AI summary..."
                    : sparkSummary || autoSummary}
                </div>
                {sparkStatus.error ? (
                  <p className="mt-2 text-xs text-red-500">
                    {sparkStatus.error} Using a fallback summary instead.
                  </p>
                ) : null}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition"
                    style={{
                      border: `1px solid ${DONUT.border}`,
                      background: DONUT.peach50,
                      color: DONUT.slate600,
                    }}
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        sparkSummary || autoSummary
                      );
                    }}
                    disabled={sparkStatus.loading}
                  >
                    Copy Summary
                  </button>
                  {lastUpdated ? (
                    <span className="text-xs text-slate-500">
                      Generated from data updated at{" "}
                      {lastUpdated.toLocaleString("en-US", { hour12: false })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
