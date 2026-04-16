import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import AuthLayout from "./components/AuthLayout";

export default function ResetEmailPage() {
  // Router navigation
  const navigate = useNavigate();

  // Reset password state and actions from app context
  const { resetEmail, setResetEmail, resetStatus, startReset, resetResetFlow } =
    useApp();

  // Clear previous reset flow state when page loads
  useEffect(() => {
    resetResetFlow();
  }, [resetResetFlow]);

  // Submit email and start reset flow
  const handleSubmit = async (event) => {
    // Prevent default form submit
    event.preventDefault();

    // Request verification code
    const success = await startReset();

    // Go to verify page after success
    if (success) navigate("/reset/verify");
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send a verification code."
      backTo="/login"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Email input field */}
        <label className="field-label">
          Student email
          <input
            type="email"
            value={resetEmail}
            placeholder="z1234567@ad.unsw.edu.au"
            onChange={(event) => setResetEmail(event.target.value)}
            autoComplete="email"
            required
            className="field-input"
          />
        </label>

        {/* Send code button */}
        <button
          type="submit"
          className="brand-button w-full"
          disabled={resetStatus.loading}
        >
          {resetStatus.loading ? "Sending..." : "Send code"}
        </button>
      </form>

      {/* Reset flow feedback */}
      <Feedback
        message={resetStatus.message}
        error={resetStatus.error}
        devCode={resetStatus.devCode}
      />

      {/* Back to login link */}
      <p className="pt-2 text-sm text-slate-500">
        Remembered your password?
        <button
          type="button"
          className="ml-1 font-semibold text-brand hover:text-brand-dark"
          onClick={() => navigate("/login")}
        >
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
}
