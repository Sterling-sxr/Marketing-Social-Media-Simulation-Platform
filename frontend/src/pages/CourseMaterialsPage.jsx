import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCourse } from "../context/CourseContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { getJson, deleteJson } from "../lib/api";
import { canManageCourse } from "../lib/access";
import {
  Bell,
  BookOpen,
  BotMessageSquare,
  Download,
  Eye,
  FileText,
  Home,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "assignment", label: "Assignment" },
  { value: "reading", label: "Reading" },
  { value: "exam", label: "Exam" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS = {
  lecture: "bg-blue-50 text-blue-700 border-blue-200",
  tutorial: "bg-purple-50 text-purple-700 border-purple-200",
  assignment: "bg-orange-50 text-orange-700 border-orange-200",
  reading: "bg-green-50 text-green-700 border-green-200",
  exam: "bg-red-50 text-red-700 border-red-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fileIcon(contentType, originalName) {
  const ext = (originalName || "").split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["xls", "xlsx"].includes(ext)) return "📋";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "🖼️";
  if (["zip", "rar", "7z"].includes(ext)) return "📦";
  if (["mp4", "mov"].includes(ext)) return "🎬";
  return "📎";
}

/* Function note: isPreviewable encapsulates this unit of behavior. */
function isPreviewable(contentType, originalName) {
  const ext = (originalName || "").split(".").pop().toLowerCase();
  const previewableExts = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "mov", "webm"];
  if (previewableExts.includes(ext)) return true;
  if (!contentType) return false;
  return (
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    contentType.startsWith("video/")
  );
}

function UploadModal({ courseId, onClose, onSuccess }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: "" });
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setStatus({ loading: false, error: "Please select a file." });
      return;
    }
    if (!title.trim()) {
      setStatus({ loading: false, error: "Title is required." });
      return;
    }
    setStatus({ loading: true, error: "" });
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("file", file);

      const res = await fetch(`/api/courses/${courseId}/materials/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      // Section note: groups related logic for readability.
      onSuccess(data.material ?? data);
    } catch (err) {
      setStatus({ loading: false, error: err.message || "Upload failed." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] border border-slate-100 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Upload Material</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 Lecture Slides"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              File <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50"
            >
              <Upload className="mb-2 h-6 w-6 text-brand-400" />
              {file ? (
                <span className="text-sm font-medium text-slate-700">{file.name}</span>
              ) : (
                <>
                  <span className="text-sm font-semibold text-brand-700">Click to choose a file</span>
                  <span className="text-xs text-slate-400">PDF, DOCX, PPTX, ZIP, images — max 50 MB</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar,.7z,.mp4,.mov"
            />
          </div>

          {status.error && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
              {status.error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status.loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MaterialCard({ material, canDelete, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const colorClass = CATEGORY_COLORS[material.category] || CATEGORY_COLORS.other;

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${material.title}"?`)) return;
    setDeleting(true);
    onDelete(material.id);
  };

  return (
    <div className="group flex items-start gap-4 rounded-[1.4rem] border border-slate-100 bg-white px-4 py-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-2xl">
        {fileIcon(material.content_type, material.original_name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {material.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {material.original_name} · {formatBytes(material.size)}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${colorClass}`}
          >
            {material.category}
          </span>
        </div>

        {material.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
            {material.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">
            {material.uploaded_by && (
              <span className="font-medium text-slate-600">{material.uploaded_by}</span>
            )}
            {material.uploaded_by && " · "}
            {formatDate(material.uploaded_at)}
          </span>

          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                aria-label="Delete material"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {isPreviewable(material.content_type, material.original_name) && (
              <a
                href={material.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </a>
            )}
            <a
              href={material.file_url}
              target="_blank"
              rel="noreferrer"
              download={material.original_name}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CourseMaterialsPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useAuth();
  const { courses, fetchCourses } = useCourse();

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [courseName, setCourseName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const isTeacherOrAdmin = useMemo(() => {
    const allCourses = [...(courses.joined || []), ...(courses.available || [])];
    const membership = allCourses.find((c) => c.id === courseId);
    return canManageCourse(authUser, membership);
  }, [authUser, courses, courseId]);

  useEffect(() => {
    if (!authCheckComplete) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    fetchCourses().catch(() => {});
  }, [authCheckComplete, authUser, fetchCourses, navigate]);

  useEffect(() => {
    if (!authUser) return;
    const allCourses = [...(courses.joined || []), ...(courses.available || [])];
    const found = allCourses.find((c) => c.id === courseId);
    if (found) setCourseName(`${found.course_code} ${found.name}`.trim());
  }, [courses, courseId, authUser]);

  const loadMaterials = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const params = activeCategory !== "all" ? `?category=${activeCategory}` : "";
      const data = await getJson(`/api/courses/${courseId}/materials/${params}`);
      // Section note: groups related logic for readability.
      setMaterials(Array.isArray(data) ? data : data.items ?? data.materials ?? []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load materials.");
    } finally {
      setLoading(false);
    }
  }, [authUser, courseId, activeCategory]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const filteredMaterials = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => {
      const haystack = [
        m.title,
        m.original_name,
        m.description,
        m.category,
        m.uploaded_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [materials, searchQuery]);

  const handleDelete = async (materialId) => {
    try {
      await deleteJson(`/api/courses/${courseId}/materials/${materialId}/`);
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (err) {
      alert(err.message || "Failed to delete material.");
    }
  };

  // Section note: groups related logic for readability.
  // Section note: groups related logic for readability.
  const globalMobileNav = useMemo(
    () => [
      { to: "/studenthome", label: "Home", icon: <Home className="h-5 w-5" /> },
      { to: "/courses", label: "Courses", icon: <BookOpen className="h-5 w-5" /> },
      { to: "/search", label: "Search", icon: <Search className="h-5 w-5" /> },
      { to: "/notifications", label: "Messages", icon: <Bell className="h-5 w-5" /> },
      { to: "/ai-tutor", label: "AI Tutor", icon: <BotMessageSquare className="h-5 w-5" /> },
    ],
    []
  );

  if (authCheckComplete && !authUser) {
    return <Navigate to="/login" replace />;
  }
  if (!authCheckComplete || !authUser) return null;

  return (
    <AuthenticatedShell
      title={courseName ? `${courseName} — Materials` : "Course Materials"}
      subtitle="Download lecture slides, assignments, and resources for this course."
      mobileNavLinks={globalMobileNav}
    >
      <div className="space-y-5">
        {/* Section note: groups related UI behavior for readability. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-lg">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files (title, filename, description...)"
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {/* Section note: groups related UI behavior for readability. */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                activeCategory === cat.value
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Section note: groups related UI behavior for readability. */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="rounded-[1.7rem] border border-dashed border-brand-200 bg-brand-50/70 px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <FileText className="h-6 w-6 text-brand-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No materials yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery ? "No files match your search." : "No materials have been uploaded for this course yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredMaterials.map((m) => (
              <MaterialCard
                key={m.id}
                material={m}
                canDelete={
                  isTeacherOrAdmin ||
                  (authUser && m.uploaded_by_id === authUser.id)
                }
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

    </AuthenticatedShell>
  );
}
