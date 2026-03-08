import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthLayout from "./components/AuthLayout";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete, fetchCourses, courses } = useApp();

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) navigate("/login", { replace: true });
  }, [authUser, authCheckComplete, navigate]);

  useEffect(() => {
    if (authUser) fetchCourses().catch(() => {});
  }, [authUser, fetchCourses]);

  if (!authCheckComplete || !authUser) return null;

  return (
    <AuthLayout
      title="Profile"
      subtitle="View your account info and course personas"
      backTo="/courses"
    >
      <div className="space-y-6">
        <header className="flex items-center gap-4 rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-lg font-bold text-brand">
            {(authUser.full_name || authUser.username || authUser.email || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {authUser.username || authUser.email}
            </p>
            <p className="text-xs text-slate-500">{authUser.email}</p>
          </div>
        </header>

        <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Course Personas</h3>
          {courses.joined.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-orange-100 bg-orange-50 px-4 py-3 text-sm text-slate-500">
              You have not joined any courses yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-orange-50 rounded-2xl border border-orange-100 bg-white">
              {courses.joined.map((course) => (
                <li
                  key={course.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {course.course_code} · {course.name}
                    </p>
                    <p className="text-xs text-slate-500">{course.term}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        course.profile_completed
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {course.profile_completed ? "Ready" : "Profile required"}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-brand transition hover:border-brand"
                      onClick={() =>
                        navigate(
                          course.profile_completed
                            ? `/courses/${course.id}`
                            : `/courses/${course.id}/profile`
                        )
                      }
                    >
                      {course.profile_completed ? "View course" : "Complete profile"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AuthLayout>
  );
}
