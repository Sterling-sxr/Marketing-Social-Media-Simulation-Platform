import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { getJson } from "../lib/api";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";
import CourseSecondaryNav from "./components/CourseSecondaryNav";

export default function CourseMembersPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [members, setMembers] = useState([]);

  const isTeacher = Boolean(authUser?.is_superuser || authUser?.is_staff);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!isTeacher) {
      navigate("/courses", { replace: true });
      return;
    }
    setStatus({ loading: true, error: "" });
    getJson(`/api/admin/dashboard/courses/${courseId}/`)
      .then((data) => {
        setMembers(data.course?.students || []);
        setStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        setStatus({
          loading: false,
          error: error.message || "Failed to load course members.",
        });
      });
  }, [authCheckComplete, authUser, isTeacher, navigate, courseId]);

  if (authCheckComplete && !authUser) return <Navigate to="/login" replace />;

  return (
    <AuthenticatedShell title="Course Members" subtitle="Member roster and participation">
      <CourseSecondaryNav courseId={courseId} />
      {status.error ? <Feedback error={status.error} /> : null}
      {status.loading ? <p className="text-sm text-slate-500">Loading members...</p> : null}

      {!status.loading ? (
        members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-500">
            No members found for this course.
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li
                key={member.user_id}
                className="flex items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                  <p className="text-xs text-slate-500">Posts: {member.posts_total || 0}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:border-brand"
                  onClick={() =>
                    navigate(`/dashboard/courses/${courseId}/students/${member.user_id}`)
                  }
                >
                  View Student Dashboard
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </AuthenticatedShell>
  );
}
