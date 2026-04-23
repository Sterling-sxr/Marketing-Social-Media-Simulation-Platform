import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Lightbulb,
  MessageSquareText,
  Trophy,
  Users,
  Hash,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import { ViewPostAnalysisButton } from "../components/AnalyticsShared";

const CHART = {
  posts: "#78DBC4",
  interactions: "#62AFC3",
  students: "#8B5CF6",
  grid: "#DCEFF3",
  border: "#BDDDE7",
  text: "#475569",
};

const DONUT_COLORS = ["#62C6A5", "#4F86E8", "#8B5CF6", "#F2A06B"];

const KPI_META = {
  avg_interactions_per_post: {
    icon: <Activity className="h-4 w-4" />,
    tone: "bg-[#FFF6E8] text-[#F59E0B]",
  },
  registered_students: {
    icon: <Users className="h-4 w-4" />,
    tone: "bg-[#EEF8F3] text-[#46B97A]",
  },
  active_topics: {
    icon: <Hash className="h-4 w-4" />,
    tone: "bg-[#EEF4FF] text-[#3B82F6]",
  },
  comment_volume: {
    icon: <MessageSquareText className="h-4 w-4" />,
    tone: "bg-[#F4EBFF] text-[#8B5CF6]",
  },
};

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

function buildCourseSubtitle(courseMeta) {
  if (!courseMeta) return "Single-course analytics overview.";
  const parts = [courseMeta.name, courseMeta.course_code, courseMeta.term].filter(Boolean);
  return parts.join(" · ");
}

function buildSentimentTone(label) {
  if (label === "positive") return "Positive";
  if (label === "negative") return "Negative";
  return "Neutral";
}

function pickAudienceSegments(segmentation) {
  const insights = segmentation?.insights || {};
  const segments = Array.isArray(segmentation?.segments) ? segmentation.segments : [];
  const eligibleSegments = segments.filter((segment) => Number(segment?.audience_count || 0) > 0);

  const sortedByEngagement = eligibleSegments
    .slice()
    .sort((a, b) => {
      const delta =
        Number(b?.metrics?.engagement_rate || 0) - Number(a?.metrics?.engagement_rate || 0);
      if (delta !== 0) return delta;
      return Number(b?.engaged_user_count || 0) - Number(a?.engaged_user_count || 0);
    });

  const topSegment = insights.top_segment || sortedByEngagement[0] || null;
  const underSegment =
    insights.under_engaged_segment || sortedByEngagement[sortedByEngagement.length - 1] || null;

  if (!topSegment && !underSegment) return null;

  return {
    topSegment,
    underSegment,
    summaryText: insights.summary_text || "",
  };
}

function sortRepresentativePosts(posts) {
  return (posts || []).slice().sort((a, b) => {
    const interactionDelta = Number(b?.interactions || 0) - Number(a?.interactions || 0);
    if (interactionDelta !== 0) return interactionDelta;

    const likesDelta = Number(b?.likes || 0) - Number(a?.likes || 0);
    if (likesDelta !== 0) return likesDelta;

    const commentsDelta = Number(b?.comments || 0) - Number(a?.comments || 0);
    if (commentsDelta !== 0) return commentsDelta;

    const viewsDelta = Number(b?.views || 0) - Number(a?.views || 0);
    if (viewsDelta !== 0) return viewsDelta;

    return String(b?.created_at || "").localeCompare(String(a?.created_at || ""));
  });
}

function SectionCard({ title, subtitle, children, tone = "default", right, id }) {
  const toneStyles =
    tone === "peach"
      ? "bg-[linear-gradient(135deg,#FFF7F2_0%,#FFFFFF_62%)] border-[#BDDDE7]"
      : tone === "mint"
      ? "bg-[linear-gradient(135deg,#F5FBFC_0%,#FFFFFF_62%)] border-brand-100"
      : "bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFEFE_100%)] border-brand-100";

  return (
    <section
      id={id}
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
    eyebrow === "Student Response"
      ? "bg-[#EEF8F3] text-[#46B97A]"
      : eyebrow === "Topic Response"
      ? "bg-[#EEF4FF] text-[#3B82F6]"
      : "bg-[#FFF6E8] text-[#F59E0B]";
  const icon =
    eyebrow === "Student Response" ? (
      <Trophy className="h-4 w-4" />
    ) : eyebrow === "Topic Response" ? (
      <Hash className="h-4 w-4" />
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

function DetailButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-full border border-brand-100 bg-white px-4 text-[13px] font-semibold text-brand transition hover:border-brand"
    >
      {children}
      <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
    </button>
  );
}

function DrillDownCard({ rankLabel, title, stats, actionLabel, onAction }) {
  return (
    <article className="rounded-[20px] border border-brand-100 bg-white/85 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{rankLabel}</p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">{title}</h3>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl bg-brand-50/70 px-3 py-2">
            <dt className="text-slate-500">{item.label}</dt>
            <dd className="mt-1 font-semibold text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4">
        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-10 items-center justify-center rounded-full border border-brand bg-brand-100 px-4 text-[13px] font-semibold text-brand transition hover:bg-brand-200"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}

function AudienceSegmentCard({ eyebrow, segment, tone = "emerald" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-100 bg-amber-50/60"
      : "border-emerald-100 bg-emerald-50/60";
  const totalEngagement =
    Number(segment?.metrics?.likes || 0) + Number(segment?.metrics?.comments || 0);

  if (!segment) return null;

  return (
    <article className={`rounded-[20px] border p-4 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {eyebrow}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-slate-900">{segment.label}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <dt className="whitespace-nowrap text-[11px] text-slate-500">Audience</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCount(segment.audience_count)}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <dt className="whitespace-nowrap text-[11px] text-slate-500">Engaged</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCount(segment.engaged_user_count)}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <dt className="whitespace-nowrap text-[11px] text-slate-500">Total Engagement</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {formatCount(totalEngagement)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default function CourseDashboardPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [segmentation, setSegmentation] = useState(null);
  const [segmentationStatus, setSegmentationStatus] = useState({
    loading: true,
    error: "",
  });

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);
  const handleBack = useCallback(() => {
    if (window.history?.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(`/courses/${courseId}`);
  }, [courseId, navigate]);

  const loadCourseDashboard = useCallback(() => {
    if (!Number.isFinite(courseId)) {
      setStatus({ loading: false, error: "Invalid course id." });
      return Promise.resolve();
    }

    setStatus({ loading: true, error: "" });
    return getJson(`/api/admin/dashboard/courses/${courseId}/`)
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
  }, [courseId]);

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
    loadCourseDashboard();
  }, [authCheckComplete, authUser, isAdmin, loadCourseDashboard, navigate]);

  useEffect(() => {
    if (!authCheckComplete || !authUser || !isAdmin || !Number.isFinite(courseId)) {
      return;
    }
    setSegmentationStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/segmentation?lens=interests`)
      .then((payload) => {
        setSegmentation(payload.segmentation || null);
        setSegmentationStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setSegmentation(null);
        setSegmentationStatus({
          loading: false,
          error: error.message || "Failed to load representative posts.",
        });
      });
  }, [authCheckComplete, authUser, courseId, isAdmin]);

  useEffect(() => {
    if (location.hash === "#students-section") {
      const element = document.getElementById("students-section");
      if (element) {
        setTimeout(
          () => element.scrollIntoView({ behavior: "smooth", block: "start" }),
          0
        );
      }
    }
  }, [location.hash]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const courseMeta = data?.course;
  const summary = data?.summary || {};
  const sentiment = data?.sentiment || {};
  const students = (data?.students || []).slice().sort((a, b) => {
    const aInteractions = Number(a?.interactions_total || 0);
    const bInteractions = Number(b?.interactions_total || 0);
    if (bInteractions !== aInteractions) return bInteractions - aInteractions;
    return Number(b?.posts_total || 0) - Number(a?.posts_total || 0);
  });
  const hashtags = (data?.hashtags || []).slice().sort((a, b) => {
    const aInteractions = Number(a?.total_interactions || 0);
    const bInteractions = Number(b?.total_interactions || 0);
    if (bInteractions !== aInteractions) return bInteractions - aInteractions;
    return Number(b?.total_posts || 0) - Number(a?.total_posts || 0);
  });

  const totalStudents = Number(summary.registered_students || 0);
  const totalPosts = Number(summary.total_posts || 0);
  const totalInteractions = Number(summary.total_interactions || 0);
  const avgInteractionsPerPost = totalPosts > 0 ? totalInteractions / totalPosts : 0;
  const activeTopicCount = hashtags.length;
  const topStudent = students[0] || null;
  const topHashtag = hashtags[0] || null;
  const commentVolume = Number(sentiment.total_comments || 0);
  const avgInteractionsPerTopic = activeTopicCount > 0 ? totalInteractions / activeTopicCount : 0;
  const audienceResponse = pickAudienceSegments(segmentation);
  const representativePosts = sortRepresentativePosts(segmentation?.posts).slice(0, 3);

  const kpiCards = [
    {
      key: "avg_interactions_per_post",
      label: "Average Interactions per Post",
      value: formatRatio(avgInteractionsPerPost),
      description: "Primary effectiveness signal",
      trendLabel: `${formatCount(totalInteractions)} total interactions`,
      trendTone: totalInteractions > 0 ? "up" : "flat",
      helper: "Based on current course totals",
    },
    {
      key: "registered_students",
      label: "Registered Students",
      value: totalStudents,
      description: "Class-size context",
      trendLabel: `${formatCount(totalPosts)} total posts`,
      trendTone: totalPosts > 0 ? "up" : "flat",
      helper: "Registered in this course",
    },
    {
      key: "active_topics",
      label: "Active Topics",
      value: activeTopicCount,
      description: "Breadth of experimentation",
      trendLabel: formatRatio(avgInteractionsPerTopic),
      trendTone: avgInteractionsPerTopic > 0 ? "up" : "flat",
      helper: "Average interactions per visible topic",
    },
    {
      key: "comment_volume",
      label: "Comment Volume",
      value: commentVolume,
      description: "Qualitative feedback available",
      trendLabel: buildSentimentTone(sentiment.top_label),
      trendTone: commentVolume > 0 ? "up" : "flat",
      helper: "Not a performance score",
    },
  ];

  const activityOverviewData = [
    { label: "Students", value: totalStudents, fill: CHART.students },
    { label: "Posts", value: totalPosts, fill: CHART.posts },
    { label: "Interactions", value: totalInteractions, fill: CHART.interactions },
  ];

  const topInsights = [
    topStudent
      ? {
          eyebrow: "Student Response",
          title: `${topStudent.name || "This student"} is generating the strongest visible response`,
          detail: `${formatCount(topStudent.interactions_total)} interactions from ${formatCount(
            topStudent.posts_total
          )} post(s) in this course.`,
        }
      : null,
    topHashtag
      ? {
          eyebrow: "Topic Response",
          title: `#${topHashtag.hashtag} is currently drawing the strongest response`,
          detail: `${formatCount(topHashtag.total_interactions)} interactions across ${formatCount(
            topHashtag.total_posts
          )} post(s) using this topic.`,
        }
      : null,
    {
      eyebrow: "Teaching Signal",
      title:
        totalPosts > 0
          ? `${formatRatio(avgInteractionsPerPost)} average interactions per post`
          : "Waiting for the first round of course activity",
      detail:
        totalPosts > 0
          ? `${formatCount(totalPosts)} posts and ${formatCount(
              totalInteractions
            )} interactions are currently visible across ${formatCount(totalStudents)} registered students.`
          : "Once students begin posting, this panel will highlight the strongest performance signal.",
    },
  ].filter(Boolean);

  const engagementDistributionBase = students.slice(0, 5).map((item) => ({
    label: item.name,
    value: Number(item.interactions_total || 0),
  }));

  const engagementBaseTotal = engagementDistributionBase.reduce(
    (sum, item) => sum + item.value,
    0
  );
  const engagementOther = Math.max(totalInteractions - engagementBaseTotal, 0);
  const engagementDistributionData = [...engagementDistributionBase];
  if (engagementOther > 0 || engagementDistributionData.length === 0) {
    engagementDistributionData.push({
      label: engagementDistributionData.length ? "Other" : "No grouped activity",
      value: engagementDistributionData.length ? engagementOther : totalInteractions,
    });
  }
  const engagementDistribution = engagementDistributionData.map((item, index) => ({
    ...item,
    color: DONUT_COLORS[index % DONUT_COLORS.length],
    percentage: totalInteractions > 0 ? (item.value / totalInteractions) * 100 : 0,
  }));

  const chartInsightText = engagementDistributionBase.length
    ? `${engagementDistributionBase[0].label} currently holds the largest visible share of student response, while the course averages ${formatRatio(
        avgInteractionsPerPost
      )} interactions per post.`
    : totalPosts > 0
    ? `This course currently averages ${formatRatio(avgInteractionsPerPost)} interactions per post across ${formatCount(
        totalPosts
      )} posts.`
    : "Once the course has activity, this panel will show how response is concentrated across the most responsive students.";

  return (
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          Course Dashboard
        </span>
      }
      subtitle={buildCourseSubtitle(courseMeta)}
      wideContent
    >
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? <p className="text-sm text-slate-500">Loading course dashboard...</p> : null}

      {!status.loading && data ? (
        <div className="space-y-2.5 pb-8">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex h-[44px] items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-[44px] min-w-[126px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-brand shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand disabled:opacity-60"
                  onClick={loadCourseDashboard}
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
                      {tile.value}
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
              title="Course Activity Overview"
              subtitle="A single-course snapshot of class size, content volume, and response quality."
              tone="peach"
              right={
                <button
                  type="button"
                  onClick={() => navigate(`/courses/${courseId}`)}
                  className="rounded-full border border-brand-100 bg-white px-3 py-1.5 text-[12px] font-semibold text-brand transition hover:border-brand"
                >
                  Open Course
                </button>
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                {activityOverviewData.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="mt-2.5 h-[220px] w-full sm:h-[236px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activityOverviewData}
                    margin={{ top: 8, right: 12, bottom: 12, left: -12 }}
                    barCategoryGap={24}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: CHART.text, fontSize: 11 }}
                      tickMargin={8}
                    />
                    <YAxis tick={{ fill: CHART.text, fontSize: 11 }} width={36} />
                    <Tooltip
                      formatter={(value) => formatCount(value)}
                      contentStyle={{
                        borderRadius: 16,
                        border: `1px solid ${CHART.border}`,
                        boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                      }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {activityOverviewData.map((entry) => (
                        <Cell key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2.5 rounded-[16px] border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-[12px] leading-5 text-slate-700">
                <span className="font-semibold text-emerald-700">Insight:</span> {chartInsightText}
              </div>
            </SectionCard>

            <SectionCard
              title="Teaching Highlights"
              subtitle="Short takeaways you can scan before deciding where to view more detail."
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

          <div className="grid gap-3 xl:grid-cols-[1.1fr_0.95fr]">
            <SectionCard title="Student Response Concentration" subtitle="How response is distributed across the five most responsive visible students.">
              <div className="rounded-[20px] border border-brand-100 bg-white/85 p-3.5">
                <div className="grid items-center gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
                  <div className="relative mx-auto h-[128px] w-[128px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={engagementDistribution}
                          dataKey="value"
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={1}
                          stroke="none"
                        >
                          {engagementDistribution.map((entry) => (
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
                    {engagementDistribution.map((item) => (
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
                <p className="mt-3 text-[12px] leading-5 text-slate-500">
                  Based on the five most responsive visible students, with the remainder grouped into Other.
                </p>
              </div>
            </SectionCard>

            {audienceResponse ? (
              <SectionCard
                title="Audience Response"
                subtitle="Which audience segments are responding most and least strongly under the interests lens."
              >
                <div className="space-y-3">
                  <AudienceSegmentCard
                    eyebrow="Strongest Match"
                    segment={audienceResponse.topSegment}
                  />
                  {audienceResponse.underSegment &&
                  audienceResponse.underSegment.label !== audienceResponse.topSegment?.label ? (
                    <AudienceSegmentCard
                      eyebrow="Needs Attention"
                      segment={audienceResponse.underSegment}
                      tone="amber"
                    />
                  ) : null}
                  {audienceResponse.summaryText ? (
                    <div className="rounded-[16px] border border-brand-100 bg-white/85 px-3 py-2 text-[12px] leading-5 text-slate-700">
                      {audienceResponse.summaryText}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

          </div>

          <div className="grid gap-3">
            <SectionCard
              title="Representative Posts"
              subtitle="Start here when you want a classroom example or a post to review in detail."
            >
              {segmentationStatus.error ? <Feedback error={segmentationStatus.error} /> : null}
              {segmentationStatus.loading ? (
                <p className="text-sm text-slate-500">Loading representative posts...</p>
              ) : null}
              {!segmentationStatus.loading && !representativePosts.length ? (
                <p className="text-sm text-slate-500">
                  No representative posts are available for this course yet.
                </p>
              ) : null}
              {representativePosts.length ? (
                <div className="grid gap-3">
                  {representativePosts.map((item) => (
                    <article
                      key={item.post_id}
                      className="rounded-[20px] border border-brand-100 bg-white/85 p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
                          <p className="mt-1 text-sm text-slate-500">{item.summary_text}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600">
                            <span>{formatCount(item.interactions)} interactions</span>
                            <span>{formatCount(item.likes)} likes · {formatCount(item.comments)} comments</span>
                          </div>
                        </div>
                        <ViewPostAnalysisButton
                          className="shrink-0 self-start whitespace-nowrap justify-self-end"
                          onClick={() =>
                            navigate(`/courses/${courseId}/posts/${item.post_id}/analytics`)
                          }
                        />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </SectionCard>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <SectionCard
              id="students-section"
              title="Response Leaders by Student"
              right={
                <DetailButton onClick={() => navigate(`/dashboard/courses/${courseId}/students`)}>
                  Open Student Dashboard
                </DetailButton>
              }
            >
              {!students.length ? (
                <p className="text-sm text-slate-500">No student activity data available for this course yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {students.slice(0, 4).map((item, index) => (
                    <DrillDownCard
                      key={item.user_id}
                      rankLabel={`Visible Leader ${index + 1}`}
                      title={item.name}
                      stats={[
                        { label: "Posts", value: item.posts_total },
                        { label: "Interactions", value: item.interactions_total },
                      ]}
                      actionLabel="Open Student Detail"
                      onAction={() =>
                        navigate(`/dashboard/courses/${courseId}/students/${item.user_id}`)
                      }
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Response Leaders by Hashtag"
            >
              {!hashtags.length ? (
                <p className="text-sm text-slate-500">No hashtag analytics available for this course yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {hashtags.slice(0, 4).map((item, index) => (
                    <DrillDownCard
                      key={item.hashtag}
                      rankLabel={`Visible Topic ${index + 1}`}
                      title={`#${item.hashtag}`}
                      stats={[
                        { label: "Posts", value: item.total_posts },
                        { label: "Interactions", value: item.total_interactions },
                      ]}
                      actionLabel="Open Hashtag Detail"
                      onAction={() =>
                        navigate(
                          `/dashboard/courses/${courseId}/hashtags/${encodeURIComponent(item.hashtag)}`
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
