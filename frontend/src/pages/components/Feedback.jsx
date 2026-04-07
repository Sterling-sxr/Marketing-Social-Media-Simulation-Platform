export default function Feedback({ message, error, devCode }) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (message) {
    return (
      <div className="rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-700">
        {message}
      </div>
    );
  }
  return null;
}
