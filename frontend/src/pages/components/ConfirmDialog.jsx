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
      ? "bg-brand hover:bg-brand/90 text-white"
      : "bg-slate-600 hover:bg-slate-700 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-orange-200">
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
            className="rounded-full border border-orange-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-orange-300 hover:text-brand disabled:opacity-60"
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

