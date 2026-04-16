import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AuthenticatedShell from "./components/AuthenticatedShell";

export default function StudentHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser } = useApp();

  const queryTab = new URLSearchParams(location.search).get("tab");
  const [active, setActive] = useState(null);

  useEffect(() => {
    setActive(queryTab ?? null);
  }, [queryTab]);

  const { zid, email, avatarText, userId } = useMemo(() => {
    const mail = authUser?.email || "";
    const zidMatch = /^z\d+/.exec(mail);
    const z = zidMatch ? zidMatch[0] : (authUser?.username || "").toLowerCase();
    const initial = (
      authUser?.username?.[0] ||
      authUser?.email?.[0] ||
      "U"
    ).toUpperCase();
    return {
      zid: z || "zid",
      email: mail,
      avatarText: initial,
      userId: authUser?.id,
    };
  }, [authUser]);

  return (
    <AuthenticatedShell>
      {active ? (
        <>
          {/* Context: This UI section keeps related rendering and event logic together so state flow and intent are easier to follow. */}
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full 
                            bg-gradient-to-br from-accent-300 via-accent-200 to-accent-200 
                            text-white font-bold shadow-md">
              {avatarText}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{zid}</p>
              <p className="text-xs text-slate-500">{email}</p>
            </div>
          </div>

          <h1 className="mb-2 text-xl font-bold text-slate-900">Student Home</h1>
          <p className="mb-4 text-sm text-slate-500">
            Quick access to your courses, profile, and notifications.
          </p>

          <div className="grid gap-4">
            {active === "courses" && (
              <CardRow
                title="Joined Courses"
                desc="Access your enrolled classes and updates."
                actionLabel="Go"
                onAction={() => navigate("/courses")}
              />
            )}
            {active === "profile" && (
              <CardRow
                title="Profile"
                desc="Edit your personal information."
                actionLabel="Edit"
                onAction={() => navigate("/profile")}
              />
            )}
            {active === "notifications" && (
              <CardRow
                title="Notifications"
                desc="View announcements and alerts."
                actionLabel="Open"
                onAction={() => navigate("/notifications")}
              />
            )}
            {active === "following" && (
              <CardRow
                title="Following"
                desc="View people or teams you follow."
                actionLabel="View"
                onAction={() =>
                  navigate(`/people/${userId}/follows?tab=following`)
                }
              />
            )}
            {active === "followers" && (
              <CardRow
                title="Followers"
                desc="See who’s following you."
                actionLabel="View"
                onAction={() =>
                  navigate(`/people/${userId}/follows?tab=followers`)
                }
              />
            )}
          </div>
        </>
      ) : (
        // Context: This block prepares shared values used by the request branches below.
        <div className="relative flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 via-white to-accent-50 px-4 py-16 shadow-inner">
          {/* Context: This UI section keeps related rendering and event logic together so state flow and intent are easier to follow. */}
          <div className="absolute top-6 right-6 h-24 w-24 animate-pulse rounded-full bg-gradient-to-br from-brand-200 to-accent-200 opacity-60 blur-3xl" />
          <div className="absolute bottom-10 left-8 h-20 w-20 rounded-full bg-gradient-to-br from-brand-200 to-accent-200 opacity-40 blur-2xl" />

<div className="relative mb-6 animate-float">
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-18 h-18 rounded-full border-[4px] 
                    border-t-transparent border-r-transparent
                    border-b-accent-300 border-l-accent-300
                    animate-spin-slow opacity-80 blur-[0.3px]" />
  </div>

  <div className="relative flex items-center justify-center">
    <div className="w-14 h-14 rounded-full overflow-hidden 
                    shadow-[0_4px_12px_rgba(32,111,136,0.16)]
                    transition-transform duration-500 hover:scale-[1.05]">
      <img
        src="/logo.jpg"
        alt="Bread Logo"
        className="w-full h-full object-contain bg-transparent"
      />
    </div>
  </div>
</div>



          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
            Welcome back, {zid}!
          </h2>
          <p className="text-sm text-slate-600 mb-8 max-w-md">
            Welcome to the{" "}
            <span className="font-semibold text-brand">
              Bread Learning Community
            </span>
            . Manage your courses, update your profile, and stay connected.
          </p>

          {/* Context: This UI section keeps related rendering and event logic together so state flow and intent are easier to follow. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
            <CardRow
              title="Courses"
              desc="Explore your enrolled classes."
              actionLabel="Open"
              onAction={() => navigate("/courses")}
            />
            <CardRow
              title="Profile"
              desc="Edit your details and preferences."
              actionLabel="Open"
              onAction={() => navigate("/profile")}
            />
            <CardRow
              title="Notifications"
              desc="Check your latest updates."
              actionLabel="Open"
              onAction={() => navigate("/notifications")}
            />
          </div>
        </div>
      )}
    </AuthenticatedShell>
  );
}

/* Purpose: `CardRow` owns a single responsibility, uses clear input/output boundaries, and keeps behavior predictable. */
function CardRow({ title, desc, actionLabel, onAction }) {
  return (
    <div
      className="rounded-2xl border border-brand-100/80
                 bg-[linear-gradient(135deg,rgba(246,252,253,0.95)_0%,rgba(239,249,250,0.95)_100%)]
                 p-5 shadow-soft
                 hover:shadow-brand
                 hover:-translate-y-0.5 transition-all backdrop-blur-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-full border border-brand-200/80 bg-white/70 px-3 py-1 text-xs font-semibold
                       text-brand-700 hover:bg-gradient-to-r hover:from-brand-100 hover:to-accent-100
                       hover:text-slate-900 transition-all duration-200
                       shadow-sm hover:shadow-md"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
