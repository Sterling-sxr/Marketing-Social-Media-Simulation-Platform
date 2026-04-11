import { useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { isTeacherLike } from "../../lib/authRole";
import {
  Home,
  BookOpen,
  Search,
  Bell,
  FileText,
  BarChart3,
  LayoutDashboard,
  Wrench,
  BotMessageSquare,
} from "lucide-react";
import ToastHost from "../../components/ToastHost"; // Global Toast host

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function useAvatar(user) {
  if (!user) return { initials: "?", displayName: "un login", photoUrl: "" };
  const photoUrl =
    user?.avatar_url || user?.profile?.avatar_url || user?.avatar || "";
  const displayName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.nickname ||
    user?.username ||
    user?.email ||
    `user${user?.id ?? ""}`;
  const initials = displayName ? displayName.charAt(0).toUpperCase() : "?";
  return { initials, displayName, photoUrl };
}

function isActiveLink(to, location) {
  try {
    const u = new URL(to, window.location.origin);
    const wantPath = u.pathname;
    const wantTab = u.searchParams.get("tab");

    const curPath = location.pathname;
    const curTab = new URLSearchParams(location.search).get("tab");

    if (curPath !== wantPath) return false;
    if (!wantTab) return curTab == null || curTab === "";
    return curTab === wantTab;
  } catch {
    return location.pathname === to;
  }
}

export default function AuthenticatedShell({
  title,
  subtitle,
  children,
  links,
  mobileNavLinks,
  hideMobileNav = false,
  showNotifications = false, // Pages that need auto-polling pass true
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    authUser,
    logout,
    notifications,
    notificationStatus,
    fetchNotifications,
  } = useApp();
  const isTeacherOrAdmin = isTeacherLike(authUser);

  // On first load or account switch, fetch once when auto-polling is enabled
  useEffect(() => {
    if (authUser && showNotifications) {
      fetchNotifications({ silent: true }).catch(() => {});
    }
  }, [authUser, showNotifications, fetchNotifications]);

  // Refresh once when the tab/window becomes visible (prevents missed notifications)
  useEffect(() => {
    if (!showNotifications) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && authUser) {
        fetchNotifications({ silent: true }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authUser, showNotifications, fetchNotifications]);

  const { initials, displayName, photoUrl } = useAvatar(authUser);
  const unread = notifications.unread ?? 0;
  const notificationLabel = notificationStatus.error
    ? notificationStatus.error
    : unread > 0
    ? `${unread} unread notifications`
    : notificationStatus.loading
    ? "loading..."
    : "no new notifications";

  const sidebarLinks = useMemo(() => {
    if (links && links.length) return links;
    const uid = authUser?.id;
    const base = [
      {
        to: "/studenthome",
        label: "Homepage",
        icon: <Home className="h-5 w-5" />,
      },
      {
        to: "/courses",
        label: "Course Center",
        icon: <BookOpen className="h-5 w-5" />,
      },
      {
        to: "/search",
        label: "Search",
        icon: <Search className="h-5 w-5" />,
      },
      {
        to: "/notifications",
        label: "Messages",
        icon: <Bell className="h-5 w-5" />,
      },
      {
        to: uid ? `/people/${uid}?tab=posts` : "/login",
        label: "Posts",
        icon: <FileText className="h-5 w-5" />,
      },
      {
        to: uid ? `/student/analytics` : "/login",
        label: "Analytics",
        icon: <LayoutDashboard className="h-5 w-5" />,
      },
    ];
    if (!isTeacherOrAdmin) {
      base.push({
        to: "/ai-tutor",
        label: "AI Tutor",
        icon: <BotMessageSquare className="h-5 w-5" />,
      });
    }

    const admin = isTeacherOrAdmin
      ? [
          {
            to: "/dashboard",
            label: "Dashboard",
            icon: <LayoutDashboard className="h-5 w-5" />,
          },
          {
            to: "/courses/manage",
            label: "Course Manage",
            icon: <Wrench className="h-5 w-5" />,
          },
        ]
      : [];

    const merged = [...base.slice(0, 2), ...admin, ...base.slice(2)];
    const uniq = Array.from(new Map(merged.map((i) => [i.to, i])).values());
    return uniq;
  }, [links, authUser?.id, isTeacherOrAdmin]);

  const compactName = displayName || "User";
  const compactLinks = useMemo(() => {
    const dedupeByTo = (items) =>
      Array.from(
        new Map((items || []).filter(Boolean).map((item) => [item.to, item])).values()
      );

    if (mobileNavLinks && mobileNavLinks.length) {
      return dedupeByTo(mobileNavLinks).slice(0, 5);
    }
    const uid = authUser?.id;
    const preferred = Array.from(
      new Set(
        [
          "/studenthome",
          "/courses",
          "/search",
          "/notifications",
          !isTeacherOrAdmin ? "/ai-tutor" : null,
        ].filter(Boolean)
      )
    );
    const linksByTo = new Map(sidebarLinks.map((item) => [item.to, item]));
    const picked = preferred.map((to) => linksByTo.get(to)).filter(Boolean);
    if (picked.length >= 4) return picked.slice(0, 5);
    // Keep mobile nav capped to 5 primary destinations. Admin shortcuts can live in page-level quick actions.
    return dedupeByTo(sidebarLinks).slice(0, 5);
  }, [mobileNavLinks, sidebarLinks, authUser?.id, isTeacherOrAdmin]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-accent-50">
      {/* Top navigation bar */}
      <header className="border-b border-brand-100/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
          {/* Bread brand section */}
          <button
            type="button"
            onClick={() => navigate("/studenthome")}
            aria-label="Return to student home"
            className="group relative flex min-w-0 items-center gap-2.5 rounded-lg text-xl font-bold
                       leading-none focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
          >
            <img
              src="/logo.jpg"
              alt="Bread logo"
              className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 rounded-lg object-cover
                         transition-transform duration-200 group-hover:scale-105"
            />
            <span
              className="bg-[linear-gradient(90deg,#1B596E_0%,#206F88_38%,#1DAF92_100%)]
                            bg-clip-text text-lg text-transparent drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)] sm:text-xl"
            >
              Bread
            </span>
          </button>
          {/* Action area on the right */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-5">
            {/* User card */}
            <button
              type="button"
              onClick={() => navigate("/profile")}
              aria-label={`Open ${compactName}'s profile`}
              className="flex min-w-0 items-center gap-2 rounded-full border border-brand-200/80
                         bg-white/95 px-2.5 py-1.5 shadow-soft sm:gap-3 sm:px-4 sm:py-2
                         transition-all duration-200 hover:shadow-brand
                         hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <div
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full
                           bg-gradient-to-br from-brand-300 via-brand-200 to-accent-200
                           text-sm font-semibold text-slate-800 sm:h-10 sm:w-10 sm:text-base
                           shadow-[inset_0_1px_2px_rgba(255,255,255,0.65),0_2px_8px_rgba(32,111,136,0.16)]
                           transition-transform duration-200 group-hover:scale-[1.05]"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="max-w-[120px] truncate text-xs font-semibold text-slate-800 sm:max-w-[180px] sm:text-sm">
                  {compactName}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">
                  {authUser?.email || authUser?.username || "Welcome back"}
                </p>
              </div>
            </button>

            {/* Logout button */}
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-white
                        px-2.5 py-1.5 text-xs font-semibold text-brand-700 sm:px-4 sm:py-2 sm:text-sm
                        shadow-soft transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/70
                        hover:shadow-brand hover:scale-[1.02] active:scale-[0.99]
                        focus:outline-none focus:ring-2 focus:ring-brand/30"
              onClick={async () => {
                try {
                  await logout();
                } finally {
                  navigate("/", { replace: true });
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5"
              >
                <path
                  fill="currentColor"
                  d="M13 3a1 1 0 0 1 1 1v4h-2V5H6v14h6v-3h2v4a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8z"
                />
                <path
                  fill="currentColor"
                  d="M21 12a1 1 0 0 0-1-1h-7v2h7a1 1 0 0 0 1-1zm-3.707-4.707-1.414 1.414L18.586 11H13v2h5.586l-2.707 2.293 1.414 1.414L22 12l-4.707-4.707z"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content region */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-8">
        <aside className="hidden w-16 flex-shrink-0 flex-col gap-2 rounded-3xl border border-brand-100/80 bg-white/85 p-2 shadow-soft lg:flex lg:w-60 lg:p-4">
          {sidebarLinks.map((link) => {
            const active = isActiveLink(link.to, location);
            const isMessages = link.to === "/notifications";
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={() =>
                  classNames(
                    "group relative inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition lg:justify-start lg:gap-3 focus:outline-none focus:ring-2 focus:ring-brand/40",
                    active
                      ? "bg-gradient-to-r from-brand-100 to-accent-50 text-brand-800"
                      : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  )
                }
                end
                aria-label={
                  isMessages ? `Messages, ${notificationLabel}` : link.label
                }
              >
                <span
                  className={classNames(
                    "relative inline-flex items-center justify-center rounded-lg p-1.5",
                    active
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 group-hover:text-brand-700 group-hover:bg-brand-50"
                  )}
                >
                  {link.icon}
                  {/* Unread badge (Messages only) */}
                  {isMessages && unread > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white shadow"
                      aria-hidden="true"
                      title={`${unread} unread`}
                    >
                      {unread >= 99 ? "99+" : unread}
                    </span>
                  )}
                </span>
                <span className="hidden lg:inline">
                  {link.label}
                  {isMessages && unread > 0 ? ` (${unread})` : ""}
                </span>
              </NavLink>
            );
          })}
        </aside>

        <main className="min-w-0 flex-1 space-y-4 rounded-2xl border border-brand-100/80 bg-white/92 p-4 pb-24 shadow-soft sm:space-y-5 sm:p-5 sm:pb-24 lg:space-y-6 lg:rounded-3xl lg:p-6 lg:pb-6 lg:shadow-brand">
          <div className="space-y-1">
            {title ? (
              <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="break-words text-xs text-slate-500 sm:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div key={location.pathname + location.search} className="space-y-6">
            {children}
          </div>
        </main>
      </div>

      {!hideMobileNav ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-100/80 bg-white/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto grid w-full max-w-6xl grid-cols-5 gap-1">
            {compactLinks.map((link) => {
              const active = isActiveLink(link.to, location);
              const isMessages = link.to === "/notifications";
              return (
                <NavLink
                  key={`mobile-${link.to}`}
                  to={link.to}
                  end
                  className={() =>
                    classNames(
                      "group relative inline-flex min-h-[60px] flex-col items-center justify-center rounded-xl px-1 py-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand/40",
                      active
                        ? "bg-gradient-to-r from-brand-100 to-accent-50 text-brand-800"
                        : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                    )
                  }
                  aria-label={
                    isMessages ? `Messages, ${notificationLabel}` : link.label
                  }
                >
                  <span
                    className={classNames(
                    "relative inline-flex items-center justify-center rounded-lg p-1.5",
                    active
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-slate-500 group-hover:text-brand-700 group-hover:bg-brand-50"
                    )}
                  >
                    {link.icon}
                    {isMessages && unread > 0 ? (
                      <span
                        className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white shadow"
                        aria-hidden="true"
                        title={`${unread} unread`}
                      >
                        {unread >= 99 ? "99+" : unread}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 truncate">{link.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : null}
      <ToastHost />
    </div>
  );
}
