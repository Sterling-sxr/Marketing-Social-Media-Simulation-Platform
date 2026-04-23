import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, UserRound, BookOpen } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import { ViewPostAnalysisButton } from "../components/AnalyticsShared";

const SUMMARY_TILES = [
  {
    key: "total_posts",
    label: "Total Posts",
    description: "Posts published in this course",
    tone: "bg-brand-100 text-brand",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    key: "total_likes",
    label: "Total Likes",
    description: "Likes gathered across all posts",
    tone: "bg-amber-100 text-amber-600",
    icon: <span className="text-base leading-none">♥</span>,
  },
  {
    key: "total_comments",
    label: "Total Comments",
    description: "Comments received in this course",
    tone: "bg-sky-100 text-sky-600",
    icon: <span className="text-base leading-none">💬</span>,
  },
  {
    key: "total_views",
    label: "Total Views",
    description: "Total post views recorded",
    tone: "bg-emerald-100 text-emerald-600",
    icon: <span className="text-base leading-none">◉</span>,
  },
];

function SummaryCard({ item, value }) {
  return (
    <div className="grid min-h-[94px] grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3.5 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
      <div
        className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-[14px] ${item.tone}`}
      >
        {item.icon}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-slate-600">{item.label}</div>
        <div className="mt-0.5 text-[24px] font-extrabold leading-none tracking-tight text-slate-950">
          {formatCount(value)}
        </div>
        <div className="mt-1.5 text-[12px] font-medium text-slate-500">{item.description}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, tone = "default" }) {
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
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { hour12: false });
}

export default function CourseStudentDashboardPage() {
  const { courseId: courseIdParam, studentId: studentIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const studentId = Number(studentIdParam);
  const { authUser, authCheckComplete } = useApp();
  const authUserId = authUser?.id ?? null;
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  const isAdmin = useMemo(
    () => Boolean(authUser && (authUser.is_superuser || authUser.is_staff)),
    [authUser]
  );

  const canView = useMemo(() => {
    if (!authUser) return false;
    if (isAdmin) return true;
    return Number(authUser.id) === studentId;
  }, [authUser, isAdmin, studentId]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUserId) {
      navigate("/login", { replace: true });
      return;
    }
    if (!Number.isFinite(courseId) || !Number.isFinite(studentId)) {
      setStatus({ loading: false, error: "Invalid course or student id." });
      return;
    }
    if (!canView) {
      setStatus({ loading: false, error: "You do not have access to this student analytics." });
      return;
    }

    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/students/${studentId}/`)
      .then((payload) => {
        setData(payload.student || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load student analytics.",
        });
      });
  }, [authCheckComplete, authUserId, canView, courseId, studentId, navigate]);

  if (authCheckComplete && authUser && !canView) {
    return <Navigate to="/courses" replace />;
  }

  const summary = data?.summary || {};
  const topPosts = data?.top_posts || [];
  const courseMeta = data?.course;
  const studentInfo = data?.student;

  const subtitleParts = [];
  if (courseMeta) {
    subtitleParts.push(`${courseMeta.course_code} · ${courseMeta.name}`);
    if (courseMeta.term) subtitleParts.push(courseMeta.term);
  }
  if (studentInfo?.name) {
    subtitleParts.push(studentInfo.name);
  }

  const subtitle = subtitleParts.join(" · ") || "Student analytics overview";

  return (
    <AuthenticatedShell
      title={
        <span className="text-[34px] leading-none font-extrabold tracking-tight text-slate-900">
          Student Course Analytics
        </span>
      }
      subtitle={subtitle}
      wideContent
      hideSidebar
    >

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading student analytics...</p>
      ) : null}

      {data ? (
        <div className="space-y-3 pb-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                  onClick={() => navigate(`/dashboard/courses/${courseId}`)}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Course Dashboard
                </button>
                {courseMeta ? (
                  <button
                    type="button"
                    className="inline-flex h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-brand shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand"
                    onClick={() => navigate(`/courses/${courseMeta.id}`)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Open Course
                  </button>
                ) : null}
              </div>
              {studentInfo ? (
                <button
                  type="button"
                  className="inline-flex h-[44px] items-center justify-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition hover:border-brand hover:text-brand"
                  onClick={() => navigate(`/people/${studentInfo.id}`)}
                >
                  <UserRound className="h-4 w-4" />
                  View Profile
                </button>
              ) : null}
            </div>

            {data.calculated_at ? (
              <div className="rounded-[20px] border border-brand-100 bg-white/90 px-4 py-3 text-[12px] text-slate-500 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                Generated at: {formatDate(data.calculated_at)}
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-4">
              {SUMMARY_TILES.map((item) => (
                <SummaryCard key={item.key} item={item} value={summary[item.key]} />
              ))}
            </div>
          </div>

          <SectionCard
            title="Top Posts by Engagement"
            subtitle="Most engaging posts from this student, ranked by total interactions."
            tone="mint"
          >
            {topPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/80 px-4 py-6 text-sm text-slate-500">
                No posts found for this student in the selected course.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
                <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] border-b border-accent-100">
                      <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-slate-700">
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Post</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Likes</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Comments</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Views</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Total Interactions</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3">Created</th>
                        <th className="sticky top-0 z-10 bg-[#ffefd9] px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {topPosts.map((post) => (
                        <tr key={post.post_id} className="odd:bg-white even:bg-brand-50/30">
                          <td className="px-4 py-3 text-slate-700">
                            {post.preview || "No content"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatCount(post.likes)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatCount(post.comments)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatCount(post.views)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {formatCount(post.interactions)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDate(post.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ViewPostAnalysisButton
                              onClick={() =>
                                navigate(
                                  `/courses/${courseId}/posts/${post.post_id}/analytics`
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
