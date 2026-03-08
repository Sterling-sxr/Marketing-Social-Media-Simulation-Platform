import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function ToastHost() {
  const { toasts, dismissToast, markNotificationsRead } = useApp();
  const navigate = useNavigate();

  const handleToastClick = useCallback(
    async (toast) => {
      if (toast.notification_id) {
        await markNotificationsRead([toast.notification_id]).catch(() => {});
      }
      if (toast.link) {
        try {
          const url = new URL(toast.link, window.location.origin);
          dismissToast(toast.id);
          navigate(url.pathname + url.search + url.hash);
        } catch {
          dismissToast(toast.id);
          window.open(toast.link, "_blank");
        }
      }
    },
    [dismissToast, markNotificationsRead, navigate]
  );

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-xl border border-orange-200 bg-white p-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              className="flex-1 text-left transition hover:opacity-80"
              onClick={() => handleToastClick(toast)}
            >
              <p className="text-sm font-semibold text-slate-800">
                {toast.title}
              </p>
              {toast.message ? (
                <p className="mt-0.5 text-xs text-slate-500">{toast.message}</p>
              ) : null}
              {toast.link ? (
                <span className="mt-2 inline-block text-xs font-semibold text-brand underline">
                  View
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="rounded-full bg-orange-50 px-2 py-1 text-xs text-slate-500 hover:bg-orange-100"
              onClick={() => dismissToast(toast.id)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}