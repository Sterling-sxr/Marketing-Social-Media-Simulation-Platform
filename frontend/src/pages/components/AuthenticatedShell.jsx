import { useEffect, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
  Home,
  BookOpen,
  UserRound,
  Bell,
  FileText,
  Users,
  BarChart3,
  LayoutDashboard,
  Wrench,
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
        to: uid ? `/people/${uid}` : "/login",
        label: "Profile",
        icon: <UserRound className="h-5 w-5" />,
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
        to: uid ? `/people/${uid}/follows?tab=following` : "/login",
        label: "Followers",
        icon: <Users className="h-5 w-5" />,
      },
      {
        to: uid ? `/student/analysis` : "/login",
        label: "Analysis",
        icon: <BarChart3 className="h-5 w-5" />,
      },
    ];

    const admin =
      authUser?.is_superuser || authUser?.is_staff
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
  }, [links, authUser?.id, authUser?.is_superuser, authUser?.is_staff]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-sky-100">
      {/* Top navigation bar */}
      <header className="border-b border-fuchsia-100/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          {/* Donut brand section */}
          <button
            type="button"
            onClick={() => navigate("/studenthome")}
            aria-label="Return to student home"
            className="group relative flex items-center gap-2.5 text-xl font-bold rounded-lg
                       leading-none focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30 transition"
          >
            <img
              src="/logo.jpg"
              alt="Donut logo"
              className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-lg object-cover
                         transition-transform duration-200 group-hover:scale-105"
            />
            <span
              className="bg-[linear-gradient(90deg,#f97316_0%,#fda34b_30%,#e879f9_70%,#c084fc_100%)]
                            bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]"
            >
              Donut
            </span>
          </button>
          {/* Action area on the right */}
          <div className="flex items-center gap-5">
            {/* User card */}
            <div
              className="flex items-center gap-3 rounded-full border border-fuchsia-200/70
                         bg-white/90 px-4 py-2 shadow-[0_4px_12px_rgba(217,70,239,0.08)]
                         transition-all duration-200 hover:shadow-[0_8px_20px_rgba(217,70,239,0.12)]
                         hover:border-fuchsia-300/70"
            >
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full
                           bg-gradient-to-br from-fuchsia-300 via-pink-200 to-amber-200
                           text-base font-semibold text-slate-800
                           shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_2px_8px_rgba(217,70,239,0.15)]
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
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500">
                  {authUser?.email || authUser?.username || "Welcome back"}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-2xl
                        px-4 py-2 text-sm font-semibold text-orange-600
                        bg-[linear-gradient(135deg,#FFE7CF_0%,#F1E9FF_100%)]
                        shadow-[0_6px_18px_rgba(17,24,39,.08)]
                        transition-all duration-200
                        hover:shadow-[0_10px_24px_rgba(217,70,239,.18)] hover:scale-[1.02]
                        active:scale-[0.99]
                        focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
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
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main content region */}
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-8">
        <aside className="flex w-16 flex-shrink-0 flex-col gap-2 rounded-3xl border border-fuchsia-100/70 bg-white/80 p-2 shadow-lg shadow-fuchsia-100/50 lg:w-60 lg:p-4">
          {sidebarLinks.map((link) => {
            const active = isActiveLink(link.to, location);
            const isMessages = link.to === "/notifications";
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={() =>
                  classNames(
                    "relative inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition lg:justify-start lg:gap-3 focus:outline-none focus:ring-2 focus:ring-brand/40",
                    active
                      ? "bg-gradient-to-r from-brand/10 to-violet-100 text-brand"
                      : "text-slate-600 hover:bg-fuchsia-50 hover:text-brand"
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
                      ? "bg-gradient-to-r from-orange-100 to-pink-100 text-fuchsia-600 shadow-sm"
                      : "text-slate-500 group-hover:text-fuchsia-500 group-hover:bg-fuchsia-50"
                  )}
                >
                  {link.icon}
                  {/* Unread badge (Messages only) */}
                  {isMessages && unread > 0 && (
                    <span
                      className="absolute -right-1.5 -top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-5 text-white shadow"
                      aria-hidden="true"
                      title={`${unread} unread`}
                    >
                      {unread > 99 ? "99+" : unread}
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

        <main className="flex-1 space-y-6 rounded-3xl border border-fuchsia-100/70 bg-white/90 p-6 shadow-xl shadow-fuchsia-100/50">
          <div className="space-y-1">
            {title ? (
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <div key={location.pathname + location.search} className="space-y-6">
            {children}
          </div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
