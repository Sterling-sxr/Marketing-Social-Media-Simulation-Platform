import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";
import { postJson } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { isTeacher } from "../../lib/access";

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function parseIsoDateParts(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { year: "", month: "", day: "" };
  }
  const [year, month, day] = value.split("-");
  return { year, month, day };
}

function buildIsoDate(year, month, day) {
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
}

function DatePartsInput({ label, value, onChange }) {
  const currentYear = new Date().getFullYear();
  const monthOptions = [
    { value: "01", label: "Jan" },
    { value: "02", label: "Feb" },
    { value: "03", label: "Mar" },
    { value: "04", label: "Apr" },
    { value: "05", label: "May" },
    { value: "06", label: "Jun" },
    { value: "07", label: "Jul" },
    { value: "08", label: "Aug" },
    { value: "09", label: "Sep" },
    { value: "10", label: "Oct" },
    { value: "11", label: "Nov" },
    { value: "12", label: "Dec" },
  ];

  const [parts, setParts] = useState(() => parseIsoDateParts(value));

  useEffect(() => {
    setParts(parseIsoDateParts(value));
  }, [value]);

  const effectiveYear = /^\d{4}$/.test(parts.year)
    ? parts.year
    : String(currentYear);
  const dayCount = getDaysInMonth(effectiveYear, parts.month);
  const dayOptions = Array.from({ length: dayCount }, (_, idx) =>
    String(idx + 1).padStart(2, "0")
  );

  const updatePart = (key, next) => {
    const nextParts = { ...parts, [key]: next };
    if (key === "year" || key === "month") {
      const maxDay = getDaysInMonth(nextParts.year, nextParts.month);
      if (nextParts.day && Number(nextParts.day) > maxDay) {
        nextParts.day = "";
      }
    }
    setParts(nextParts);
    onChange(buildIsoDate(nextParts.year, nextParts.month, nextParts.day));
  };

  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <div className="mt-1 grid grid-cols-3 gap-2">
        <input
          type="text"
          value={parts.year}
          onChange={(e) => updatePart("year", e.target.value)}
          placeholder="Year"
          inputMode="numeric"
          maxLength={4}
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
          required
        />
        <select
          value={parts.month}
          onChange={(e) => updatePart("month", e.target.value)}
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
          required
        >
          <option value="">Month</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select
          value={parts.day}
          onChange={(e) => updatePart("day", e.target.value)}
          className="w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
          required
        >
          <option value="">Day</option>
          {dayOptions.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useAuth();
  const canCreateCourse = isTeacher(authUser);

  const [form, setForm] = useState({
    course_code: "",
    course_name: "",
    course_summary: "",
    term: "",
    start_date: "",
    end_date: "",
  });
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    message: "",
  });
  const [createdCourse, setCreatedCourse] = useState(null);
  const [termYear, setTermYear] = useState(String(new Date().getFullYear()));
  const [termPart, setTermPart] = useState("T1");

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!canCreateCourse) {
      navigate("/courses", { replace: true });
    }
  }, [authCheckComplete, authUser, canCreateCourse, navigate]);

  if (authCheckComplete && !authUser) return <Navigate to="/login" replace />;
  if (!authCheckComplete || !authUser || !canCreateCourse) return null;

  const handleCreateCourse = async () => {
    const normalizedYear = String(termYear || "").trim();
    if (!/^\d{4}$/.test(normalizedYear)) {
      setStatus({
        loading: false,
        error: "Please enter a valid 4-digit year for term (e.g. 2026).",
        message: "",
      });
      return;
    }
    const normalizedTerm = `${normalizedYear}${termPart}`;
    const payloadForm = { ...form, term: normalizedTerm };
    setStatus({ loading: true, error: "", message: "" });

    if (!payloadForm.course_code.trim() || !payloadForm.course_name.trim()) {
      setStatus({
        loading: false,
        error: "Course code and course name are required.",
        message: "",
      });
      return;
    }

    if (!form.start_date || !form.end_date) {
      setStatus({
        loading: false,
        error: "Please provide both start and end date.",
        message: "",
      });
      return;
    }

    if (!isIsoDate(form.start_date) || !isIsoDate(form.end_date)) {
      setStatus({
        loading: false,
        error: "Please enter dates in YYYY-MM-DD format.",
        message: "",
      });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setStatus({
        loading: false,
        error: "End date must be on or after start date.",
        message: "",
      });
      return;
    }

    try {
      const payload = await postJson("/api/courses/create/", payloadForm);
      const course = payload?.course || payload?.item || payload || null;
      setCreatedCourse(course);
      setForm((prev) => ({ ...prev, term: normalizedTerm }));
      setStatus({
        loading: false,
        error: "",
        message: "Course created successfully.",
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message || "Failed to create course.",
        message: "",
      });
    }
  };

  return (
    <AuthenticatedShell
      title="Create Course"
      subtitle="Create a new course for teaching and community activities."
    >
      <section className="space-y-4 rounded-3xl border border-brand-100 bg-white p-5 shadow-soft">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Course Details</h2>
          <p className="text-sm text-slate-500">
            Fill in basic details. You can edit them later in Course Management.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            Course Code
            <input
              type="text"
              value={form.course_code}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, course_code: e.target.value }))
              }
              placeholder="e.g. COMP9900"
              className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
              required
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Term
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={termYear}
                onChange={(e) => setTermYear(e.target.value)}
                placeholder="YYYY"
                maxLength={4}
                className="w-28 rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                required
              />
              <select
                value={termPart}
                onChange={(e) => setTermPart(e.target.value)}
                className="w-28 rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
              >
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
              </select>
              <span className="text-xs text-slate-500">
                Preview: {termYear || "YYYY"}
                {termPart}
              </span>
            </div>
          </label>
          <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
            Course Name
            <input
              type="text"
              value={form.course_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, course_name: e.target.value }))
              }
              placeholder="e.g. Capstone Project"
              className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
              required
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
            Course Summary
            <textarea
              rows={4}
              value={form.course_summary}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, course_summary: e.target.value }))
              }
              placeholder="Briefly describe this course for students."
              className="mt-1 w-full rounded-xl border border-brand-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
            />
          </label>
          <DatePartsInput
            label="Start Date"
            value={form.start_date}
            onChange={(next) => setForm((prev) => ({ ...prev, start_date: next }))}
          />
          <DatePartsInput
            label="End Date"
            value={form.end_date}
            onChange={(next) => setForm((prev) => ({ ...prev, end_date: next }))}
          />
        </div>

        <Feedback message={status.message} error={status.error} />

        {createdCourse ? (
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-slate-700">
            <p>
              Created:{" "}
              <span className="font-semibold">
                {createdCourse.course_code} · {createdCourse.name || createdCourse.course_name}
              </span>
            </p>
            <p className="mt-1">
              Join code:{" "}
              <span className="font-semibold">{createdCourse.join_code || "—"}</span>
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
            onClick={() => navigate("/courses/manage")}
            disabled={status.loading}
          >
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {createdCourse?.id ? (
              <>
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                  onClick={() => navigate(`/courses/${createdCourse.id}`)}
                >
                  View Course
                </button>
                <button
                  type="button"
                  className="rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
                  onClick={() => navigate("/courses/manage")}
                >
                  Back to Course Management
                </button>
              </>
            ) : (
              <button
                type="button"
                className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                onClick={handleCreateCourse}
                disabled={status.loading}
              >
                {status.loading ? "Creating..." : "Create Course"}
              </button>
            )}
          </div>
        </div>
      </section>
    </AuthenticatedShell>
  );
}
