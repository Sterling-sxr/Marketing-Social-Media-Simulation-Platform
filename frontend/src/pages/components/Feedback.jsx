export default function Feedback({ message, error, devCode }) {
  if (error) {
    return (
      <div className="alert alert-danger">
        {error}
      </div>
    );
  }
  if (message) {
    return (
      <div className="alert alert-success">
        {message}
      </div>
    );
  }
  return null;
}
