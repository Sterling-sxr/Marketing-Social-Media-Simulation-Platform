// src/pages/components/ChipList.jsx
export default function ChipList({ items }) {
  const list = items || [];
  if (!list.length) return <span className="text-xs text-slate-400">None</span>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {list.map((v) => (
        <span
          key={v}
          className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
        >
          {v}
        </span>
      ))}
    </div>
  );
}
