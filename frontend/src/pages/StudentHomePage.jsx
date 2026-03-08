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
          {/* User information */}
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full 
                            bg-gradient-to-br from-fuchsia-300 via-pink-200 to-amber-200 
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
        // Default Donut welcome panel
        <div className="relative flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl 
                        bg-gradient-to-br from-fuchsia-50 via-white to-amber-50 shadow-inner">
          {/* Background glow orbs */}
          <div className="absolute top-6 right-6 w-24 h-24 rounded-full bg-gradient-to-br from-pink-200 to-amber-200 blur-3xl opacity-60 animate-pulse" />
          <div className="absolute bottom-10 left-8 w-20 h-20 rounded-full bg-gradient-to-br from-fuchsia-200 to-orange-200 blur-2xl opacity-40" />

<div className="relative mb-6 animate-float">
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-18 h-18 rounded-full border-[4px] 
                    border-t-transparent border-r-transparent
                    border-b-pink-300 border-l-amber-300
                    animate-spin-slow opacity-80 blur-[0.3px]" />
  </div>

  <div className="relative flex items-center justify-center">
    <div className="w-14 h-14 rounded-full overflow-hidden 
                    shadow-[0_4px_12px_rgba(249,115,22,0.15)]
                    transition-transform duration-500 hover:scale-[1.05]">
      <img
        src="/logo.jpg"
        alt="Donut Logo"
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
              Donut Learning Community
            </span>
            . Manage your courses, update your profile, and stay connected.
          </p>

          {/* Quick entry shortcuts */}
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

/* Card component with the pastel orange/pink theme */
function CardRow({ title, desc, actionLabel, onAction }) {
  return (
    <div
      className="rounded-2xl border border-fuchsia-100/70 
                 bg-[linear-gradient(135deg,rgba(255,245,248,0.9)_0%,rgba(255,237,220,0.9)_100%)]
                 p-5 shadow-[0_4px_12px_rgba(217,70,239,0.06)]
                 hover:shadow-[0_8px_20px_rgba(249,115,22,0.12)]
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
            className="px-3 py-1 text-xs font-semibold 
                       text-fuchsia-700 border border-fuchsia-200/70 
                       rounded-full bg-white/70 
                       hover:bg-gradient-to-r hover:from-amber-200 hover:to-fuchsia-200 
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
