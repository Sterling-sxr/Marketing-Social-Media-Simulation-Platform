// Context: Compute shared values once so all branches use the same normalized inputs.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import Feedback from "./components/Feedback";

// Purpose: `RoleBadge` owns one cohesive concern so state transitions and side effects remain easy to trace.
function RoleBadge({ courseRole, isStaff, isSuperuser }) {
  const roleFromCourse = (courseRole || "").toString().toLowerCase();

  const isTeacher =
    roleFromCourse === "teacher" ||
    roleFromCourse === "instructor" ||
    isStaff ||
    isSuperuser;

  const text = isTeacher ? "TEACHER" : "STUDENT";

  // Context: Compute shared values once so all branches use the same normalized inputs.
  const cls = isTeacher
    ? // Inline explanation: Keep this non-obvious normalization rule explicit.
      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-800 shadow-sm border border-accent-200 bg-gradient-to-r from-accent-50 via-accent-100 to-brand-50"
    : // Inline explanation: Keep this non-obvious normalization rule explicit.
      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-700 shadow-sm border border-accent-200 bg-gradient-to-r from-accent-50 via-accent-50 to-brand-50";

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
    navigate(`/courses/${course.id}`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await joinCourse();
  };

  const enrolledCount = courses.joined.length;
  const isAdmin = !!authUser?.is_staff || !!authUser?.is_superuser;

  return (
    <AuthenticatedShell
      title="Course Center"
      subtitle="Join a course to access the class community"
    >
      {isAdmin ? (
        <section className="lg:hidden" aria-label="Admin quick actions">
          <div className="grid grid-cols-2 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label="Go to dashboard"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate("/courses/manage")}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label="Go to course management"
            >
              Manage
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
            Enrolled Courses
          </h2>
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {enrolledCount} joined
          </p>
        </div>
        {courses.joined.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-500">
            Not enrolled in any courses yet
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.joined.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className="flex min-h-[88px] w-full flex-col items-start gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[96px] sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => handleEnterCourse(course)}
                  aria-label={`Enter course ${course.course_code} ${course.name}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-semibold text-slate-800">
                      {course.course_code} · {course.name}
                    </p>
                    <p className="text-xs text-slate-400">{course.term}</p>
                  </div>

                  {/* Context: Keep related UI rendering and event handlers together for predictable updates. Reason: Grouping this logic makes interaction flows easier to debug and extend. */}
                  <div className="self-end sm:self-center">
                    <RoleBadge
                      courseRole={course.role} // Inline explanation: Keep this non-obvious normalization rule explicit.
                      isStaff={!!authUser?.is_staff} // Inline explanation: Keep this non-obvious normalization rule explicit.
                      isSuperuser={!!authUser?.is_superuser} // Inline explanation: Keep this non-obvious normalization rule explicit.
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
            Join by Code
          </h2>
          <span className="text-xs text-slate-500">Fastest way to enroll</span>
        </div>
        <h3 className="sr-only">
          Enroll in the course by code
        </h3>
        <form className="space-y-2.5 sm:space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-600">
            Course invitation code
            <div className="input-shell mt-2">
              <input
                type="text"
                value={joinCode}
                placeholder="Like JOINCOMM"
                maxLength={24}
                autoCapitalize="characters"
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={courseStatus.loading}
            className="w-full rounded-2xl bg-brand py-3 text-base font-semibold tracking-wide text-white shadow-brand transition-all duration-300 hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Enroll in course using invitation code"
          >
            {courseStatus.loading ? "Joining..." : "Enroll the course"}
          </button>
        </form>
        <div className="pt-1">
          <Feedback message={courseStatus.message} error={courseStatus.error} />
        </div>
      </section>

    </AuthenticatedShell>
  );
}
