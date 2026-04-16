import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisterSuccessPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Section note: groups related logic for readability.
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    // Section note: groups related logic for readability.
    const redirect = setTimeout(() => {
      navigate("/login", { replace: true });
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
        className="max-w-md w-full space-y-4 rounded-2xl bg-white/95 p-6 text-center shadow-2xl ring-1 ring-brand-100 sm:space-y-6 sm:rounded-3xl sm:p-10"
      >
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Registration successful!
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          The account has been created. You will be redirected to the login page
          in{" "}
          <span className="font-semibold text-slate-900">{countdown}</span>{" "}
          second{countdown === 1 ? "" : "s"}.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            className="brand-button w-full"
            onClick={() => navigate("/login", { replace: true })}
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
