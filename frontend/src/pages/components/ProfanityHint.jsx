// Purpose: `ProfanityHint` owns a single responsibility, uses clear input/output boundaries, and keeps behavior predictable.
export default function ProfanityHint({ message }) {
  if (!message) return null;
  return (
    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      {message},Please revise and then republish.
    </div>
  );
}
