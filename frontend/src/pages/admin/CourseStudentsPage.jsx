import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { getJson } from "../../lib/api";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

/* Shared button style (matches Dashboard) */
function Btn({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  className = "",
  disabled = false,
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand " +
    "active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";
  const styles = {
    primary: "border border-brand bg-orange-100 text-brand hover:bg-orange-200",
    secondary:
      "border border-orange-200 bg-white text-slate-600 hover:border-brand hover:text-brand",
    link: "border border-transparent bg-transparent text-brand underline decoration-dotted underline-offset-4 hover:text-brand/80 hover:decoration-solid",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

/* Subtle WoW badge to differentiate from leaderboard view */
function SmallChange({ value }) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
        —
      </span>
    );
  }
  if (value === 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
        0%
      </span>
    );
  }
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
      title="Week-over-Week change"
    >
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      {`${positive ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

export default function CourseStudentsPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });

  // Page-level UI state: search / sort / active-only toggle
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name | posts | interactions
  const [onlyActive, setOnlyActive] = useState(false);

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
    if (!Number.isFinite(courseId)) {
      setStatus({ loading: false, error: "Invalid course id." });
      return;
    }

    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/`)
      .then((payload) => {
        setData(payload.course || null);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load students.",
        });
      });
  }, [authCheckComplete, authUser, isAdmin, courseId, navigate]);

  if (authCheckComplete && authUser && !isAdmin) {
    return <Navigate to="/courses" replace />;
  }

  const courseMeta = data?.course;
  const raw = data?.students || [];

  // Apply filtering, sorting, and derived metrics
  const rows = useMemo(() => {
    let arr = raw.map((s) => {
      const posts = Number(s.posts_total || 0);
      const inter = Number(s.interactions_total || 0);
      const engagement = posts > 0 ? inter / posts : 0; // Interactions per post
      return { ...s, posts, inter, engagement };
    });

    if (onlyActive) {
      arr = arr.filter((s) => s.posts > 0 || s.inter > 0);
    }

    if (q.trim()) {
      const key = q.trim().toLowerCase();
      arr = arr.filter(
        (s) =>
          String(s.name || "")
            .toLowerCase()
            .includes(key) ||
          String(s.user_id || "")
            .toLowerCase()
            .includes(key)
      );
    }

    const cmp = {
      name: (a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
        }),
      posts: (a, b) => b.posts - a.posts,
      interactions: (a, b) => b.inter - a.inter,
    }[sortBy];

    return arr.sort(cmp);
  }, [raw, q, sortBy, onlyActive]);

  const subtitle = courseMeta
    ? `${courseMeta.course_code} · ${courseMeta.name}${
        courseMeta.term ? ` · ${courseMeta.term}` : ""
      }`
    : "All registered students";

  return (
    <AuthenticatedShell title="All Students" subtitle={subtitle}>
      {/* Top nav actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="secondary" onClick={() => navigate(-1)}>
          ← Back
        </Btn>
        {/* <Btn
          variant="secondary"
          onClick={() => navigate(`/dashboard/courses/${courseId}`)}
        >
          Course Dashboard
        </Btn> */}
        {/* {courseMeta ? (
          <Btn
            variant="primary"
            onClick={() => navigate(`/courses/${courseMeta.id}`)}
          >
            All posts
          </Btn>
        ) : null} */}
      </div>

      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading students...</p>
      ) : null}

      {/* Toolbar: search / sort / active-only */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-3xl border border-orange-100 bg-white p-3">
        <div className="input-shell">
          <input
            className="w-48 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            placeholder="Search name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="rounded-full border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {/* <option value="name">Sort by Name (A–Z)</option> */}
          <option value="posts">Sort by Posts</option>
          <option value="interactions">Sort by Interactions</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          Only active
        </label>
      </div>

      {/* Roster table: emphasize basics plus interactions per post */}
      {rows.length === 0 ? (
        <EmptyState message="No students found." />
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-orange-100">
          <table className="min-w-full divide-y divide-orange-100 text-sm">
            <thead className="bg-orange-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                {/* <th className="px-4 py-3 font-semibold">zID</th> */}
                <th className="px-4 py-3 font-semibold">Posts</th>
                <th className="px-4 py-3 font-semibold">Total Interactions</th>
                <th className="px-4 py-3 font-semibold">Engagement / Post</th>
                <th className="px-4 py-3 font-semibold">Sentiment (Top)</th>
                <th className="px-4 py-3 font-semibold text-right">WoW</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-50 bg-white/80">
              {rows.map((s) => {
                const top = s?.sentiment?.top_label;
                const pct =
                  typeof s?.sentiment?.top_percent === "number"
                    ? `${s.sentiment.top_percent.toFixed(1)}%`
                    : "—";
                const engagement =
                  s.posts > 0 ? (s.inter / s.posts).toFixed(2) : "0.00";

                return (
                  <tr key={s.user_id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {s.name}
                    </td>
                    {/* <td className="px-4 py-3 text-slate-600">{s.user_id}</td> */}
                    <td className="px-4 py-3 text-slate-600">{s.posts}</td>
                    <td className="px-4 py-3 text-slate-600">{s.inter}</td>
                    <td className="px-4 py-3 text-slate-600">{engagement}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {top ? `${top} · ${pct}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SmallChange value={s.change_percent} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Btn
                          variant="link"
                          onClick={() =>
                            navigate(
                              `/dashboard/courses/${courseId}/students/${s.user_id}`
                            )
                          }
                          className="px-0 py-0"
                        >
                          View analytics
                        </Btn>
                        {/** Quick link back to the course posts (same as “All posts”) */}
                        <Btn
                          variant="link"
                          onClick={() => {
                            if (data?.course?.id)
                              navigate(`/courses/${data.course.id}`);
                          }}
                          className="px-0 py-0"
                        >
                          Open course
                        </Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AuthenticatedShell>
  );
}
