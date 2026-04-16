import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { getJson } from "../../lib/api";
import { resolveCourseScopedTarget } from "../../lib/courseScopeNavigation";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
// import { Sparkles, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
/* Dashboard chart palette aligned with global brand tokens */
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
  neutral: "text-accent-600",
  negative: "text-rose-600",
};

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
  const { pushToast } = useApp();
  const { authUser, authCheckComplete } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [showCoursesModal, setShowCoursesModal] = useState(false);
  const [sparkSummary, setSparkSummary] = useState("");
  const [sparkStatus, setSparkStatus] = useState({ loading: false, error: "" });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  );

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);
  const dashboardCourses = data?.courses || [];
  const handleNeedCourse = useCallback(() => {
    pushToast({
      title: "Course required",
      message: "Please create or join a course first.",
    });
  }, [pushToast]);
  const openCourseScoped = useCallback(
    (pathBuilder) => {
      const target = resolveCourseScopedTarget(dashboardCourses);
      if (target.state === "single" && target.courseId) {
        navigate(pathBuilder(target.courseId));
        return;
      }
      if (target.state === "multi") {
        navigate("/courses/manage");
        return;
      }
      handleNeedCourse();
    },
    [dashboardCourses, handleNeedCourse, navigate]
  );

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
  const courses = dashboardCourses;
  const topCourse = courses[0] || null;

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
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowCoursesModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <div className="pb-24 sm:pb-8">
          <section className="mt-1 rounded-3xl border border-brand-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-slate-800 sm:text-base">
              Insight Navigation
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Teaching Insights
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() =>
                      courses.length === 0 ? handleNeedCourse() : setShowCoursesModal(true)
                    }
                  >
                    Course Dashboard
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() =>
                      topCourse
                        ? navigate(`/dashboard/courses/${topCourse.id}/students`)
                        : handleNeedCourse()
                    }
                  >
                    Student Dashboard
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() =>
                      topCourse
                        ? navigate(`/dashboard/courses/${topCourse.id}`)
                        : handleNeedCourse()
                    }
                  >
                    Segmentation
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dashboard Actions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={reloadDashboard}
                    disabled={status.loading}
                  >
                    {status.loading ? "Refreshing..." : "Refresh"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() =>
                      topCourse ? navigate(`/courses/${topCourse.id}`) : openCourseScoped((id) => `/courses/${id}`)
                    }
                  >
                    View Course
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() =>
                      topCourse
                        ? navigate(`/courses/${topCourse.id}/community`)
                        : openCourseScoped((id) => `/courses/${id}/community`)
                    }
                  >
                    Open Community
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-brand-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-slate-800 sm:text-base">
              Recent Discussions Requiring Attention
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Jump directly into course-scoped community discussions.
            </p>
            {courses.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-500">
                No managed courses yet. Create or join a course first.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {courses.slice(0, 5).map((course) => (
                  <li
                    key={course.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-brand-50/40 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {course.course_code} · {course.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Interactions: {course.total_interactions || 0}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                      onClick={() => navigate(`/courses/${course.id}/community`)}
                    >
                      Open Community
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {lastUpdated ? (
            <div className="mt-1 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Last updated:{" "}
                {lastUpdated.toLocaleString("en-US", { hour12: false })}
              </p>
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                onClick={reloadDashboard}
                disabled={status.loading}
              >
                {status.loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          ) : null}

          {/* =============================== Summary tiles (KPI-inspired) =============================== */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
            {SUMMARY_TILES.map((tile) => {
              const Card = (
                <div
                  className={[
                    "rounded-2xl p-4 text-center select-none sm:p-6",
                    "border-[1px] border-accent-400 bg-white",
                    "transition-colors transition-transform duration-200 ease-out",
                    "hover:-translate-y-[2px]",
                    "hover:bg-gradient-to-br hover:from-brand-100 hover:to-accent-100 active:bg-brand-50",
                  ].join(" ")}
                  role="status"
                  aria-label={`${tile.label}: ${data?.[tile.key] ?? 0}`}
                >
                  <div className="text-sm text-slate-600 transition-colors sm:text-base hover:text-white">
                    {tile.label}
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900 transition-colors sm:text-3xl hover:text-white">
                    {data?.[tile.key] ?? 0}
                  </div>
                </div>
              );

              return tile.clickable ? (
                <button
                  key={tile.key}
                  type="button"
                  className="text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-200 rounded-2xl"
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

          {/* ====================== Course Comparison (BarChart) ====================== */}
          <section
            className="rounded-3xl shadow-sm mt-4"
            style={{
              border: `1px solid ${DONUT.border}`,
              background: "linear-gradient(135deg, #FFF1EB 0%, #FFFFFF 100%)",
            }}
          >
            <div className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-800 sm:text-2xl">
                Course Comparison Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Posts and interactions across different courses
              </p>

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
            </div>
          </section>

          {/* ======================= Sentiment ======================= */}
          <section
            className="rounded-3xl border border-brand-100 bg-white/90 mt-4 shadow-sm"
          >
            <div className="p-4 sm:p-6">
              <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
                Sentiment Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Supporting context for the overall tone across managed courses.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-brand-100 bg-white/90 p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
                  AI Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Supporting narrative generated from the same dashboard evidence.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                onClick={handleGenerateSummary}
                disabled={sparkStatus.loading}
              >
                {sparkStatus.loading ? "Generating..." : "Refresh AI summary"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-4 text-sm leading-6 text-slate-700">
              {sparkSummary || autoSummary}
            </div>
            {sparkStatus.error ? (
              <p className="mt-2 text-xs text-rose-600">
                {sparkStatus.error} Showing the built-in summary instead.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {/* ============================ Courses modal ============================ */}
      {showCoursesModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-0 sm:items-center sm:p-4"
          onClick={() => setShowCoursesModal(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[80vh] sm:max-w-xl sm:rounded-3xl"
            style={{ border: `1px solid ${DONUT.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-4"
              style={{ borderColor: DONUT.border, background: DONUT.peach50 }}
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-800 sm:text-xl">
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
                className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-300 bg-rose-100 text-xl font-bold text-rose-700 transition hover:bg-rose-300 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
                style={{
                  lineHeight: "1",
                }}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
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
                        className="flex w-full items-center justify-between px-4 py-4 text-left text-sm transition hover:bg-brand-50 active:bg-brand-100 sm:px-5"
                        onClick={() => {
                          setShowCoursesModal(false);
                          navigate(`/dashboard/courses/${course.id}`);
                        }}
                      >
                        <div className="min-w-0 pr-3">
                          <p className="truncate text-sm font-semibold text-slate-800 sm:text-[15px]">
                            {course.course_code} · {course.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {course.term}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-slate-500">
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

    </AuthenticatedShell>
  );
}
