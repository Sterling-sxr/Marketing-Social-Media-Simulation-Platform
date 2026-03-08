import { useNavigate } from "react-router-dom";

export default function AuthLayout({ children, title, subtitle, backTo }) {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-card space-y-6">
        {backTo !== false && (
          <button
            type="button"
            aria-label="Go back"
            className="absolute left-6 top-6 rounded-full border border-orange-200 bg-white p-2 text-brand transition hover:border-brand"
            onClick={() => navigate(backTo ?? -1)}
          >
            <span className="text-lg">←</span>
          </button>
        )}
        <div className="space-y-2 pt-4">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
