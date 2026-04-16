import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

// Format timestamp into YYYY-MM-DD HH:mm:ss
// Return empty string if value is missing
// Return original value if date is invalid
const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  // Pad number to 2 digits
  const pad = (num) => String(num).padStart(2, "0");

  // Build formatted date string
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

export default function NotificationsPage() {
  // Router navigation function
  const navigate = useNavigate();

  // Get notification data and actions from global app context
  const {
    notifications,
    fetchNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
    notificationStatus,
  } = useApp();

  // Fetch notifications when page loads
  // Use silent mode to avoid extra loading UI
  useEffect(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  // Refresh notification list manually
  const handleRefresh = useCallback(() => {
    fetchNotifications({ silent: true }).catch(() => {});
  }, [fetchNotifications]);

  // Mark all notifications as read
  // Do nothing if there is no unread notification
  const handleMarkAllRead = useCallback(async () => {
    if ((notifications.unread || 0) === 0) return;
    await markAllNotificationsRead().catch(() => {});
  }, [notifications.unread, markAllNotificationsRead]);

  // Page title
  const title = "Message Notification";

  // Page subtitle
  // Show unread count if there are unread notifications
  const subtitle =
    notifications.unread > 0
      ? `${notifications.unread} Unread`
      : "All Notifications";

  // Shared button style
  // Slim pill shape
  // Mobile-friendly size
  // Includes focus ring for accessibility
  const SLIM_PILL =
    "inline-flex h-9 items-center justify-center rounded-full border border-brand-200 bg-white px-4 " +
    "text-xs font-semibold text-brand-500 leading-none transition whitespace-nowrap " +
    "hover:border-brand-400 hover:text-brand-600 focus:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-brand-300 focus-visible:ring-offset-1 sm:h-7 sm:px-3";

  // Decide what to show as notification subject
  const renderSubject = useCallback((item) => {
    if (!item) return "";

    // Special title for recommended post notification
    if (item.action === "recommended_post") {
      return "A post you might like";
    }

    // Use subject first
    // Fall back to message
    // Fall back to default text
    return item.subject || item.message || "Notification";
  }, []);

  // Decide what to show as notification body
  const renderBody = useCallback((item) => {
    if (!item) return "";

    // Special rendering for recommended post notification
    if (item.action === "recommended_post") {
      const actor = item.actor || "Someone";

      // Try different course-related fields
      const courseCode =
        item.metadata?.course_code ||
        item.metadata?.course_name ||
        item.metadata?.course_id ||
        "";

      // Try to get preview text
      const preview =
        item.metadata?.post_preview ||
        (typeof item.body === "string" ? item.body : "");

      // Optional recommendation reason
      const reason = item.metadata?.reason;

      // Build body parts step by step
      const parts = [];

      // Add main sentence
      parts.push(
        courseCode
          ? `${actor} just posted in ${courseCode}.`
          : `${actor} just shared a new course update.`
      );

      // Add preview if available
      if (preview) {
        parts.push(preview);
      }

      // Add reason if available
      if (reason) {
        parts.push(`Reason: ${reason}.`);
      }

      // Join all parts into one string
      return parts.join(" ");
    }

    // Default rendering for normal notification
    const actorPrefix = item.actor ? `${item.actor} ` : "";
    const actionText = item.action || "notification";
    const bodyText = item.body ? ` · ${item.body}` : "";

    // Trim extra spaces
    return `${actorPrefix}${actionText}${bodyText}`.trim();
  }, []);

  return (
    <AuthenticatedShell title={title} subtitle={subtitle}>
      {/* Top action buttons */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Refresh button */}
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
          onClick={handleRefresh}
          disabled={notificationStatus.loading}
          aria-label="Refresh notifications"
        >
          {notificationStatus.loading ? "Refresh..." : "Refresh"}
        </button>

        {/* Mark all as read button */}
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

      {/* Error message block */}
      {notificationStatus.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {notificationStatus.error}
        </p>
      ) : null}

      {/* Notification list */}
      <ul className="space-y-3">
        {/* Empty state */}
        {(notifications.items || []).length === 0 ? (
          <li className="rounded-2xl border border-brand-100 bg-white p-4 text-sm text-slate-500">
            No notification yet
          </li>
        ) : (
          // Render each notification item
          (notifications.items || []).map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${
                item.is_read
                  ? "border-brand-100 bg-white"
                  : "border-brand-200 bg-brand-50/70"
              }`}
            >
              {/* Notification content */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {/* Unread indicator dot */}
                  {!item.is_read ? (
                    <span
                      className="h-2 w-2 rounded-full bg-brand-400"
                      aria-hidden="true"
                    />
                  ) : null}

                  {/* Notification subject */}
                  <p className="text-sm font-semibold text-slate-800 break-words">
                    {renderSubject(item)}
                  </p>
                </div>

                {/* Notification body */}
                <p className="text-xs leading-5 text-slate-600 break-words">
                  {renderBody(item)}
                </p>

                {/* Notification time */}
                <p className="text-[11px] text-slate-400 break-words">
                  {formatTimestamp(item.created_at)}
                </p>
              </div>

              {/* Notification action buttons */}
              <div className="mt-3 flex flex-col gap-2 sm:mt-2 sm:flex-row sm:items-center sm:justify-end">
                {/* Detail button */}
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
                        // Parse link as internal URL
                        // Then navigate inside the app
                        const url = new URL(item.link, window.location.origin);
                        navigate(url.pathname + url.search + url.hash);
                      } catch (_) {
                        // If parsing fails
                        // Open link in new tab
                        window.open(item.link, "_blank");
                      }
                    }}
                    aria-label="See notification detail"
                  >
                    see detail
                  </button>
                ) : null}

                {/* Mark single notification as read */}
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
                  /* Read status label */
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
