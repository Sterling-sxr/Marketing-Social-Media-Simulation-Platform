import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

const formatUnreadLabel = (count) => {
  const value = Number(count || 0);
  if (value <= 0) return "All Notifications";
  return value >= 99 ? "99+ Unread" : `${value} Unread`;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    fetchNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
    notificationStatus,
  } = useApp();

  useEffect(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if ((notifications.unread || 0) === 0) return;
    await markAllNotificationsRead().catch(() => {});
  }, [notifications.unread, markAllNotificationsRead]);

  const title = "Message Notification";
  const subtitle = formatUnreadLabel(notifications.unread);

  // Context: Compute shared values once so all branches use the same normalized inputs.
  const SLIM_PILL =
    "inline-flex h-9 items-center justify-center rounded-full border border-brand-200 bg-white px-4 " +
    "text-xs font-semibold text-brand-500 leading-none transition whitespace-nowrap " +
    "hover:border-brand-400 hover:text-brand-600 focus:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-brand-300 focus-visible:ring-offset-1 sm:h-7 sm:px-3";

  const renderSubject = useCallback((item) => {
    if (!item) return "";
    if (item.action === "recommended_post") {
      return "A post you might like";
    }
    return item.subject || item.message || "Notification";
  }, []);

  const renderBody = useCallback((item) => {
    if (!item) return "";
    if (item.action === "recommended_post") {
      const actor = item.actor || "Someone";
      const courseCode =
        item.metadata?.course_code ||
        item.metadata?.course_name ||
        item.metadata?.course_id ||
        "";
      const preview =
        item.metadata?.post_preview ||
        (typeof item.body === "string" ? item.body : "");
      const reason = item.metadata?.reason;
      const parts = [];
      parts.push(
        courseCode
          ? `${actor} just posted in ${courseCode}.`
          : `${actor} just shared a new course update.`
      );
      if (preview) {
        parts.push(preview);
      }
      if (reason) {
        parts.push(`Reason: ${reason}.`);
      }
      return parts.join(" ");
    }
    const actorPrefix = item.actor ? `${item.actor} ` : "";
    const actionText = item.action || "notification";
    const bodyText = item.body ? ` · ${item.body}` : "";
    return `${actorPrefix}${actionText}${bodyText}`.trim();
  }, []);

  return (
    <AuthenticatedShell title={title} subtitle={subtitle}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
          onClick={handleRefresh}
          disabled={notificationStatus.loading}
          aria-label="Refresh notifications"
        >
          {notificationStatus.loading ? "Refresh..." : "Refresh"}
        </button>
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
          onClick={handleMarkAllRead}
          disabled={(notifications.unread || 0) === 0}
          aria-label="Mark all notifications as read"
        >
          Mark all read
        </button>
      </div>

      {notificationStatus.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {notificationStatus.error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {(notifications.items || []).length === 0 ? (
          <li className="rounded-2xl border border-brand-100 bg-white p-4 text-sm text-slate-500">
            No notification yet
          </li>
        ) : (
          (notifications.items || []).map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${
                item.is_read
                  ? "border-brand-100 bg-white"
                  : "border-brand-200 bg-brand-50/70"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!item.is_read ? (
                    <span
                      className="h-2 w-2 rounded-full bg-brand-400"
                      aria-hidden="true"
                    />
                  ) : null}
                  <p className="text-sm font-semibold text-slate-800 break-words">
                    {renderSubject(item)}
                  </p>
                </div>
                <p className="text-xs leading-5 text-slate-600 break-words">
                  {renderBody(item)}
                </p>
                <p className="text-[11px] text-slate-400 break-words">
                  {formatTimestamp(item.created_at)}
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:mt-2 sm:flex-row sm:items-center sm:justify-end">
                {item.link ? (
                  <button
                    type="button"
                    className={SLIM_PILL}
                    onClick={() => {
                      // Context: Compute shared values once so all branches use the same normalized inputs.
                      if (!item.is_read) {
                        markNotificationsRead([item.id]).catch(() => {});
                      }
                      try {
                        const url = new URL(item.link, window.location.origin);
                        navigate(url.pathname + url.search + url.hash);
                      } catch (_) {
                        window.open(item.link, "_blank");
                      }
                    }}
                    aria-label="See notification detail"
                  >
                    see detail
                  </button>
                ) : null}

                {!item.is_read ? (
                  <button
                    type="button"
                    className={SLIM_PILL}
                    onClick={() =>
                      markNotificationsRead([item.id]).catch(() => {})
                    }
                    aria-label="Mark notification as read"
                  >
                    mark as already read
                  </button>
                ) : (
                  <span className="inline-flex h-9 items-center justify-center rounded-full bg-green-100 px-4 text-[11px] font-semibold text-green-700 whitespace-nowrap sm:h-7 sm:px-3">
                    already read
                  </span>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </AuthenticatedShell>
  );
}
