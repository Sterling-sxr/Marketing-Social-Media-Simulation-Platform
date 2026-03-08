import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJson, patchJson } from "../../lib/api";
import { useApp } from "../../context/AppContext";
import AuthenticatedShell from "../components/AuthenticatedShell";
import Feedback from "../components/Feedback";

export default function CourseManagePage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete, pushToast } = useApp();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("All");
  const [editingCourse, setEditingCourse] = useState(null);
  const [editForm, setEditForm] = useState({
    course_code: "",
    course_name: "",
    term: "",
    start_date: "",
    end_date: "",
  });
  const [editStatus, setEditStatus] = useState({ loading: false, error: "" });

  useEffect(() => {
    if (!authCheckComplete) return;

    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    if (!authUser.is_superuser) {
      navigate("/courses", { replace: true });
      return;
    }

    setStatus({ loading: true, error: "" });
    getJson("/api/courses/managed/")
      .then((data) => {
        setItems(data.items || []);
        setStatus({ loading: false, error: "" });
      })
      .catch((e) =>
        setStatus({ loading: false, error: e.message || "Failed to load data" })
      );
  }, [authUser, authCheckComplete, navigate]);

  if (!authCheckComplete || !authUser || !authUser.is_superuser) return null;

  // ✅ Fixed search logic (case-insensitive + correct field names)
  const filteredItems = items.filter((c) => {
    const query = search.toLowerCase();
    const matchSearch =
      c.course_name?.toLowerCase().includes(query) ||
      c.course_code?.toLowerCase().includes(query) ||
      c.join_code?.toLowerCase().includes(query);
    const matchTerm = termFilter === "All" || c.term === termFilter;
    return matchSearch && matchTerm;
  });

  return (
    <AuthenticatedShell title="Course Management" subtitle="Manage all your Donut courses 🍩">
      <main className="flex-1 p-8 bg-gradient-to-b from-orange-50 to-white rounded-2xl min-h-[calc(100vh-8rem)]">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-400 via-orange-400 to-yellow-300 rounded-full flex items-center justify-center shadow-md animate-pulse">
              <span className="text-white text-lg font-bold">🍩</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Donut Courses
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Sweet learning for creative minds 🍬
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-orange-500 to-pink-500 text-white px-5 py-2 text-sm font-medium shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            onClick={() => navigate("/courses/create")}
          >
            <span className="text-lg leading-none">＋</span>
            Create New Course
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="🔍 Search by course name, code, or join code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 w-full rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 outline-none transition-all duration-150"
          />
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm text-gray-700 focus:border-pink-400 focus:ring-2 focus:ring-pink-200 transition-all duration-150"
          >
            <option value="All">All Terms</option>
            <option value="2025T1">2025T1</option>
            <option value="2025T2">2025T2</option>
            <option value="2025T3">2025T3</option>
          </select>
        </div>

        {/* Error feedback */}
        {status.error && <Feedback error={status.error} />}

        {/* Loading state */}
        {status.loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <span className="animate-spin text-3xl mb-2">🍩</span>
            Loading your courses...
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty state */
          search.trim() ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-orange-100">
              <div className="text-6xl mb-3">🔍</div>
              <p className="text-gray-700 font-medium">No matching courses found</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your search or filter
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-orange-100">
              <div className="text-6xl mb-3">🍩</div>
              <p className="text-gray-700 font-medium">No courses created yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Start by creating your first course
              </p>
              <button
                className="mt-4 rounded-md bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 text-sm font-medium hover:shadow-md hover:scale-105 transition-all"
                onClick={() => navigate("/courses/create")}
              >
                ＋ Create Course
              </button>
            </div>
          )
        ) : (
          /* Course list grid */
          <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((c) => (
              <li
                key={c.id}
                className="group rounded-2xl border border-orange-100 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex flex-col justify-between h-full">
                  <div>
                    <p className="text-lg font-semibold text-gray-800 group-hover:text-orange-600 transition">
                      {c.course_code} · {c.course_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {c.term} · Join Code: {c.join_code}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex w-44 items-center justify-center gap-2 rounded-md border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-500 hover:bg-orange-500 hover:text-white shadow-sm transition-all duration-150"
                      onClick={() => navigate(`/courses/${c.id}`)}
                    >
                      Enter Course →
                    </button>
                    <button
                      type="button"
                      className="inline-flex w-44 items-center justify-center gap-2 rounded-md border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-500 hover:bg-orange-500 hover:text-white shadow-sm transition-all duration-150"
                      onClick={() => navigate(`/courses/${c.id}/ai-users`)}
                    >
                      Manage AI Users →
                    </button>
                    <button
                      type="button"
                      className="inline-flex w-44 items-center justify-center gap-2 rounded-md border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-500 hover:bg-orange-500 hover:text-white shadow-sm transition-all duration-150"
                      onClick={() => {
                        setEditingCourse(c);
                        setEditForm({
                          course_code: c.course_code || "",
                          course_name: c.course_name || c.name || "",
                          term: c.term || "",
                          start_date: c.start_date || "",
                          end_date: c.end_date || "",
                        });
                        setEditStatus({ loading: false, error: "" });
                      }}
                    >
                      Edit Course
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editingCourse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Edit Course</h3>
                <p className="text-xs text-slate-500">
                  Update the course information and save the changes.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-orange-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
                onClick={() => setEditingCourse(null)}
                disabled={editStatus.loading}
              >
                Close
              </button>
            </header>

            <form
              className="mt-4 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setEditStatus({ loading: true, error: "" });
                if (!editForm.start_date || !editForm.end_date) {
                  setEditStatus({
                    loading: false,
                    error: "Please provide both the start and end date.",
                  });
                  return;
                }
                if (new Date(editForm.end_date) < new Date(editForm.start_date)) {
                  setEditStatus({
                    loading: false,
                    error: "The course end date must be on or after the start date.",
                  });
                  return;
                }
                try {
                  const response = await patchJson(`/api/courses/${editingCourse.id}/`, editForm);
                  const updated = response.course || {};
                  setItems((prev) =>
                    prev.map((item) =>
                      item.id === editingCourse.id
                        ? { ...item, ...updated }
                        : item
                    )
                  );
                  setEditingCourse(null);
                  setEditStatus({ loading: false, error: "" });
                  pushToast({
                    title: "Course updated",
                    message: `${updated.course_code || editForm.course_code} has been updated successfully.`,
                  });
                } catch (error) {
                  setEditStatus({
                    loading: false,
                    error: error.message || "Failed to update course.",
                  });
                }
              }}
            >
              <label className="block text-xs font-semibold text-slate-600">
                Course Code
                <input
                  type="text"
                  value={editForm.course_code}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, course_code: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  required
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Course Name
                <input
                  type="text"
                  value={editForm.course_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, course_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  required
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Term
                <input
                  type="text"
                  value={editForm.term}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, term: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                  placeholder="e.g. 2025T1"
                  required
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Start Date
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                    required
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  End Date
                  <input
                    type="date"
                    value={editForm.end_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-orange-200 px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-brand"
                    required
                  />
                </label>
              </div>

              {editStatus.error ? <Feedback error={editStatus.error} /> : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-full border border-orange-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-brand hover:text-brand"
                  onClick={() => setEditingCourse(null)}
                  disabled={editStatus.loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full border border-brand bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
                  disabled={editStatus.loading}
                >
                  {editStatus.loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}
