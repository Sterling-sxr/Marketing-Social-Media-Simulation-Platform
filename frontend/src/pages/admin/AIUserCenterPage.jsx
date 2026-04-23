import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import { getJson } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AIUserCenterPage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useAuth();
  const authUserId = authUser?.id ?? null;
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUserId) return;
    setStatus({ loading: true, error: "" });
    getJson("/api/courses/managed/")
      .then((data) => {
        setCourses(data.items || []);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load courses for AI users.",
        });
      });
  }, [authUserId, authCheckComplete]);

  if (authCheckComplete && !authUser) return <Navigate to="/login" replace />;
  if (!authCheckComplete || !authUser) return null;

  return (
    <AuthenticatedShell
      title="AI User Center"
      subtitle="Select a course to manage AI users"
    >
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? (
        <p className="text-sm text-slate-500">Loading courses...</p>
      ) : null}

      {!status.loading ? (
        courses.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-5">
            <p className="text-sm text-slate-600">
              You do not have any courses yet. Please create a course first.
            </p>
            <button
              type="button"
              className="mt-3 rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
              onClick={() => navigate("/courses/create")}
            >
              Create Course
            </button>
          </section>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((course) => (
              <li
                key={course.id}
                className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {course.course_code} · {course.course_name || course.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {course.term || "No term"} · Join code: {course.join_code || "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
                    onClick={() => navigate(`/courses/${course.id}/ai-users`)}
                  >
                    Manage AI Users
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    View Course
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </AuthenticatedShell>
  );
}
