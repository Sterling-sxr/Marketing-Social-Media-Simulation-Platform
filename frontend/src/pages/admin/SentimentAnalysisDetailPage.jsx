import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Frown,
  Meh,
  RefreshCw,
  Smile,
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
  { value: "total_comments", label: "Most Comments" },
  { value: "neutral_percent", label: "Neutral Share" },
  { value: "positive_percent", label: "Positive Share" },
  { value: "negative_percent", label: "Negative Share" },
  { value: "course", label: "Course Name" },
];

const SENTIMENT_META = {
  positive: {
    label: "Positive",
    color: "#4FBF8B",
    tone: "bg-emerald-50 text-emerald-600",
    icon: <Smile className="h-4 w-4" />,
  },
  neutral: {
    label: "Neutral",
    color: "#F5B544",
    tone: "bg-amber-50 text-amber-600",
    icon: <Meh className="h-4 w-4" />,
  },
  negative: {
    label: "Negative",
    color: "#F36A7D",
    tone: "bg-rose-50 text-rose-600",
    icon: <Frown className="h-4 w-4" />,
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

export default function SentimentAnalysisDetailPage() {
  const { authUser, authCheckComplete } = useAuth();
  const authUserId = authUser?.id ?? null;
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [selectedRangeDays, setSelectedRangeDays] = useState(7);
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [sortBy, setSortBy] = useState("total_comments");

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);

  const loadDetail = useCallback(() => {
    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/sentiment-analysis/?range_days=${selectedRangeDays}`)
      .then((payload) => {
        setDetail(payload.detail || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load sentiment analysis detail.",
        });
      });
  }, [selectedRangeDays]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUserId) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate("/courses", { replace: true });
      return;
    }
    loadDetail();
  }, [authCheckComplete, authUserId, isAdmin, loadDetail, navigate]);

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
    const positive = filteredCourses.reduce((sum, item) => sum + Number(item.positive || 0), 0);
    const neutral = filteredCourses.reduce((sum, item) => sum + Number(item.neutral || 0), 0);
    const negative = filteredCourses.reduce((sum, item) => sum + Number(item.negative || 0), 0);
    const totalComments = positive + neutral + negative;
    const breakdown = ["positive", "neutral", "negative"].map((key) => ({
      key,
      label: SENTIMENT_META[key].label,
      count: key === "positive" ? positive : key === "neutral" ? neutral : negative,
      percentage:
        totalComments > 0
          ? roundToOneDecimal(
              ((key === "positive" ? positive : key === "neutral" ? neutral : negative) * 100) /
                totalComments
            )
          : 0,
    }));
    return { positive, neutral, negative, totalComments, breakdown };
  }, [filteredCourses]);

  const summaryNote = useMemo(() => {
    const breakdown = computedSummary.breakdown.slice().sort((a, b) => b.count - a.count);
    const dominant = breakdown[0];
    if (!dominant || computedSummary.totalComments === 0) {
      return "No valid text items are available in the current time range.";
    }
    if (dominant.key === "neutral") {
      return "Neutral sentiment dominates the current snapshot. Most course interactions are informational rather than strongly emotional, which is common in educational discussion.";
    }
    if (dominant.key === "positive") {
      return "Positive sentiment leads the current snapshot. Course discussions appear constructive and generally well received.";
    }
    return "Negative sentiment is currently the largest share. Review recent discussion threads for unresolved friction or confusing content.";
  }, [computedSummary]);

  const pageInsight = useMemo(() => {
    const neutralLeader = filteredCourses
      .filter((course) => course.total_comments > 0)
      .slice()
      .sort((a, b) => Number(b.neutral_percent || 0) - Number(a.neutral_percent || 0))[0];
    const positiveLeader = filteredCourses
      .filter((course) => course.total_comments > 0)
      .slice()
      .sort((a, b) => Number(b.positive || 0) - Number(a.positive || 0))[0];

    const lines = [];
    if (neutralLeader && Number(neutralLeader.neutral_percent || 0) > 0) {
      lines.push(
        `${neutralLeader.course_code || "One course"} has the highest neutral share at ${formatPercent(
          Number(neutralLeader.neutral_percent || 0)
        )}.`
      );
    }
    if (computedSummary.negative === 0 && computedSummary.totalComments > 0) {
      lines.push("No strong negative sentiment is detected in the current snapshot.");
    } else if (positiveLeader && positiveLeader.positive > 0) {
      lines.push(
        `${positiveLeader.course_code || "One course"} shows the strongest positive signal with ${formatCount(
          positiveLeader.positive
        )} positive comments.`
      );
    }
    return lines.slice(0, 2).join(" ") || detail?.insight || "";
  }, [computedSummary, detail?.insight, filteredCourses]);

  return (
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          Sentiment Analysis
        </span>
      }
      subtitle="Detailed analysis of comment sentiment across managed courses."
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
                  aria-label="Sentiment range"
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
            title="Sentiment Analysis"
            subtitle="Detailed analysis of comment sentiment across managed courses."
            right={
              <label className="inline-flex h-[38px] items-center rounded-full border border-brand-100 bg-white px-3 text-[12px] font-medium text-slate-600">
                <span className="mr-2 text-slate-400">Course:</span>
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
            }
          >
            <div className="rounded-[22px] border border-brand-100 bg-white/85 p-4">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
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
                          <Cell key={item.key} fill={SENTIMENT_META[item.key].color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[38px] font-extrabold leading-none text-slate-900">
                      {formatCount(computedSummary.totalComments)}
                    </div>
                    <div className="mt-1 text-center text-[12px] leading-5 text-slate-500">
                      Comments
                      <br />
                      Analyzed
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {computedSummary.breakdown.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-[14px] ${SENTIMENT_META[item.key].tone}`}
                        >
                          {SENTIMENT_META[item.key].icon}
                        </span>
                        <span className="text-[15px] font-semibold text-slate-800">
                          {item.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-[20px] font-bold text-slate-900">
                          {formatCount(item.count)}
                        </div>
                        <div className="text-[12px] text-slate-400">
                          {formatPercent(item.percentage)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-brand-100 bg-slate-50/80 px-4 py-3 text-[13px] leading-6 text-slate-700">
                {summaryNote}
              </div>
            </div>
          </Panel>

          <Panel
            title="Breakdown by Course"
            subtitle="Course-level sentiment distribution across managed courses."
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
              <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.15fr] gap-0 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-[12px] font-semibold text-slate-500">
                <div>Course</div>
                <div>Positive</div>
                <div>Neutral</div>
                <div>Negative</div>
                <div>Total Comments</div>
              </div>

              {filteredCourses.map((course, index) => (
                <div
                  key={course.id}
                  className="grid grid-cols-[2.2fr_1fr_1fr_1fr_1.15fr] items-center gap-0 border-b border-slate-100 px-4 py-3 last:border-b-0"
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
                      <Meh className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-slate-900">
                        {course.course_code || "Course"}
                      </div>
                      <div className="truncate text-[12px] text-slate-500">{course.name}</div>
                    </div>
                  </div>

                  {["positive", "neutral", "negative"].map((key) => (
                    <div key={key} className="pr-3">
                      <div className="text-[15px] font-semibold text-slate-900">
                        {formatCount(course[key])}
                      </div>
                      <div className="text-[12px] text-slate-400">
                        {formatPercent(Number(course[`${key}_percent`] || 0))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <div className="text-[18px] font-bold text-slate-900">
                      {formatCount(course.total_comments)}
                    </div>
                    <div className="text-[12px] text-slate-400">
                      {formatPercent(Number(course.share_percent || 0))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {pageInsight ? (
            <div className="rounded-[20px] border border-brand-100 bg-[linear-gradient(180deg,#F8FEFD_0%,#F4FBFA_100%)] px-4 py-3 text-[13px] leading-6 text-slate-700">
              <span className="font-semibold text-slate-900">Insight Summary:</span> {pageInsight}
            </div>
          ) : null}
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}

function roundToOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
