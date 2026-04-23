import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthenticatedShell from "./components/AuthenticatedShell";
import { useApp } from "../context/AppContext";
import { getJson, patchJson } from "../lib/api";

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatUnreadLabel = (count) => {
  const value = Number(count || 0);
  if (value <= 0) return "All Messages";
  return value >= 99 ? "99+ Unread" : `${value} Unread`;
};

export default function CourseMessagesPage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const navigate = useNavigate();
  const { authUser, fetchNotifications } = useApp();

  const [status, setStatus] = useState({ loading: true, error: "" });
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const recipientIdentifier = useMemo(() => {
    if (!authUser) return "";
    return (
      (authUser.username || "").trim() ||
      (authUser.email || "").trim() ||
      String(authUser.id || "")
    );
  }, [authUser]);

  const buildUrl = useCallback(() => {
    if (!recipientIdentifier) return "";
    if (!Number.isFinite(courseId)) return "";
    return `/api/messages/notifications/?user=${encodeURIComponent(
      recipientIdentifier
    )}&course_id=${encodeURIComponent(courseId)}`;
  }, [recipientIdentifier, courseId]);

  const fetchCourseNotifications = useCallback(async () => {
    const url = buildUrl();
    if (!url) return;
    setStatus({ loading: true, error: "" });
    try {
      const data = await getJson(url);
      setItems(data.items || []);
      setUnread(typeof data.unread === "number" ? data.unread : 0);
      setStatus({ loading: false, error: "" });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message || "Failed to load course messages.",
      });
    }
  }, [buildUrl]);

  useEffect(() => {
    if (!authUser) return;
    fetchCourseNotifications();
  }, [authUser, fetchCourseNotifications]);

  const courseTitle = useMemo(() => {
    if (!Number.isFinite(courseId)) return "Course Messages";
    return `Course ${courseId} Messages`;
  }, [courseId]);

  const subtitle = formatUnreadLabel(unread);

  const SLIM_PILL =
    "inline-flex h-9 items-center justify-center rounded-full border border-brand-200 bg-white px-4 " +
    "text-xs font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-7 sm:px-3";

  const renderSubject = useCallback((item) => {
    if (!item) return "";
    if (item.action === "recommended_post") return "A post you might like";
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
      if (preview) parts.push(preview);
      if (reason) parts.push(`Reason: ${reason}.`);
      return parts.join(" ");
    }
    const actorPrefix = item.actor ? `${item.actor} ` : "";
    const actionText = item.action || "notification";
    const bodyText = item.body ? ` · ${item.body}` : "";
    return `${actorPrefix}${actionText}${bodyText}`.trim();
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (unread <= 0) return;
    const url = buildUrl();
    if (!url) return;
    try {
      await patchJson(url, { all: true });
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
      await fetchNotifications({ silent: true });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        error: error.message || "Failed to mark all as read.",
      }));
    }
  }, [unread, buildUrl, fetchNotifications]);

  const handleMarkReadIds = useCallback(
    async (ids) => {
      if (!ids || ids.length === 0) return;
      const url = buildUrl();
      if (!url) return;
      try {
        await patchJson(url, { ids });
        setItems((prev) => {
          const next = prev.map((n) =>
            ids.includes(n.id) ? { ...n, is_read: true } : n
          );
          return next;
        });
        setUnread((prev) => Math.max(0, prev - ids.length));
        await fetchNotifications({ silent: true });
      } catch (error) {
        setStatus((prev) => ({
          ...prev,
          error: error.message || "Failed to mark messages as read.",
        }));
      }
    },
    [buildUrl, fetchNotifications]
  );

  return (
    <AuthenticatedShell title={courseTitle} subtitle={subtitle}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
          onClick={fetchCourseNotifications}
          disabled={status.loading}
        >
          {status.loading ? "Refreshing..." : "Refresh"}
        </button>

        <button
          type="button"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:text-xs"
          onClick={handleMarkAllRead}
          disabled={unread <= 0}
        >
          Mark all read
        </button>
      </div>

      {status.error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {status.error}
        </p>
      ) : null}

      {status.loading ? <p className="mt-3 text-sm text-slate-500">Loading...</p> : null}

      <ul className="space-y-3 mt-3">
        {items.length === 0 ? (
          <li className="rounded-2xl border border-brand-100 bg-white p-4 text-sm text-slate-500">
            No messages yet
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${
                item.is_read ? "border-brand-100 bg-white" : "border-brand-200 bg-brand-50/70"
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
                      if (!item.is_read) handleMarkReadIds([item.id]).catch(() => {});
                      try {
                        const url = new URL(
                          item.link,
                          window.location.origin
                        );
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
                    onClick={() => handleMarkReadIds([item.id]).catch(() => {})}
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
