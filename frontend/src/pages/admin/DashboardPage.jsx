import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { AnalyticsSummaryCard } from "../components/AnalyticsShared";

function SectionCard({ title, subtitle, children, right }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SUMMARY_TILES = [
  { key: "total_courses", label: "Courses" },
  { key: "registered_students", label: "Students" },
  { key: "total_posts", label: "Posts" },
  { key: "total_interactions", label: "Interactions" },
];

function CompareTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const courseName = payload[0]?.payload?.fullName || label || "";
  const interactions =
    payload.find((item) => item.dataKey === "interactions")?.value ?? 0;
  const posts = payload.find((item) => item.dataKey === "posts")?.value ?? 0;

  return (
    <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-sm shadow-md">
      <div className="font-semibold text-slate-800">{courseName}</div>
      <div className="mt-2 space-y-1 text-slate-600">
        <div>Interactions: {interactions}</div>
        <div>Posts: {posts}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { authUser, authCheckComplete } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 639px)").matches
      : false
  );

  const isAdmin = useMemo(() => isTeacher(authUser), [authUser]);

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
  }, [authCheckComplete, authUser, isAdmin, navigate, reloadDashboard]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 639px)");
    const onChange = (event) => setIsMobile(event.matches);
    setIsMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const lastUpdated = data?.calculated_at ? new Date(data.calculated_at) : null;
  const prioritizedCourses = (data?.courses || [])
    .slice()
    .map((course) => {
      const posts = Number(course.total_posts || 0);
      const interactions = Number(course.total_interactions || 0);
      const students = Number(course.registered_students || 0);
      const interactionDensity = posts > 0 ? interactions / posts : 0;
      const postingIntensity = students > 0 ? posts / students : 0;
      let badge = "Steady";
      if (interactionDensity >= 4) badge = "High interaction";
      else if (postingIntensity >= 0.75) badge = "High activity";
      else if (interactions === 0 && posts > 0) badge = "Needs attention";
      return {
        ...course,
        posts,
        interactions,
        students,
        interactionDensity,
        postingIntensity,
        badge,
      };
    })
    .sort((a, b) => {
      if (b.interactionDensity !== a.interactionDensity) {
        return b.interactionDensity - a.interactionDensity;
      }
      return b.interactions - a.interactions;
    });

  const compareData = prioritizedCourses.map((course) => ({
    name: course.course_code || course.name || String(course.id),
    fullName: `${course.course_code ? `${course.course_code} · ` : ""}${
      course.name ?? ""
    }`.trim(),
    posts: course.posts,
    interactions: course.interactions,
  }));

  const barChartWidth = Math.max(compareData.length * 88, 560);
  const maxY = Math.max(
    1,
    ...compareData.map((item) => Math.max(item.posts, item.interactions))
  );
  const yDomain = [0, Math.ceil(maxY / 100) * 100];

  return (
    <AuthenticatedShell
      title={
        <span className="text-2xl font-extrabold tracking-tight sm:text-3xl md:text-[45px]">
          Dashboard
        </span>
      }
      subtitle="Prioritize which course to inspect next"
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
                Use this hub to decide which course needs attention before you
                open course-level analytics.
              </p>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Global Overview"
            subtitle="Key metrics across all managed courses."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SUMMARY_TILES.map((tile) => (
                <AnalyticsSummaryCard
                  key={tile.key}
                  label={tile.label}
                  value={data?.[tile.key] ?? 0}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Course Priority List"
            subtitle="Pick a course to inspect based on activity and interaction density."
          >
            {!prioritizedCourses.length ? (
              <p className="text-sm text-slate-500">No course data available.</p>
            ) : (
              <div className="grid gap-3">
                {prioritizedCourses.map((course, index) => (
                  <article
                    key={course.id}
                    className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                            Priority {index + 1}
                          </span>
                          <span className="rounded-full bg-brand-100 px-2 py-1 text-xs font-semibold text-brand">
                            {course.badge}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {course.course_code
                            ? `${course.course_code} · ${course.name}`
                            : course.name || `Course ${course.id}`}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {course.term || "Course activity summary"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-brand bg-brand-100 px-4 py-2 text-xs font-semibold text-brand transition hover:bg-brand-200"
                        onClick={() =>
                          navigate(`/dashboard/courses/${course.id}`)
                        }
                      >
                        Open Course Catalog
                      </button>
                    </div>
                    <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Posts
                        </dt>
                        <dd className="mt-1 text-xl font-semibold text-slate-900">
                          {course.posts}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Interactions
                        </dt>
                        <dd className="mt-1 text-xl font-semibold text-slate-900">
                          {course.interactions}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Interactions / Post
                        </dt>
                        <dd className="mt-1 text-xl font-semibold text-slate-900">
                          {course.interactionDensity.toFixed(2)}
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-white px-4 py-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Posts / Student
                        </dt>
                        <dd className="mt-1 text-xl font-semibold text-slate-900">
                          {course.postingIntensity.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Course Comparison"
            subtitle="Supporting chart for posts and interactions across courses."
          >
            {!compareData.length ? (
              <p className="text-sm text-slate-500">No course data available.</p>
            ) : (
              <div className="w-full overflow-x-auto">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#DCEFF3" />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fill: "#475569",
                          fontSize: isMobile ? 11 : 13,
                        }}
                        interval={0}
                        tickMargin={isMobile ? 10 : 12}
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{
                          fill: "#475569",
                          fontSize: isMobile ? 11 : 13,
                        }}
                      />
                      <Tooltip content={<CompareTooltip />} />
                      <Bar
                        dataKey="posts"
                        name="Posts"
                        fill="#78DBC4"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="interactions"
                        name="Interactions"
                        fill="#62AFC3"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
