// Purpose: `ProfileSection` owns one cohesive concern so state transitions and side effects remain easy to trace.
export default function ProfileSection({
  icon,
  title,
  children,
  className = "",
}) {
  return (
    <section
      className={`panel p-6 ring-1 ring-brand-50/70 ${className}`}
    >
      <header className="mb-4 flex items-center gap-3">
        {icon ? (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-lg shadow-sm">
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
