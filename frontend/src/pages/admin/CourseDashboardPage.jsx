import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import { isTeacher } from "../../lib/access";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import {
  AnalyticsEmptyState,
  AnalyticsSummaryCard,
  ViewPostAnalysisButton,
} from "../components/AnalyticsShared";

function Btn({ children, onClick, variant = "secondary", disabled = false }) {
  const styles = {
    primary: "border border-brand bg-brand-100 text-brand hover:bg-brand-200",
    secondary:
      "border border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value === 0) return "0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function ChangeBadge({ value }) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
        —
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
        0%
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
        positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {formatPercent(value)}
    </span>
  );
}

function PreviewListCard({ title, subtitle, children, action }) {
  return (
    <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

const SUMMARY_TILES = [
  {
    key: "total_posts",
    label: "Total Posts",
    hint: "How much content has been produced in this course.",
  },
  {
    key: "total_interactions",
    label: "Total Interactions",
    hint: "Combined reactions, comments, and views across the course.",
  },
  {
    key: "registered_students",
    label: "Registered Students",
    hint: "Potential audience size for course discussion activity.",
  },
];

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
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);

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
    getJson(
      `/api/admin/dashboard/courses/${courseId}/segmentation?lens=interests`
    )
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
  const students = (data?.students || []).slice().sort((a, b) => {
    const aPosts = Number(a?.posts_total || 0);
    const bPosts = Number(b?.posts_total || 0);
    if (bPosts !== aPosts) return bPosts - aPosts;
    return Number(b?.interactions_total || 0) - Number(a?.interactions_total || 0);
  });
  const hashtags = (data?.hashtags || []).slice().sort((a, b) => {
    const aPosts = Number(a?.total_posts || 0);
    const bPosts = Number(b?.total_posts || 0);
    if (bPosts !== aPosts) return bPosts - aPosts;
    return Number(b?.total_interactions || 0) - Number(a?.total_interactions || 0);
  });
  const lastUpdated = data?.calculated_at ? new Date(data.calculated_at) : null;

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${
        courseMeta.term ? ` · ${courseMeta.term}` : ""
      }`
    : "Course analytics catalog";

  return (
    <AuthenticatedShell
      title={
        <span className="text-[35px] font-extrabold tracking-tight md:text-[45px]">
          Course Dashboard
        </span>
      }
      subtitle={subtitle}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={() => navigate(-1)}>← Back</Btn>
        <Btn
          onClick={async () => {
            setRefreshing(true);
            await loadCourseDashboard();
            setRefreshing(false);
          }}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </Btn>
        {courseMeta?.id ? (
          <Btn onClick={() => navigate(`/courses/${courseMeta.id}`)}>
            Open Course
          </Btn>
        ) : null}
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading course analytics...</p>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {lastUpdated ? (
            <p className="text-xs text-slate-500">
              Last updated: {lastUpdated.toLocaleString("en-US", { hour12: false })}
            </p>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            {SUMMARY_TILES.map((item) => (
              <AnalyticsSummaryCard
                key={item.key}
                label={item.label}
                value={summary[item.key]}
                hint={item.hint}
              />
            ))}
          </section>

          <PreviewListCard
            title="Representative Posts"
            subtitle="Start here when you want a classroom example or a post to review in detail."
          >
            {segmentationStatus.error ? (
              <Feedback error={segmentationStatus.error} />
            ) : null}
            {segmentationStatus.loading ? (
              <p className="text-sm text-slate-500">Loading representative posts...</p>
            ) : null}
            {!segmentationStatus.loading && !segmentation?.posts?.length ? (
              <AnalyticsEmptyState message="No representative posts are available for this course yet." />
            ) : null}
            {segmentation?.posts?.length ? (
              <div className="grid gap-3">
                {segmentation.posts.map((item) => (
                  <article
                    key={item.post_id}
                    className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">
                          {item.label}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.summary_text}
                        </p>
                      </div>
                      <ViewPostAnalysisButton
                        onClick={() =>
                          navigate(`/courses/${courseId}/posts/${item.post_id}/analytics`)
                        }
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </PreviewListCard>

          <PreviewListCard
            id="students-section"
            title="Explore by Student"
            subtitle="Preview the most active students, then open the student dashboard for a focused drill-down."
            action={
              <Btn onClick={() => navigate(`/dashboard/courses/${courseId}/students`)}>
                Open student dashboard
              </Btn>
            }
          >
            {!students.length ? (
              <AnalyticsEmptyState message="No student activity data available for this course yet." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {students.slice(0, 4).map((item, index) => (
                  <article
                    key={item.user_id}
                    className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rank {index + 1}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">
                          {item.name}
                        </h3>
                      </div>
                      <ChangeBadge value={item.change_percent} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-brand-50/70 px-3 py-2">
                        <dt className="text-slate-500">Posts</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {item.posts_total}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-brand-50/70 px-3 py-2">
                        <dt className="text-slate-500">Interactions</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {item.interactions_total}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <Btn
                        variant="primary"
                        onClick={() =>
                          navigate(
                            `/dashboard/courses/${courseId}/students/${item.user_id}`
                          )
                        }
                      >
                        Open student drill-down
                      </Btn>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </PreviewListCard>

          <PreviewListCard
            title="Explore by Hashtag"
            subtitle="Use topic-level drill-down to compare clusters of posts before opening a specific case."
            action={
              hashtags[0]?.hashtag ? (
                <Btn
                  onClick={() =>
                    navigate(
                      `/dashboard/courses/${courseId}/hashtags/${encodeURIComponent(
                        hashtags[0].hashtag
                      )}`
                    )
                  }
                >
                  Open hashtag dashboard
                </Btn>
              ) : null
            }
          >
            {!hashtags.length ? (
              <AnalyticsEmptyState message="No hashtag analytics available for this course yet." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {hashtags.slice(0, 4).map((item, index) => (
                  <article
                    key={item.hashtag}
                    className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rank {index + 1}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">
                          #{item.hashtag}
                        </h3>
                      </div>
                      <ChangeBadge value={item.change_percent} />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-brand-50/70 px-3 py-2">
                        <dt className="text-slate-500">Posts</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {item.total_posts}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-brand-50/70 px-3 py-2">
                        <dt className="text-slate-500">Interactions</dt>
                        <dd className="mt-1 font-semibold text-slate-900">
                          {item.total_interactions}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <Btn
                        variant="primary"
                        onClick={() =>
                          navigate(
                            `/dashboard/courses/${courseId}/hashtags/${encodeURIComponent(
                              item.hashtag
                            )}`
                          )
                        }
                      >
                        Open hashtag drill-down
                      </Btn>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </PreviewListCard>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
