import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postJson } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

export default function CreateCoursePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();
  const [form, setForm] = useState({
    course_code: "",
    course_name: "",
    term: "",
    start_date: "",
    end_date: "",
  });
  const [status, setStatus] = useState({ loading: false, error: "", message: "" });

  useEffect(() => {
    if (!authCheckComplete) return;

    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!authUser.is_superuser) {
      navigate("/courses", { replace: true });
    }
  }, [authUser, authCheckComplete, navigate]);

  if (!authCheckComplete || !authUser || !authUser.is_superuser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: "", message: "" });

    if (!form.start_date || !form.end_date) {
      setStatus({
        loading: false,
        error: "Please provide both the start and end date.",
        message: "",
      });
      return;
    }

    if (new Date(form.end_date) < new Date(form.start_date)) {
      setStatus({
        loading: false,
        error: "The course end date must be on or after the start date.",
        message: "",
      });
      return;
    }

    try {
      await postJson("/api/courses/create/", form);
      setStatus({ loading: false, error: "", message: "Course created successfully 🎉" });
      navigate("/courses");
    } catch (error) {
      setStatus({ loading: false, error: error.message, message: "" });
    }
  };

  return (
    <AuthenticatedShell title="Create New Course 🍩" subtitle="Only accessible by superusers">
      <main className="flex flex-col items-center justify-start py-10 px-6 bg-gradient-to-b from-orange-50 to-white rounded-2xl min-h-[calc(100vh-8rem)]">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-md border border-orange-100 p-8">
          {/* Header */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-400 to-orange-400 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-lg">🍩</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 ml-3">
              Create a Donut Course
            </h2>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Course Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Code
              </label>
              <input
                type="text"
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
                placeholder="e.g. COMP9900"
                required
                className="w-full rounded-md border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            {/* Course Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name
              </label>
              <input
                type="text"
                value={form.course_name}
                onChange={(e) => setForm({ ...form, course_name: e.target.value })}
                placeholder="e.g. Capstone Project"
                required
                className="w-full rounded-md border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Term
              </label>
              <input
                type="text"
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                placeholder="e.g. 2025T3"
                required
                className="w-full rounded-md border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
                className="w-full rounded-md border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
                className="w-full rounded-md border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="submit"
                disabled={status.loading}
                className="rounded-md bg-gradient-to-r from-orange-500 to-pink-500 text-white px-5 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200 disabled:opacity-60"
              >
                {status.loading ? "Creating..." : "Create Course"}
              </button>

              <button
                type="button"
                className="rounded-md border border-gray-200 px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-all"
                onClick={() => navigate("/courses")}
              >
                Cancel
              </button>
            </div>

            <Feedback message={status.message} error={status.error} />
          </form>
        </div>

        {/* Subtle footer tip */}
        <p className="mt-6 text-xs text-gray-400">
          🍩 Donut System · Making learning sweet and fun.
        </p>
      </main>
    </AuthenticatedShell>
  );
}
