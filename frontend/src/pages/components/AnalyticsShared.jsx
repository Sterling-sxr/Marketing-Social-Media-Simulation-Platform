export function AnalyticsSummaryCard({ label, value, hint, action }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {value ?? 0}
          </p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function AnalyticsEmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

export function ViewPostAnalysisButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-brand bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-200 ${className}`.trim()}
    >
      View Post Analysis
    </button>
  );
}

export function AnalyticsCoverageBanner({ coverage, overlapping }) {
  if (!coverage) return null;
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-xs text-slate-600">
      <p>
        Audience size:{" "}
        <span className="font-semibold text-slate-800">
          {coverage.total_audience ?? 0}
        </span>
        {" · "}
        Missing profile data:{" "}
        <span className="font-semibold text-slate-800">
          {coverage.missing_profile_count ?? 0}
        </span>
        {" · "}
        Unattributed interactions:{" "}
        <span className="font-semibold text-slate-800">
          {coverage.missing_actor_identity_count ?? 0}
        </span>
      </p>
      <p className="mt-1">
        {overlapping
          ? "Interest buckets overlap, so segment totals can exceed the audience size."
          : "This lens assigns each student to at most one bucket."}
      </p>
    </div>
  );
}

function formatRate(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.0%";
  return `${(num * 100).toFixed(1)}%`;
}

export function AnalyticsSegmentTable({ segments, emptyMessage }) {
  if (!segments?.length) {
    return <AnalyticsEmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-brand-100 shadow-sm">
      <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] border-b border-accent-100">
            <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-slate-700">
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Segment
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Audience
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Engaged
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Views
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Likes
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3">
                Comments
              </th>
              <th className="sticky top-0 z-10 bg-gradient-to-br from-[#ffdfc8] to-[#fffcdb] px-4 py-3 text-right">
                Engagement
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {segments.map((segment) => (
              <tr key={segment.key} className="odd:bg-white even:bg-brand-50/30">
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {segment.label}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                  {segment.audience_count}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                  {segment.engaged_user_count}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                  {segment.metrics?.views ?? 0}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                  {segment.metrics?.likes ?? 0}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                  {segment.metrics?.comments ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-brand">
                  {formatRate(segment.metrics?.engagement_rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
