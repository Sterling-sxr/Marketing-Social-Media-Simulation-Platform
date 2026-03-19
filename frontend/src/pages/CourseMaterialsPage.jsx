import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { getJson, deleteJson } from "../lib/api";
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
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
  tutorial: "bg-emerald-50 text-emerald-700 border-emerald-200",
  assignment: "bg-amber-50 text-amber-700 border-amber-200",
  reading: "bg-purple-50 text-purple-700 border-purple-200",
  exam: "bg-red-50 text-red-700 border-red-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
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
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onSuccess(data.material);
    } catch (err) {
      setStatus({ loading: false, error: err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-[1.8rem] border border-brand-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Upload Material</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 1 Lecture Slides"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              File <span className="text-red-500">*</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50"
            >
              {file ? (
                <>
                  <Paperclip className="mb-2 h-6 w-6 text-brand-500" />
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatBytes(file.size)}</p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 h-6 w-6 text-brand-400" />
                  <p className="text-sm text-slate-600">
                    Click to select a file
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    PDF, Word, PPT, images, ZIP — max 50 MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          {status.error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {status.error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status.loading}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark disabled:opacity-60"
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
  const { authUser, authCheckComplete, courses, fetchCourses } = useApp();

  const [materials, setMaterials] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [courseName, setCourseName] = useState("");

  const isTeacherOrAdmin = useMemo(() => {
    if (!authUser) return false;
    if (authUser.is_superuser || authUser.is_staff) return true;
    const allCourses = [...(courses.joined || []), ...(courses.available || [])];
    const membership = allCourses.find((c) => c.id === courseId);
    return membership?.role === "teacher";
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
    setError("");
    try {
      const params = activeCategory !== "all" ? `?category=${activeCategory}` : "";
      const data = await getJson(`/api/courses/${courseId}/materials/${params}`);
      setMaterials(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load materials.");
    } finally {
      setLoading(false);
    }
  }, [courseId, authUser, activeCategory]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleUploadSuccess = (newMaterial) => {
    setShowUpload(false);
    setMaterials((prev) => [newMaterial, ...prev]);
  };

  const handleDelete = async (materialId) => {
    try {
      await deleteJson(`/api/courses/${courseId}/materials/${materialId}/`);
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (err) {
      alert(err.message || "Failed to delete material.");
    }
  };

  const courseLinks = useMemo(
    () => [
      {
        to: `/courses/${courseId}`,
        label: "Course Feed",
        icon: <MessageSquare className="h-5 w-5" />,
      },
      {
        to: `/courses/${courseId}/materials`,
        label: "Materials",
        icon: <BookOpen className="h-5 w-5" />,
      },
    ],
    [courseId]
  );

  if (!authCheckComplete || !authUser) return null;

  return (
    <AuthenticatedShell
      title={courseName ? `${courseName} — Materials` : "Course Materials"}
      subtitle="Download lecture slides, assignments, and resources for this course."
      links={courseLinks}
    >
      <div className="space-y-5">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={`/courses/${courseId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Feed
          </Link>

          {isTeacherOrAdmin && (
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark"
            >
              <Plus className="h-4 w-4" />
              Upload Material
            </button>
          )}
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                activeCategory === cat.value
                  ? "border-brand bg-brand text-white shadow-brand"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
          </div>
        ) : error ? (
          <div className="rounded-[1.6rem] border border-red-100 bg-red-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={loadMaterials}
              className="mt-3 rounded-full border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        ) : materials.length === 0 ? (
          <div className="rounded-[1.7rem] border border-dashed border-brand-200 bg-brand-50/60 px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <FileText className="h-6 w-6 text-brand-400" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No materials yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {isTeacherOrAdmin
                ? "Upload your first material using the button above."
                : "No materials have been uploaded for this course yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {materials.map((m) => (
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

      {showUpload && (
        <UploadModal
          courseId={courseId}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </AuthenticatedShell>
  );
}
