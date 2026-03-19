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
      ? "bg-red-500 hover:bg-red-600 text-white"
      : tone === "primary"
      ? "bg-brand hover:bg-brand-dark text-white"
      : "bg-slate-600 hover:bg-slate-700 text-white";

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
            className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${confirmStyles}`}
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
