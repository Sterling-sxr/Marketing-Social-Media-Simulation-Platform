// Keep the top imports unchanged
import { useEffect, useState } from "react";
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
  const [availableExpanded, setAvailableExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    fetchCourses().catch(() => {});
  }, [authUser, authCheckComplete, fetchCourses, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event) => {
      setAvailableExpanded(event.matches);
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

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

  const enrolledCount = courses.joined.length;
  const availableCount = courses.available.length;
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
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
              aria-label="Go to dashboard"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate("/courses/manage")}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
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
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-500">
            Not enrolled in any courses yet
          </p>
        ) : (
          <ul className="space-y-3">
            {courses.joined.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className="flex min-h-[88px] w-full flex-col items-start gap-3 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[96px] sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => handleEnterCourse(course)}
                  aria-label={`Enter course ${course.course_code} ${course.name}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-sm font-semibold text-slate-800">
                      {course.course_code} · {course.name}
                    </p>
                    <p className="text-xs text-slate-400">{course.term}</p>
                    {!course.profile_completed ? (
                      <p className="mt-1 rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600">
                        Complete your course profile to enter
                      </p>
                    ) : null}
                  </div>

                  {/* Replaced raw {course.role} with RoleBadge for consistent rendering */}
                  <div className="self-end sm:self-center">
                    <RoleBadge
                      courseRole={course.role} // Role returned from the course payload (if any)
                      isStaff={!!authUser?.is_staff} // Boolean flags from Django auth user
                      isSuperuser={!!authUser?.is_superuser} // Boolean flags from Django auth user
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-4 sm:px-5 sm:py-5">
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
            className="w-full rounded-2xl py-3 text-base font-semibold tracking-wide transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              background:
                "linear-gradient(90deg, #FFE8D6 0%, #FDBA74 35%, #E9D5FF 100%)", // Orange/apricot to lavender glow
              color: "#7C2D12", // Warm amber text color
              boxShadow:
                "0 10px 25px rgba(249,115,22,0.22), 0 8px 20px rgba(192,132,252,0.2)",
              filter: "brightness(1.06)",
            }}
            aria-label="Enroll in course using invitation code"
          >
            {courseStatus.loading ? "Joining..." : "Enroll the course"}
          </button>
        </form>
        <div className="pt-1">
          <Feedback message={courseStatus.message} error={courseStatus.error} />
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4">
        <button
          type="button"
          onClick={() => setAvailableExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-left transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-expanded={availableExpanded}
          aria-controls="available-courses-list"
        >
          <span>
            <span className="block text-base font-semibold text-slate-800 sm:text-lg">
              Courses You Can Enroll
            </span>
            <span className="block text-xs text-slate-500 sm:text-sm">
              {availableCount} available
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-slate-500 transition ${
              availableExpanded ? "rotate-180" : ""
            }`}
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.12l3.71-3.89a.75.75 0 1 1 1.08 1.04l-4.25 4.45a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z" />
            </svg>
          </span>
        </button>
        {courses.available.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-500">
            No more courses available.
          </p>
        ) : availableExpanded ? (
          <ul id="available-courses-list" className="space-y-2.5 sm:space-y-3">
            {courses.available.map((course) => (
              <li
                key={course.id}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-sm"
              >
                <p className="break-words text-sm font-semibold text-slate-800">
                  {course.course_code} · {course.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">{course.term}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </AuthenticatedShell>
  );
}
