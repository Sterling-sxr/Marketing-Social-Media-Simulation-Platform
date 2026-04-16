// Purpose: `KV` owns one cohesive concern so state transitions and side effects remain easy to trace.
export default function KV({ label, value }) {
  const empty =
    value === undefined || value === null || value === "" || value === "—";
  return (
    <div className="card rounded-xl bg-brand-50/30 p-3 transition hover:bg-brand-50/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={
          "mt-1 text-sm " +
          (empty ? "text-slate-400" : "font-semibold text-slate-900")
        }
      >
        {empty ? "—" : value}
      </p>
    </div>
  );
}
