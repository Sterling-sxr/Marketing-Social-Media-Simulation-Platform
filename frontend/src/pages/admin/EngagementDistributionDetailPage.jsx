import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Heart,
  MessageCircle,
  RefreshCw,
  Eye,
  MessageSquareMore,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { getJson } from "../../lib/api";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

const RANGE_OPTIONS = [
  { value: 7, label: "This Week" },
  { value: 14, label: "Last 14 Days" },
  { value: 30, label: "Last Month" },
];

const SORT_OPTIONS = [
  { value: "total_interactions", label: "Most Interactions" },
  { value: "likes", label: "Likes" },
  { value: "comments", label: "Comments" },
  { value: "views", label: "Views" },
  { value: "course", label: "Course Name" },
];

const TYPE_META = {
  likes: {
    label: "Likes",
    color: "#62C6A5",
    tone: "bg-emerald-50 text-emerald-600",
    icon: <Heart className="h-4 w-4" />,
  },
  comments: {
    label: "Comments",
    color: "#4F86E8",
    tone: "bg-blue-50 text-blue-600",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  views: {
    label: "Views",
    color: "#8B5CF6",
    tone: "bg-violet-50 text-violet-600",
    icon: <Eye className="h-4 w-4" />,
  },
  other: {
    label: "Other",
    color: "#F2A06B",
    tone: "bg-orange-50 text-orange-600",
    icon: <MessageSquareMore className="h-4 w-4" />,
  },
};

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
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

function buildRangeLabel(detail, selectedRangeDays) {
  const option =
    RANGE_OPTIONS.find((item) => item.value === selectedRangeDays) || RANGE_OPTIONS[0];
  const startLabel = formatShortDate(detail?.range_start);
  const endLabel = formatShortDate(detail?.range_end);
  if (startLabel && endLabel) return `${option.label} (${startLabel} - ${endLabel})`;
  return option.label;
}

function GlassButton({ children, onClick, className = "", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-[42px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

function Panel({ title, subtitle, children, right }) {
  return (
    <section className="rounded-[24px] border border-brand-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFEFE_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function EngagementDistributionDetailPage() {
  const { authUser, authCheckComplete } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [selectedRangeDays, setSelectedRangeDays] = useState(7);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [sortBy, setSortBy] = useState("total_interactions");

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);

  const loadDetail = useCallback(() => {
    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/engagement-distribution/?range_days=${selectedRangeDays}`)
      .then((payload) => {
        setDetail(payload.detail || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load engagement distribution detail.",
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
    loadDetail();
  }, [authCheckComplete, authUser, isAdmin, loadDetail, navigate]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const allCourses = detail?.courses || [];
  const filteredCourses = useMemo(() => {
    const base =
      selectedCourseId === "all"
        ? allCourses
        : allCourses.filter((course) => String(course.id) === String(selectedCourseId));
    const sorted = base.slice();
    if (sortBy === "course") {
      sorted.sort((a, b) =>
        `${a.course_code || ""} ${a.name || ""}`.localeCompare(`${b.course_code || ""} ${b.name || ""}`)
      );
      return sorted;
    }
    sorted.sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
    return sorted;
  }, [allCourses, selectedCourseId, sortBy]);

  const computedSummary = useMemo(() => {
    const likes = filteredCourses.reduce((sum, item) => sum + Number(item.likes || 0), 0);
    const comments = filteredCourses.reduce((sum, item) => sum + Number(item.comments || 0), 0);
    const views = filteredCourses.reduce((sum, item) => sum + Number(item.views || 0), 0);
    const other = filteredCourses.reduce((sum, item) => sum + Number(item.other || 0), 0);
    const total = likes + comments + views + other;
    const denominator = Math.max(total, 1);
    const breakdown = [
      { key: "likes", label: "Likes", count: likes, percentage: total ? (likes / denominator) * 100 : 0 },
      { key: "comments", label: "Comments", count: comments, percentage: total ? (comments / denominator) * 100 : 0 },
      { key: "views", label: "Views", count: views, percentage: total ? (views / denominator) * 100 : 0 },
      { key: "other", label: "Other", count: other, percentage: total ? (other / denominator) * 100 : 0 },
    ];
    return { total, likes, comments, views, other, breakdown };
  }, [filteredCourses]);

  const heroInsight = useMemo(() => {
    const topCourse = filteredCourses[0];
    const dominantType = computedSummary.breakdown
      .slice()
      .sort((a, b) => b.count - a.count)[0];
    const parts = [];
    if (topCourse && topCourse.total_interactions > 0) {
      parts.push(
        `${topCourse.course_code || "Top course"} has the highest interaction volume with ${formatCount(
          topCourse.total_interactions
        )} total interactions.`
      );
    }
    if (dominantType && dominantType.count > 0) {
      parts.push(
        `${dominantType.label} are the dominant interaction type at ${formatPercent(
          dominantType.percentage
        )}.`
      );
    }
    if (computedSummary.comments < computedSummary.likes && computedSummary.likes > 0) {
      parts.push("Comments remain lighter than likes, suggesting discussion depth could be improved.");
    }
    return parts.slice(0, 2).join(" ");
  }, [computedSummary, filteredCourses]);

  return (
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          Engagement Distribution
        </span>
      }
      subtitle="Detailed breakdown of interactions across managed courses."
      wideContent
    >
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? <p className="text-sm text-slate-500">Loading detail view...</p> : null}

      {!status.loading && detail ? (
        <div className="space-y-3 pb-8">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <GlassButton onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </GlassButton>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <label className="relative inline-flex h-[42px] min-w-[260px] max-w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_4px_14px_rgba(15,23,42,0.05)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate text-[13px] font-semibold text-slate-700">
                    {buildRangeLabel(detail, selectedRangeDays)}
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
                  aria-label="Engagement range"
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
              <GlassButton onClick={loadDetail}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </GlassButton>
            </div>
          </div>

          <Panel
            title="Engagement Distribution"
            subtitle="Detailed breakdown of interactions across managed courses."
            right={
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="inline-flex h-[38px] items-center rounded-full border border-brand-100 bg-white px-3 text-[12px] font-medium text-slate-600">
                  <span className="mr-2 text-slate-400">Sort by:</span>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    className="bg-transparent font-semibold text-slate-700 outline-none"
                  >
                    <option value="all">All Courses</option>
                    {allCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_code || course.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            }
          >
            <div className="rounded-[22px] border border-brand-100 bg-white/85 p-4">
              <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
                <div className="relative mx-auto h-[196px] w-[196px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={computedSummary.breakdown}
                        dataKey="count"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={1}
                        stroke="none"
                      >
                        {computedSummary.breakdown.map((item) => (
                          <Cell key={item.key} fill={TYPE_META[item.key].color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[42px] font-extrabold leading-none text-slate-900">
                      {formatCount(computedSummary.total)}
                    </div>
                    <div className="mt-1 text-[13px] text-slate-500">Total Interactions</div>
                  </div>
                </div>

                <div className="grid content-start gap-3">
                  {computedSummary.breakdown.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-[16px] border border-brand-50 bg-brand-50/30 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-[4px]"
                          style={{ backgroundColor: TYPE_META[item.key].color }}
                        />
                        <span className="text-[14px] font-medium text-slate-700">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-semibold text-slate-900">
                          {formatCount(item.count)}
                        </div>
                        <div className="text-[12px] text-slate-400">{formatPercent(item.percentage)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid content-start gap-2.5">
                  {["likes", "comments", "views", "other"].map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-[16px] border border-brand-100 bg-white px-3 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-[12px] ${TYPE_META[key].tone}`}
                        >
                          {TYPE_META[key].icon}
                        </span>
                        <span className="text-[14px] font-semibold text-slate-700">
                          {TYPE_META[key].label}
                        </span>
                      </div>
                      <span className="text-[18px] font-bold text-slate-900">
                        {formatCount(computedSummary[key])}
                      </span>
                    </div>
                  ))}

                  <GlassButton
                    className="w-full"
                    onClick={() => {
                      const target =
                        selectedCourseId !== "all"
                          ? selectedCourseId
                          : filteredCourses[0]?.id;
                      if (target) navigate(`/dashboard/courses/${target}`);
                    }}
                    disabled={!filteredCourses.length}
                  >
                    View Course Analytics
                    <ArrowUpRight className="h-4 w-4" />
                  </GlassButton>
                </div>
              </div>

              {heroInsight ? (
                <div className="mt-4 rounded-[18px] border border-emerald-100 bg-emerald-50/70 px-3.5 py-2 text-[13px] leading-5 text-slate-700">
                  <span className="font-semibold text-emerald-700">Insight:</span> {heroInsight}
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Breakdown by course"
            subtitle="Type-level interaction distribution across your managed courses."
            right={
              <label className="inline-flex h-[38px] items-center rounded-full border border-brand-100 bg-white px-3 text-[12px] font-medium text-slate-600">
                <span className="mr-2 text-slate-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="bg-transparent font-semibold text-slate-700 outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <div className="overflow-hidden rounded-[22px] border border-brand-100 bg-white/90">
              <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.1fr] gap-0 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-[12px] font-semibold text-slate-500">
                <div>Course</div>
                <div>Likes</div>
                <div>Comments</div>
                <div>Views</div>
                <div>Total Interactions</div>
              </div>

              {filteredCourses.map((course, index) => (
                <div
                  key={course.id}
                  className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.1fr] items-center gap-0 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-[12px] ${
                        index % 4 === 0
                          ? "bg-emerald-50 text-emerald-600"
                          : index % 4 === 1
                          ? "bg-blue-50 text-blue-600"
                          : index % 4 === 2
                          ? "bg-violet-50 text-violet-600"
                          : "bg-cyan-50 text-cyan-600"
                      }`}
                    >
                      <Activity className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-slate-900">
                        {course.course_code || "Course"}
                      </div>
                      <div className="truncate text-[12px] text-slate-500">{course.name}</div>
                    </div>
                  </div>

                  {["likes", "comments", "views"].map((key) => (
                    <div key={key} className="pr-3">
                      <div className="text-[15px] font-semibold text-slate-900">
                        {formatCount(course[key])}
                      </div>
                      <div className="text-[12px] text-slate-400">
                        {formatPercent(
                          computedSummary.total > 0
                            ? (Number(course[key] || 0) / computedSummary.total) * 100
                            : 0
                        )}
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="text-[18px] font-bold text-slate-900">
                      {formatCount(course.total_interactions)}
                    </div>
                    <div className="text-[12px] text-slate-400">
                      {formatPercent(course.share_percent || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {detail?.insight || heroInsight ? (
            <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-[13px] leading-6 text-slate-700">
              <span className="font-semibold text-emerald-700">Insight Summary:</span>{" "}
              {heroInsight || detail.insight}
            </div>
          ) : null}
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
