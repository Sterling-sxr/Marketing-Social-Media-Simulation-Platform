import { NavLink } from "react-router-dom";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function CourseSecondaryNav({ courseId, showOverview = true }) {
  // Context: Compute shared values once so all branches use the same normalized inputs.
  const links = [
    ...(showOverview === false
      ? []
      : [{ to: `/courses/${courseId}`, label: "Overview", end: true }]),
    { to: `/courses/${courseId}/community`, label: "Community" },
    { to: `/courses/${courseId}/materials`, label: "Materials" },
    { to: `/courses/${courseId}/ai-users`, label: "AI Users" },
    { to: `/courses/${courseId}/members`, label: "Members" },
    { to: `/courses/${courseId}/settings`, label: "Settings" },
  ];

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              classNames(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                isActive
                  ? "border-brand bg-brand-100 text-brand"
                  : "border-brand-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </section>
  );
}
