import React from "react";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  processing = false,
  tone = "danger",
}) {
  if (!open) return null;

  const confirmStyles =
    tone === "danger"
      ? "border border-red-200 bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-600"
      : tone === "primary"
      ? "border border-brand bg-gradient-to-r from-brand to-brand-dark text-white hover:from-brand-dark hover:to-brand"
      : "border border-slate-300 bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="panel w-full max-w-md p-6">
        {title ? (
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        ) : null}
        {message ? (
          <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
            {message}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-xs"
            onClick={onCancel}
            disabled={processing}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition will-change-transform hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-60 ${confirmStyles}`}
            onClick={onConfirm}
            disabled={processing}
          >
            {processing ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
