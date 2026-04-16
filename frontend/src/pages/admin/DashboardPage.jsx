import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { getJson } from "../../lib/api";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
// Section summary: this block is documented for clarity.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function SectionCard({ title, subtitle, icon, children, tone = "default", right }) {
  const toneStyles =
    tone === "peach"
      ? "bg-[linear-gradient(135deg,#FFF1EB_0%,#FFFFFF_60%)] border-[#BDDDE7]"
      : tone === "mint"
      ? "bg-[linear-gradient(135deg,#EEF7F9_0%,#FFFFFF_60%)] border-brand-100"
      : "bg-white border-brand-100";

  return (
    <section
      className={`rounded-3xl border p-4 shadow-sm sm:p-6 ${toneStyles}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-brand-100 bg-white shadow-sm">
                <span className="text-lg" aria-hidden="true">
                  {icon}
                </span>
              </span>
            ) : null}
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              {title}
            </h2>
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
/* Section summary: this block is documented for clarity. */
const DONUT = {
  peach50: "#EEF7F9",
  peach100: "#DCEFF3",
  apricot80: "#D3F5EC",
  amber80: "#A9EADB",
  lavender50: "#E9F5F8",
  lilac300: "#78DBC4",
  peach300: "#62AFC3",
  rose50: "#FDE8E8",
  rose400: "#EF4444",
  amber600: "#0F8D76",
  pink600: "#206F88",
  slate600: "#475569",
  grid: "#DCEFF3",
  border: "#BDDDE7",
  borderStrong: "#62AFC3",
};

/* Section summary: this block is documented for clarity. */
const SUMMARY_TILES = [
  { key: "total_courses", label: "Courses", clickable: true },
  { key: "registered_students", label: "Students" },
  { key: "total_posts", label: "Total Posts" },
  { key: "total_interactions", label: "Total Interactions" },
];

/* Section summary: this block is documented for clarity. */
const SENTIMENT_TEXT_COLORS = {
  positive: "text-emerald-600",
  neutral: "text-accent-600",
  negative: "text-rose-600",
};

// Function summary: CompareTooltip drives this unit of behavior.
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

/* Function summary: makeAutoSummary drives this behavior. */
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

  // Section summary: this block is documented for clarity.
  courses.sort(
    (a, b) =>
      Number(b.total_interactions || 0) - Number(a.total_interactions || 0)
  );

  // Section summary: this block is documented for clarity.
  const top3 = courses.slice(0, 3).map((c) => ({
    id: c.id,
    code: c.course_code || String(c.id),
    name: c.name || "",
    posts: Number(c.total_posts || 0),
    inter: Number(c.total_interactions || 0),
    students: Number(c.registered_students || 0),
  }));

  // Section summary: this block is documented for clarity.
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

  // Section summary: this block is documented for clarity.
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

  // Section summary: this block is documented for clarity.
  lines.push(
    `Overview: ${totalCourses} course(s), ${totalStudents} student(s), ${totalPosts} post(s), and ${totalInter} interaction(s) recorded.`
  );

  // Section summary: this block is documented for clarity.
  if (sPos + sNeu + sNeg > 0) {
    lines.push(
      `Sentiment snapshot: ${sPos}% positive, ${sNeu}% neutral, ${sNeg}% negative.`
    );
  }

  // Section summary: this block is documented for clarity.
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

  // Section summary: this block is documented for clarity.
  if (bestEPP && bestEPP.value > 0) {
    lines.push(
      `Highest engagement per post: ${bestEPP.code}${
        bestEPP.name ? ` · ${bestEPP.name}` : ""
      } — ${bestEPP.value.toFixed(2)} interactions/post.`
    );
  }

  // Section summary: this block is documented for clarity.
  if (bestPPS && bestPPS.value > 0) {
    lines.push(
      `Strongest posting intensity: ${bestPPS.code}${
        bestPPS.name ? ` · ${bestPPS.name}` : ""
      } — ${bestPPS.value.toFixed(2)} posts/student.`
    );
  }

  // Section summary: this block is documented for clarity.
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
  const { pushToast } = useApp();
  const { authUser, authCheckComplete } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [sparkSummary, setSparkSummary] = useState("");
  const [sparkStatus, setSparkStatus] = useState({ loading: false, error: "" });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  );

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);
  const handleNeedCourse = useCallback(() => {
    pushToast({
      title: "Course required",
      message: "Please create or join a course first.",
    });
  }, [pushToast]);

  const reloadDashboard = useCallback(() => {
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
  }, []);

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
    reloadDashboard();
  }, [authUser, authCheckComplete, isAdmin, navigate, reloadDashboard]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const sentiment = data?.sentiment || {};
  const lastUpdated = data?.calculated_at ? new Date(data.calculated_at) : null;

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

  // Section summary: this block is documented for clarity.
  const autoSummary = useMemo(() => makeAutoSummary(data), [data]);
  const handleGenerateSummary = useCallback(() => {
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
  }, [data]);

  useEffect(() => {
    setSparkSummary("");
    setSparkStatus({ loading: false, error: "" });
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const barChartWidth = Math.max(compareData.length * 88, 560);

  return (
    <AuthenticatedShell
      title={
        <span className="text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl md:text-[45px]">
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
        <div className="space-y-4 pb-24 sm:space-y-5 sm:pb-8">
          {lastUpdated ? (
            <SectionCard
              title="Last Updated"
              subtitle={`Last updated: ${lastUpdated.toLocaleString("en-US", {
                hour12: false,
              })}`}
              icon="⏱️"
              right={
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                  onClick={reloadDashboard}
                  disabled={status.loading}
                >
                  {status.loading ? "Refreshing..." : "Refresh"}
                </button>
              }
            >
              <p className="text-sm text-slate-600">
                Use refresh if you recently changed course activity and want the latest insights.
              </p>
            </SectionCard>
          ) : null}

          {/* Section summary: this UI block is explained for clarity. */}
          <SectionCard
            title="Summary"
            subtitle="Key metrics across all managed courses."
            icon="📌"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {SUMMARY_TILES.map((tile) => (
                <div
                  key={tile.key}
                  className={[
                    "rounded-2xl p-4 text-center select-none",
                    "border border-accent-200 bg-white",
                    "transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm",
                  ].join(" ")}
                  role="status"
                  aria-label={`${tile.label}: ${data?.[tile.key] ?? 0}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {tile.label}
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900">
                    {data?.[tile.key] ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Section summary: this UI block is explained for clarity. */}
          <SectionCard
            title="Course Comparison Analysis"
            subtitle="Posts and interactions across different courses."
            icon="📊"
            tone="peach"
          >

              {compareData.length === 0 ? (
                <p className="text-sm text-slate-500 mt-3">
                  No course data available.
                </p>
              ) : (
                <div className="mt-4 w-full overflow-x-auto">
                  <div
                    className="h-[320px] min-w-[560px] sm:h-[380px]"
                    style={{ width: `${barChartWidth}px` }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={compareData}
                        margin={{
                          top: 10,
                          right: isMobile ? 8 : 20,
                          bottom: isMobile ? 48 : 28,
                          left: 0,
                        }}
                        barCategoryGap={isMobile ? 12 : 18}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={DONUT.grid}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: DONUT.slate600,
                            fontSize: isMobile ? 11 : 13,
                          }}
                          interval={0}
                          angle={0}
                          tickMargin={isMobile ? 10 : 12}
                        />
                        <YAxis
                          domain={yDomain}
                          tick={{
                            fill: DONUT.slate600,
                            fontSize: isMobile ? 11 : 13,
                          }}
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
                </div>
              )}
          </SectionCard>

          {/* Section summary: this UI block is explained for clarity. */}
          <SectionCard
            title="Sentiment Analysis"
            subtitle="Snapshot of overall tone across managed courses."
            icon="🙂"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { key: "positive", label: "Positive", value: sPos },
                { key: "neutral", label: "Neutral", value: sNeu },
                { key: "negative", label: "Negative", value: sNeg },
              ].map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-4"
                >
                  <div
                    className={`text-2xl font-extrabold tracking-tight ${
                      SENTIMENT_TEXT_COLORS[item.key]
                    }`}
                  >
                    {item.value}%
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-600">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="AI Summary"
            subtitle="Readable conclusions generated from dashboard evidence."
            icon="✨"
            right={
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                onClick={handleGenerateSummary}
                disabled={sparkStatus.loading}
              >
                {sparkStatus.loading ? "Generating..." : "Refresh AI summary"}
              </button>
            }
          >
            <div className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-4 text-sm leading-6 text-slate-700">
              {sparkSummary || autoSummary}
            </div>
            {sparkStatus.error ? (
              <p className="mt-2 text-xs text-rose-600">
                {sparkStatus.error} Showing the built-in summary instead.
              </p>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

    </AuthenticatedShell>
  );
}
