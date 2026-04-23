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
    registerRole,
    setRegisterRole,
    registerTeacherCode,
    setRegisterTeacherCode,
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
        <fieldset className="space-y-2">
          <legend className="field-label">Account type</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                registerRole === "student"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-slate-200 text-slate-600 hover:border-brand/50"
              }`}
              onClick={() => setRegisterRole("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                registerRole === "teacher"
                  ? "border-brand bg-brand/10 text-brand-dark"
                  : "border-slate-200 text-slate-600 hover:border-brand/50"
              }`}
              onClick={() => setRegisterRole("teacher")}
            >
              Teacher
            </button>
          </div>
        </fieldset>

        <label className="field-label">
          {registerRole === "teacher" ? "Teacher email" : "Student email"}
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

        {registerRole === "teacher" ? (
          <label className="field-label">
            Teacher invite code
            <input
              type="password"
              value={registerTeacherCode}
              placeholder="Enter teacher invite code"
              onChange={(event) => setRegisterTeacherCode(event.target.value)}
              autoComplete="off"
              required
              className="field-input"
            />
          </label>
        ) : null}

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
