// Keep the top imports unchanged
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

// Centralized badge renderer for TEACHER / STUDENT
function RoleBadge({ courseRole, isStaff, isSuperuser }) {
  const roleFromCourse = (courseRole || "").toString().toLowerCase();

  const isTeacher =
    roleFromCourse === "teacher" ||
    roleFromCourse === "instructor" ||
    isStaff ||
    isSuperuser;

  const text = isTeacher ? "TEACHER" : "STUDENT";

  // Soft gradient capsule badge
  const cls = isTeacher
    ? // Teacher badge: amber/orange gradient
      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 shadow-sm border border-amber-200 bg-gradient-to-r from-amber-50 via-amber-100 to-orange-50"
    : // Student badge: pastel purple to peach gradient
      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700 shadow-sm border border-purple-200 bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50";

  return <span className={cls}>{text}</span>;
}



export default function CoursesPage() {
  const navigate = useNavigate();
  const {
    authUser,
    authCheckComplete,
    courses,
    fetchCourses,
    courseStatus,
    joinCode,
    setJoinCode,
    joinCourse,
  } = useApp();

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    fetchCourses().catch(() => {});
  }, [authUser, authCheckComplete, fetchCourses, navigate]);

  if (!authCheckComplete || !authUser) {
    return null;
  }

  const handleEnterCourse = (course) => {
    if (!course) return;
    if (course.profile_completed) {
      navigate(`/courses/${course.id}`);
    } else {
      navigate(`/courses/${course.id}/profile`);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await joinCourse();
  };

  return (
    <AuthenticatedShell
      title="Course Center"
      subtitle="Join a course to access the class community"
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Enrolled Course
        </h2>
        {courses.joined.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-500">
            Not enrolled in any courses yet
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.joined.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => handleEnterCourse(course)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {course.course_code} · {course.name}
                    </p>
                    <p className="text-xs text-slate-400">{course.term}</p>
                    {!course.profile_completed ? (
                      <p className="mt-1 text-xs font-medium text-orange-500">
                        Complete your course profile to enter
                      </p>
                    ) : null}
                  </div>

                  {/* Replaced raw {course.role} with RoleBadge for consistent rendering */}
                  <RoleBadge
                    courseRole={course.role} // Role returned from the course payload (if any)
                    isStaff={!!authUser?.is_staff} // Boolean flags from Django auth user
                    isSuperuser={!!authUser?.is_superuser} // Boolean flags from Django auth user
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sections below (available courses + join form) stay the same */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Course that can enrol
        </h2>
        {courses.available.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-500">
            No more courses available.
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.available.map((course) => (
              <li
                key={course.id}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {course.course_code} · {course.name}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{course.term}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-5">
        <h2 className="text-lg font-semibold text-slate-800">
          Enroll in the course by code
        </h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-600">
            Course invitation code
            <div className="input-shell mt-2">
              <input
                type="text"
                value={joinCode}
                placeholder="Like JOINCOMM"
                onChange={(event) => setJoinCode(event.target.value)}
                className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </label>
<button
  type="submit"
  disabled={courseStatus.loading}
  className="w-full rounded-2xl py-3 text-base font-semibold tracking-wide transition-all duration-300 focus:outline-none"
  style={{
    background:
      "linear-gradient(90deg, #FFE8D6 0%, #FDBA74 35%, #E9D5FF 100%)", // Orange/apricot to lavender glow
    color: "#7C2D12", // Warm amber text color
    boxShadow:
      "0 10px 25px rgba(249,115,22,0.22), 0 8px 20px rgba(192,132,252,0.2)",
    filter: "brightness(1.06)",
  }}
>
  {courseStatus.loading ? "Joining..." : "Enroll the course"}
</button>

        </form>
        <Feedback message={courseStatus.message} error={courseStatus.error} />
      </section>
    </AuthenticatedShell>
  );
}
