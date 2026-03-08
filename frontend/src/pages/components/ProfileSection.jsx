// src/pages/components/ProfileSection.jsx
export default function ProfileSection({
  icon,
  title,
  children,
  className = "",
}) {
  return (
    <section
      className={`rounded-3xl border border-orange-100 bg-white p-6 shadow-sm ring-1 ring-orange-50/70 ${className}`}
    >
      <header className="mb-4 flex items-center gap-3">
        {icon ? (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-lg shadow-sm">
            {icon}
          </span>
        ) : null}
        {title ? (
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
        ) : null}
      </header>
      {children}
    </section>
  );
}
