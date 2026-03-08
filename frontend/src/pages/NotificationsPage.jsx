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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    fetchNotifications,
    markNotificationsRead,
    notificationStatus,
  } = useApp();

  useEffect(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = (notifications.items || [])
      .filter((n) => !n.is_read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markNotificationsRead(unreadIds).catch(() => {});
  }, [notifications.items, markNotificationsRead]);

  const title = "Message Notification";
  const subtitle =
    notifications.unread > 0
      ? `${notifications.unread} Unread`
      : "All Notifications";

  // Consistent "slim pill" button style (fixed height, single line, no extra line height)
  const SLIM_PILL =
    "inline-flex h-7 items-center rounded-full border border-orange-200 bg-white px-3 " +
    "text-xs font-semibold text-orange-500 whitespace-nowrap leading-none " +
    "transition hover:border-orange-400 hover:text-orange-600";

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
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand"
          onClick={handleRefresh}
          disabled={notificationStatus.loading}
        >
          {notificationStatus.loading ? "Refresh..." : "Refresh"}
        </button>
        <button
          type="button"
          className="rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand disabled:opacity-60"
          onClick={handleMarkAllRead}
          disabled={(notifications.unread || 0) === 0}
        >
          Mark all read
        </button>
      </div>

      <ul className="divide-y divide-orange-50 rounded-2xl border border-orange-100 bg-white">
        {(notifications.items || []).length === 0 ? (
          <li className="p-4 text-sm text-slate-500">No notification yet</li>
        ) : (
          (notifications.items || []).map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {renderSubject(item)}
                </p>
                <p className="text-xs text-slate-500">{renderBody(item)}</p>
                <p className="text-[11px] text-slate-400">
                  {formatTimestamp(item.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {item.link ? (
                  <button
                    type="button"
                    className={SLIM_PILL}
                    onClick={() => {
                      // Mark as read before navigating
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
                  >
                    mark as already read
                  </button>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
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
