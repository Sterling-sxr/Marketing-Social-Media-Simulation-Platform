import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import AuthLayout from "./components/AuthLayout";

export default function ResetEmailPage() {
  const navigate = useNavigate();
  const { resetEmail, setResetEmail, resetStatus, startReset, resetResetFlow } =
    useApp();

  useEffect(() => {
    resetResetFlow();
  }, [resetResetFlow]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await startReset();
    if (success) navigate("/reset/verify");
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send a verification code."
      backTo="/login"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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

        <button
          type="submit"
          className="brand-button w-full"
          disabled={resetStatus.loading}
        >
          {resetStatus.loading ? "Sending..." : "Send code"}
        </button>
      </form>

      <Feedback
        message={resetStatus.message}
        error={resetStatus.error}
        devCode={resetStatus.devCode}
      />

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
