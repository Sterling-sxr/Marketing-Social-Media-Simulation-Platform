import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Frown,
  Lightbulb,
  Meh,
  MessageSquareText,
  Smile,
  Sparkles,
  Trophy,
  Users,
  GraduationCap,
  Zap,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import { getJson } from "../../lib/api";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

const RANGE_OPTIONS = [
  { value: 7, label: "This Week" },
  { value: 14, label: "Last 14 Days" },
  { value: 30, label: "Last 30 Days" },
  { value: 90, label: "Last 90 Days" },
];

const KPI_META = {
  total_courses: {
    icon: <GraduationCap className="h-4 w-4" />,
    tone: "bg-[#EEF4FF] text-[#3B82F6]",
  },
  registered_students: {
    icon: <Users className="h-4 w-4" />,
    tone: "bg-[#EEF8F3] text-[#46B97A]",
  },
  total_posts: {
    icon: <MessageSquareText className="h-4 w-4" />,
    tone: "bg-[#F4EBFF] text-[#8B5CF6]",
  },
  total_interactions: {
    icon: <Activity className="h-4 w-4" />,
    tone: "bg-[#FFF6E8] text-[#F59E0B]",
  },
};

const CHART = {
  posts: "#78DBC4",
  interactions: "#62AFC3",
  engagement: "#8B5CF6",
  grid: "#DCEFF3",
  border: "#BDDDE7",
  text: "#475569",
};

const DONUT_COLORS = ["#62C6A5", "#4F86E8", "#8B5CF6", "#F2A06B"];

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatRatio(value) {
  if (!Number.isFinite(value) || value <= 0) return "0.0x";
  return `${value.toFixed(1)}x`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

function formatShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function buildRangeLabel(summary, selectedRangeDays) {
  const option =
    RANGE_OPTIONS.find((item) => item.value === selectedRangeDays) || RANGE_OPTIONS[0];
  const startLabel = formatShortDate(summary?.range_start);
  const endLabel = formatShortDate(summary?.range_end);
  if (startLabel && endLabel) return `${option.label} (${startLabel} - ${endLabel})`;
  return option.label;
}

function splitSummaryLines(summary) {
  if (!summary) return [];
  return summary
    .split(/(?<=[.?!])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
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

function InsightItem({ eyebrow, title, detail }) {
  const iconTone =
    eyebrow === "Most Active"
      ? "bg-[#EEF8F3] text-[#46B97A]"
      : eyebrow === "Best Engagement"
      ? "bg-[#EEF4FF] text-[#3B82F6]"
      : eyebrow === "Coverage"
      ? "bg-[#FFF6E8] text-[#F59E0B]"
      : "bg-[#EEF4FF] text-[#3B82F6]";
  const icon =
    eyebrow === "Most Active" ? (
      <Trophy className="h-4 w-4" />
    ) : eyebrow === "Best Engagement" ? (
      <Zap className="h-4 w-4" />
    ) : (
      <Lightbulb className="h-4 w-4" />
    );

  return (
    <div className="rounded-[18px] border border-brand-100 bg-white/85 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${iconTone}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {eyebrow}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold leading-5 text-slate-900">
            {title}
          </div>
          {detail ? (
            <div className="mt-0.5 text-[12px] leading-5 text-slate-500">{detail}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailButton({ children }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center rounded-full border border-brand-100 bg-white px-4 text-[13px] font-semibold text-brand transition hover:border-brand"
    >
      {children}
      <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
    </button>
  );
}

function SummaryBullet({ text, tone = "default" }) {
  const dotClass =
    tone === "highlight"
      ? "bg-brand"
      : tone === "muted"
      ? "bg-slate-300"
      : "bg-accent-500";
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-white/70 px-3.5 py-2">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
      <p className="text-[13px] leading-5 text-slate-700">{text}</p>
    </div>
  );
}

function ActivityFeedItem({ icon, title, detail, meta, tone = "brand" }) {
  const toneStyles =
    tone === "mint"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : tone === "violet"
      ? "bg-violet-50 text-violet-600"
      : "bg-brand-50 text-brand";
  return (
    <div className="flex gap-3 rounded-[18px] border border-brand-100 bg-white/80 px-3 py-2">
      <div
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${toneStyles}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-slate-900">{title}</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {meta}
          </div>
        </div>
        <p className="mt-0.5 text-[12px] leading-[18px] text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function CompareTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const courseName = payload[0]?.payload?.__fullname || label || "";
  const posts = payload.find((item) => item.dataKey === "posts")?.value ?? 0;
  const interactions =
    payload.find((item) => item.dataKey === "interactions")?.value ?? 0;
  const engagementRate =
    payload.find((item) => item.dataKey === "engagementRate")?.value ?? 0;

  return (
    <div
      className="rounded-2xl bg-white px-4 py-3 shadow-md"
      style={{ minWidth: 220, border: `1px solid ${CHART.border}` }}
    >
      <div className="mb-1 text-[14px] font-semibold text-slate-800">{courseName}</div>
      <div className="space-y-0.5 text-[13px] leading-5">
        <div style={{ color: CHART.posts }}>Posts: {posts}</div>
        <div style={{ color: CHART.interactions }}>Interactions: {interactions}</div>
        <div style={{ color: CHART.engagement }}>
          Engagement: {formatRatio(Number(engagementRate))}
        </div>
      </div>
    </div>
  );
}

function makeAutoSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return "No dashboard data available yet. Once activity is recorded, I’ll generate an automatic summary here.";
  }

  const totalCourses = Number(summary.total_courses ?? 0);
  const totalStudents = Number(summary.registered_students ?? 0);
  const totalPosts = Number(summary.total_posts ?? 0);
  const totalInteractions = Number(summary.total_interactions ?? 0);
  const sentiment = summary.sentiment || {};
  const sPos = Math.round(Math.min(Math.max(Number(sentiment.positive || 0), 0), 100));
  const sNeu = Math.round(Math.min(Math.max(Number(sentiment.neutral || 0), 0), 100));
  const sNeg = Math.round(Math.min(Math.max(Number(sentiment.negative || 0), 0), 100));

  const courses = Array.isArray(summary.courses) ? summary.courses.slice() : [];
  courses.sort(
    (a, b) => Number(b.total_interactions || 0) - Number(a.total_interactions || 0)
  );
  const topCourse = courses[0];

  const lines = [
    `Overview: ${totalCourses} course(s), ${totalStudents} student(s), ${totalPosts} post(s), and ${totalInteractions} interaction(s) recorded.`,
  ];

  if (sPos + sNeu + sNeg > 0) {
    lines.push(
      `Sentiment snapshot: ${sPos}% positive, ${sNeu}% neutral, ${sNeg}% negative.`
    );
  }

  if (topCourse) {
    lines.push(
      `${topCourse.course_code || "Top course"} is currently leading activity with ${formatCount(
        topCourse.total_interactions
      )} interactions.`
    );
  }

  if (totalPosts > 0 || totalInteractions > 0) {
    lines.push(
      "Recommendation: sustain momentum by spotlighting top-performing posts and replicating their formats."
    );
  }

  return lines.join(" ");
}

export default function DashboardPage() {
  const { authUser, authCheckComplete } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [sparkSummary, setSparkSummary] = useState("");
  const [sparkStatus, setSparkStatus] = useState({ loading: false, error: "" });
  const [courseSort, setCourseSort] = useState("interactions_desc");
  const [selectedRangeDays, setSelectedRangeDays] = useState(7);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  );

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);

  const reloadDashboard = useCallback(() => {
    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/?range_days=${selectedRangeDays}`)
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
  }, [selectedRangeDays]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 639px)");
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setSparkSummary("");
    setSparkStatus({ loading: false, error: "" });
  }, [data]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const sentiment = data?.sentiment || {};
  const sPos = Math.round(Math.min(Math.max(Number(sentiment.positive || 0), 0), 100));
  const sNeu = Math.round(Math.min(Math.max(Number(sentiment.neutral || 0), 0), 100));
  const sNeg = Math.round(Math.min(Math.max(Number(sentiment.negative || 0), 0), 100));

  const courses = useMemo(
    () =>
      (data?.courses || []).map((course) => {
        const posts = Number(course.total_posts || 0);
        const interactions = Number(course.total_interactions || 0);
        const students = Number(course.registered_students || 0);
        return {
          ...course,
          posts,
          interactions,
          students,
          engagementRate: posts > 0 ? interactions / posts : 0,
        };
      }),
    [data]
  );

  const rankedByInteractions = useMemo(
    () => courses.slice().sort((a, b) => b.interactions - a.interactions),
    [courses]
  );
  const rankedByEngagement = useMemo(
    () => courses.slice().sort((a, b) => b.engagementRate - a.engagementRate),
    [courses]
  );
  const rankedByRecency = useMemo(
    () =>
      courses
        .slice()
        .sort(
          (a, b) =>
            new Date(b.calculated_at || 0).getTime() -
            new Date(a.calculated_at || 0).getTime()
        ),
    [courses]
  );

  const topCourse = rankedByInteractions[0] || null;
  const bestEngagementCourse = rankedByEngagement[0] || null;

  const totalCourses = Number(data?.total_courses || 0);
  const totalStudents = Number(data?.registered_students || 0);
  const totalPosts = Number(data?.total_posts || 0);
  const totalInteractions = Number(data?.total_interactions || 0);
  const totalLikes = Number(data?.total_likes || 0);
  const totalComments = Number(data?.total_comments || 0);
  const totalViews = Number(data?.total_views || 0);
  const activeCourses = courses.filter((course) => course.active).length;
  const activeCourseRate = totalCourses > 0 ? (activeCourses / totalCourses) * 100 : 0;
  const avgStudentsPerCourse = totalCourses > 0 ? totalStudents / totalCourses : 0;

  const topInsights = useMemo(() => {
    const items = [];
    if (topCourse) {
      items.push({
        eyebrow: "Most Active",
        title: `${topCourse.course_code || "Course"} leads with ${formatCount(
          topCourse.interactions
        )} interactions`,
      });
    }
    if (bestEngagementCourse && bestEngagementCourse.engagementRate > 0) {
      items.push({
        eyebrow: "Best Engagement",
        title: `${bestEngagementCourse.course_code || "Course"} tops engagement at ${formatRatio(
          bestEngagementCourse.engagementRate
        )} per post`,
      });
    }
    items.push({
      eyebrow: "Coverage",
      title: `${formatCount(activeCourses)} active course${
        activeCourses === 1 ? "" : "s"
      } contributing in the current range`,
    });
    return items.slice(0, 3);
  }, [activeCourses, bestEngagementCourse, topCourse]);

  const recentActivities = [
    topCourse
      ? {
          key: `top-${topCourse.id}`,
          icon: <Trophy className="h-4 w-4" />,
          title: `${topCourse.course_code || "Course"} is leading overall activity`,
          detail: `${formatCount(topCourse.interactions)} interactions recorded from ${formatCount(
            topCourse.posts
          )} posts.`,
          meta: "Top performer",
          tone: "amber",
        }
      : null,
    bestEngagementCourse
      ? {
          key: `eng-${bestEngagementCourse.id}`,
          icon: <Zap className="h-4 w-4" />,
          title: `${bestEngagementCourse.course_code || "Course"} has the best engagement rate`,
          detail: `${formatRatio(bestEngagementCourse.engagementRate)} interactions per post in the selected range.`,
          meta: "Engagement",
          tone: "mint",
        }
      : null,
    rankedByRecency[0]
      ? {
          key: `recent-${rankedByRecency[0].id}`,
          icon: <Clock3 className="h-4 w-4" />,
          title: `${rankedByRecency[0].course_code || "Course"} was refreshed most recently`,
          detail: rankedByRecency[0].calculated_at
            ? `Snapshot updated ${new Date(rankedByRecency[0].calculated_at).toLocaleString("en-US", {
                hour12: false,
              })}.`
            : "Waiting for first snapshot update.",
          meta: "Recent",
          tone: "violet",
        }
      : null,
  ].filter(Boolean);

  const engagementDistributionData = useMemo(() => {
    const base = [
      { label: "Likes", value: totalLikes },
      { label: "Comments", value: totalComments },
      { label: "Views", value: totalViews },
    ];
    const knownTotal = base.reduce((sum, item) => sum + item.value, 0);
    const other = Math.max(totalInteractions - knownTotal, 0);
    const items = [...base, { label: "Other", value: other }];
    const effectiveTotal = Math.max(
      items.reduce((sum, item) => sum + item.value, 0),
      totalInteractions,
      1
    );
    return items.map((item, index) => ({
      ...item,
      color: DONUT_COLORS[index],
      percentage: effectiveTotal > 0 ? (item.value / effectiveTotal) * 100 : 0,
    }));
  }, [totalComments, totalInteractions, totalLikes, totalViews]);

  const compareData = useMemo(() => {
    const sorted = courses.slice();
    if (courseSort === "engagement_desc") {
      sorted.sort((a, b) => b.engagementRate - a.engagementRate);
    } else if (courseSort === "posts_desc") {
      sorted.sort((a, b) => b.posts - a.posts);
    } else {
      sorted.sort((a, b) => b.interactions - a.interactions);
    }
    return sorted.map((course) => ({
      ...course,
      shortName: course.course_code || course.name || String(course.id),
      __fullname: `${course.course_code ? `${course.course_code} · ` : ""}${course.name || ""}`.trim(),
      engagementLabel: Number.isFinite(course.engagementRate)
        ? Number(course.engagementRate.toFixed(1))
        : 0,
    }));
  }, [courseSort, courses]);

  const maxY = Math.max(1, ...compareData.map((item) => Math.max(item.posts, item.interactions)));
  const yDomain = [0, Math.ceil(maxY / 100) * 100];
  const maxEngagement = Math.max(5, ...compareData.map((item) => item.engagementRate || 0));
  const engagementDomain = [0, Math.ceil(maxEngagement / 5) * 5];

  const chartInsightText = topCourse
    ? `${topCourse.course_code || "Top course"} currently leads with ${formatCount(
        topCourse.interactions
      )} interactions and ${formatRatio(topCourse.engagementRate)} engagement per post.`
    : "Once course activity is available, this panel will highlight the strongest performance signal.";

  const autoSummary = useMemo(() => makeAutoSummary(data), [data]);
  const aiSummaryLines = useMemo(
    () => splitSummaryLines(sparkSummary || autoSummary),
    [autoSummary, sparkSummary]
  );
  const aiSummaryLead = aiSummaryLines[0] || "No summary available yet.";
  const aiSentimentNote =
    aiSummaryLines.find((line) => line.toLowerCase().startsWith("sentiment")) || "";
  const aiRecommendation =
    aiSummaryLines.find((line) => line.toLowerCase().startsWith("recommendation:")) ||
    aiSummaryLines[1] ||
    "";

  const kpiCards = [
    {
      key: "total_courses",
      label: "Courses",
      value: totalCourses,
      description: "Teaching",
      trendLabel: `${formatPercent(activeCourseRate)} active`,
      trendTone: activeCourseRate >= 60 ? "up" : "flat",
      helper: `${formatCount(activeCourses)} active now`,
    },
    {
      key: "registered_students",
      label: "Students",
      value: totalStudents,
      description: "Across all courses",
      trendLabel: `${avgStudentsPerCourse.toFixed(1)} avg / course`,
      trendTone: "up",
      helper: "Enrolled audience",
    },
    {
      key: "total_posts",
      label: "Total Posts",
      value: totalPosts,
      description: buildRangeLabel(data, selectedRangeDays).split(" (")[0],
      trendLabel: "Current range",
      trendTone: totalPosts > 0 ? "up" : "flat",
      helper: data?.range_start && data?.range_end ? `${formatShortDate(data.range_start)} - ${formatShortDate(data.range_end)}` : "Selected range",
    },
    {
      key: "total_interactions",
      label: "Total Interactions",
      value: totalInteractions,
      description: buildRangeLabel(data, selectedRangeDays).split(" (")[0],
      trendLabel: "Current range",
      trendTone: totalInteractions > 0 ? "up" : "flat",
      helper: data?.range_start && data?.range_end ? `${formatShortDate(data.range_start)} - ${formatShortDate(data.range_end)}` : "Selected range",
    },
  ];

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

  return (
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          Dashboard
        </span>
      }
      subtitle="Overview of your teaching activities and course performance."
      wideContent
    >
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? <p className="text-sm text-slate-500">Loading dashboard...</p> : null}

      {!status.loading && data ? (
        <div className="space-y-2.5 pb-8">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex h-[44px] items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                onClick={() => navigate("/courses")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                <label className="relative inline-flex h-[44px] min-w-[280px] max-w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate text-[13px] font-semibold text-slate-700">
                      {buildRangeLabel(data, selectedRangeDays)}
                    </span>
                  </div>
                  <svg
                    className="h-4 w-4 shrink-0 text-slate-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <select
                    aria-label="Dashboard date range"
                    value={selectedRangeDays}
                    onChange={(event) => setSelectedRangeDays(Number(event.target.value))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  >
                    {RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="inline-flex h-[44px] min-w-[126px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-brand shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand disabled:opacity-60"
                  onClick={reloadDashboard}
                  disabled={status.loading}
                >
                  <Activity className="h-4 w-4" />
                  {status.loading ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-4">
              {kpiCards.map((tile) => (
                <div
                  key={tile.key}
                  className="grid min-h-[94px] grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3.5 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
                >
                  <div
                    className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-[14px] ${KPI_META[tile.key]?.tone}`}
                  >
                    {KPI_META[tile.key]?.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-600">{tile.label}</div>
                    <div className="mt-0.5 text-[24px] font-extrabold leading-none tracking-tight text-slate-950">
                      {formatCount(tile.value)}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="text-[12px] font-medium text-slate-500">{tile.description}</div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          tile.trendTone === "up"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tile.trendTone === "up" ? <ArrowUpRight className="h-3 w-3" /> : null}
                        {tile.trendLabel}
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{tile.helper}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,2.7fr)_272px]">
            <SectionCard
              title="Course Performance Overview"
              subtitle="Compare posts, interactions and engagement rate across your courses."
              tone="peach"
              right={
                <label className="flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600">
                  <span className="text-slate-400">Sort by:</span>
                  <select
                    value={courseSort}
                    onChange={(event) => setCourseSort(event.target.value)}
                    className="bg-transparent font-semibold text-slate-700 outline-none"
                  >
                    <option value="interactions_desc">Interactions (High to Low)</option>
                    <option value="posts_desc">Posts (High to Low)</option>
                    <option value="engagement_desc">Engagement Rate (High to Low)</option>
                  </select>
                </label>
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART.posts }} />
                  Posts
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART.interactions }}
                  />
                  Interactions
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CHART.engagement }}
                  />
                  Engagement Rate
                </span>
              </div>
              {compareData.length === 0 ? (
                <p className="mt-2.5 text-sm text-slate-500">No course data available.</p>
              ) : (
                <div className="mt-2.5">
                  <div className="h-[220px] w-full sm:h-[236px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={compareData}
                        margin={{
                          top: 8,
                          right: isMobile ? 8 : 16,
                          bottom: isMobile ? 24 : 12,
                          left: -10,
                        }}
                        barCategoryGap={isMobile ? 10 : 16}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                        <XAxis
                          dataKey="shortName"
                          tick={{ fill: CHART.text, fontSize: isMobile ? 10 : 11 }}
                          interval={0}
                          tickMargin={8}
                        />
                        <YAxis
                          domain={yDomain}
                          tick={{ fill: CHART.text, fontSize: isMobile ? 10 : 11 }}
                          width={32}
                        />
                        <YAxis
                          yAxisId="engagement"
                          orientation="right"
                          domain={engagementDomain}
                          tick={{ fill: CHART.text, fontSize: isMobile ? 10 : 11 }}
                          width={38}
                        />
                        <Tooltip content={<CompareTooltip />} />
                        <Bar dataKey="posts" fill={CHART.posts} radius={[7, 7, 0, 0]}>
                          <LabelList
                            dataKey="posts"
                            position="top"
                            fill={CHART.text}
                            fontSize={9}
                          />
                        </Bar>
                        <Bar dataKey="interactions" fill={CHART.interactions} radius={[7, 7, 0, 0]}>
                          <LabelList
                            dataKey="interactions"
                            position="top"
                            fill={CHART.text}
                            fontSize={9}
                          />
                        </Bar>
                        <Line
                          yAxisId="engagement"
                          type="monotone"
                          dataKey="engagementRate"
                          stroke={CHART.engagement}
                          strokeWidth={2.1}
                          dot={{ r: 3, strokeWidth: 0, fill: CHART.engagement }}
                          activeDot={{ r: 3.5 }}
                        >
                          <LabelList
                            dataKey="engagementLabel"
                            position="top"
                            fill={CHART.engagement}
                            fontSize={9}
                            formatter={(value) => formatRatio(value)}
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="mt-2.5 rounded-[16px] border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-[12px] leading-5 text-slate-700">
                <span className="font-semibold text-emerald-700">Insight:</span> {chartInsightText}
              </div>
            </SectionCard>

            <SectionCard
              title="Top Insights"
              subtitle="Short takeaways you can scan in a few seconds."
              tone="mint"
            >
              <div className="space-y-2">
                {topInsights.map((item) => (
                  <InsightItem
                    key={item.eyebrow}
                    eyebrow={item.eyebrow}
                    title={item.title}
                    detail={item.detail}
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.95fr_1fr]">
            <SectionCard title="Engagement Distribution" subtitle="Breakdown of interactions by type.">
              <div className="rounded-[20px] border border-brand-100 bg-white/85 p-3.5">
                <div className="grid items-center gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
                  <div className="relative mx-auto h-[128px] w-[128px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={engagementDistributionData}
                          dataKey="value"
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={1}
                          stroke="none"
                        >
                          {engagementDistributionData.map((entry) => (
                            <Cell key={entry.label} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[28px] font-extrabold leading-none text-slate-900">
                        {formatCount(totalInteractions)}
                      </div>
                      <div className="mt-0.5 text-[12px] text-slate-500">Total</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {engagementDistributionData.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <div className="flex min-w-0 items-center gap-2 text-slate-600">
                          <span
                            className="h-3 w-3 rounded-[4px]"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium leading-none">{item.label}</span>
                        </div>
                        <div className="whitespace-nowrap text-right text-slate-700">
                          <span className="font-semibold">{formatCount(item.value)}</span>
                          <span className="ml-1 text-slate-400">
                            ({formatPercent(item.percentage)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3.5 flex justify-center">
                  <DetailButton>View Details</DetailButton>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Sentiment Overview" subtitle="Overall sentiment across all posts.">
              <div className="rounded-[20px] border border-brand-100 bg-white/85 p-3.5">
                <div className="space-y-1">
                  {[
                    {
                      key: "positive",
                      label: "Positive",
                      value: sPos,
                      icon: <Smile className="h-4.5 w-4.5" />,
                      tone: "bg-emerald-50 text-emerald-500",
                    },
                    {
                      key: "neutral",
                      label: "Neutral",
                      value: sNeu,
                      icon: <Meh className="h-4.5 w-4.5" />,
                      tone: "bg-amber-50 text-amber-500",
                    },
                    {
                      key: "negative",
                      label: "Negative",
                      value: sNeg,
                      icon: <Frown className="h-4.5 w-4.5" />,
                      tone: "bg-rose-50 text-rose-500",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-[12px] ${item.tone}`}
                        >
                          {item.icon}
                        </span>
                        <span className="text-[14px] font-semibold text-slate-800">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-[17px] font-bold text-slate-900">
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3.5 flex justify-center">
                  <DetailButton>View Details</DetailButton>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Most Active Course" subtitle="By total interactions this week.">
              {topCourse ? (
                <div className="rounded-[20px] border border-brand-100 bg-[linear-gradient(180deg,#F5FBFC_0%,#F9FEFE_100%)] p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#FFF6E8] text-[#F59E0B]">
                      <Trophy className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900">
                        {topCourse.course_code || "Course"}
                      </div>
                      <div className="mt-0.5 text-[17px] font-bold leading-6 tracking-tight text-slate-900">
                        {topCourse.name || "Untitled course"}
                      </div>
                      <div className="mt-1 text-[13px] text-slate-500">
                        {topCourse.term || "Current term"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-[40px] font-extrabold leading-none tracking-tight text-slate-950">
                      {formatCount(topCourse.interactions)}
                    </div>
                    <div className="mt-1.5 text-[14px] text-slate-500">Interactions</div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <DetailButton>View Course Analytics</DetailButton>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No course activity available yet.</p>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.72fr)]">
            <SectionCard title="Recent Activity" subtitle="Latest updates across your courses.">
              <div className="space-y-2">
                {recentActivities.slice(0, 3).map((item) => (
                  <ActivityFeedItem
                    key={item.key}
                    icon={item.icon}
                    title={item.title}
                    detail={item.detail}
                    meta={item.meta}
                    tone={item.tone}
                  />
                ))}
                {recentActivities.length === 0 ? (
                  <p className="text-sm text-slate-500">No recent activity available.</p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="AI Summary"
              subtitle="Smart insights generated from your data."
              right={
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-semibold text-brand transition hover:border-brand disabled:opacity-60"
                  onClick={handleGenerateSummary}
                  disabled={sparkStatus.loading}
                >
                  {sparkStatus.loading ? "Generating..." : "Refresh AI summary"}
                </button>
              }
            >
              <div className="rounded-[20px] border border-brand-100 bg-white/85 p-3.5">
                <div className="space-y-2">
                  <p className="text-[13px] leading-5 text-slate-700">{aiSummaryLead}</p>
                  {aiSentimentNote ? (
                    <SummaryBullet
                      text={aiSentimentNote.replace(/^Sentiment snapshot:\s*/i, "")}
                      tone="muted"
                    />
                  ) : null}
                  {aiRecommendation ? (
                    <SummaryBullet
                      text={aiRecommendation.replace(/^Recommendation:\s*/i, "")}
                      tone="highlight"
                    />
                  ) : null}
                </div>
              </div>
              {sparkStatus.error ? (
                <p className="mt-2 text-xs text-rose-600">
                  {sparkStatus.error} Showing the built-in summary instead.
                </p>
              ) : null}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
