import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import AuthLayout from "./components/AuthLayout";

export default function RegisterEmailPage() {
  const navigate = useNavigate();
  const {
    registerEmail,
    setRegisterEmail,
    registerStatus,
    startRegister,
    resetRegisterFlow,
  } = useApp();

  useEffect(() => {
    resetRegisterFlow();
  }, [resetRegisterFlow]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await startRegister();
    if (success) {
      navigate("/register/verify");
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We’ll send a 4-digit code to verify your email."
      backTo="/"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="field-label">
          Student email
          <input
            type="email"
            value={registerEmail}
            placeholder="z1234567@ad.unsw.edu.au"
            onChange={(event) => setRegisterEmail(event.target.value)}
            autoComplete="email"
            required
            className="field-input"
          />
        </label>

        <button
          type="submit"
          className="brand-button w-full"
          disabled={registerStatus.loading}
        >
          {registerStatus.loading ? "Sending..." : "Send code"}
        </button>
      </form>

      <Feedback
        message={registerStatus.message}
        error={registerStatus.error}
        devCode={registerStatus.devCode}
      />

      <p className="pt-2 text-sm text-slate-500">
        Already have an account?
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
