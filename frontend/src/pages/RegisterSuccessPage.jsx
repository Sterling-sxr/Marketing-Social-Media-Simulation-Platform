import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisterSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Decrease the countdown every second
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    // Redirect to login after 3 seconds
    const redirect = setTimeout(() => {
      navigate("/", { replace: true });
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirect);
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div
        role="dialog"
        aria-modal="true"
        className="max-w-md w-full space-y-6 rounded-3xl bg-white/95 p-10 text-center shadow-2xl ring-1 ring-orange-100"
      >
        <h1 className="text-3xl font-semibold text-slate-900">
          Registration successful!
        </h1>
        <p className="text-sm text-slate-600">
          The account has been created. You will be redirected to the login page
          in{" "}
          <span className="font-semibold text-slate-900">{countdown}</span>{" "}
          second{countdown === 1 ? "" : "s"}.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            className="brand-button w-full"
            onClick={() => navigate("/", { replace: true })}
          >
            Login now
          </button>
          <button
            type="button"
            className="secondary-button w-full"
            onClick={() => navigate("/", { replace: true })}
          >
            Go back to home page
          </button>
        </div>
      </div>
    </div>
  );
}
