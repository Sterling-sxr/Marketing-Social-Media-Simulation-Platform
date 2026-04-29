import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

export default function CourseSettingsPage() {
  const navigate = useNavigate();
  const { authUser, authCheckComplete } = useApp();

  const isTeacher = Boolean(authUser?.is_superuser || authUser?.is_staff);

  if (authCheckComplete && !authUser) return <Navigate to="/login" replace />;
  if (authCheckComplete && authUser && !isTeacher) return <Navigate to="/courses" replace />;

  return (
    <AuthenticatedShell title="Course Settings" subtitle="Configure this course">
      <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Settings scope</h2>
        <p className="mt-2 text-sm text-slate-600">
          Course settings are managed centrally in Course Management to keep a single
          source of truth.
        </p>
        <button
          type="button"
          className="mt-3 rounded-full border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90"
          onClick={() => navigate("/courses/manage")}
        >
          Open Course Management
        </button>
      </section>
    </AuthenticatedShell>
  );
}
