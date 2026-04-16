import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";

export default function ResetPasswordPage() {
  // Router navigation
  const navigate = useNavigate();

  // Reset flow state and actions from app context
  const {
    resetVerifiedEmail,
    resetPasswords,
    setResetPasswords,
    resetCompleteStatus,
    completeReset,
    resetResetFlow,
  } = useApp();

  // Show or hide new password
  const [showPwd, setShowPwd] = useState(false);

  // Show or hide confirm password
  const [showConfirm, setShowConfirm] = useState(false);

  // Guard this page
  // Redirect if email verification step is missing
  useEffect(() => {
    if (!resetVerifiedEmail) {
      navigate("/reset/email", { replace: true });
    }
  }, [resetVerifiedEmail, navigate]);

  // Submit the new password
  const handleSubmit = async (event) => {
    // Prevent default form submit
    event.preventDefault();

    // Complete reset request
    const success = await completeReset();

    // Clear reset flow and go to success page
    if (success) {
      resetResetFlow();
      navigate("/reset/success");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 text-slate-900 flex flex-col">
      {/* Top header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-3 py-3 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          {/* Platform logo */}
          <img
            src="/logo.jpg"
            alt="Bread Logo"
            className="h-7 w-7 object-cover mix-blend-multiply sm:h-8 sm:w-8"
          />

          {/* Platform name */}
          <span className="text-sm font-semibold text-brand-dark sm:text-xl">
            Bread campus social simulation platform
          </span>
        </div>

        {/* Reserved navigation area */}
        <nav className="flex items-center gap-3">
          {/* Back button can be added here later */}
        </nav>
      </header>

      {/* Main content area */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-3 py-4 sm:gap-10 sm:px-6 sm:py-10 lg:flex-row lg:items-center">
        {/* Left intro section */}
        <section className="order-1 lg:order-none relative flex-1 pt-1 lg:pt-6">
          <div className="relative z-10 space-y-4 max-w-[560px] lg:-mt-10">
            {/* Main heading */}
            <h1 className="text-center text-2xl font-bold sm:text-left sm:text-4xl lg:text-4xl">
              Reset your password
            </h1>

            {/* Intro text */}
            <p className="text-slate-600">
              Set a new password(at least 8 characters) for{" "}
              <span className="font-semibold text-slate-800">
                {resetVerifiedEmail || ""}
              </span>{" "}
              . You can log in again after completion.
            </p>
          </div>

          {/* Decorative floating circles */}
          <div className="absolute inset-0 hidden md:block pointer-events-none z-0">
            <CircleImage
              src="/logo.jpg"
              alt="circle-1"
              className="absolute left-68 top-36 h-64 w-64 animate-floatBigFast"
              style={{ animationDelay: "0s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-2"
              className="absolute left-[28rem] top-4 h-40 w-40 animate-floatBigFast"
              style={{ animationDelay: "1.2s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-3"
              className="absolute left-12 bottom-12 h-24 w-24 animate-floatFast"
              style={{ animationDelay: "2.4s" }}
            />
          </div>
        </section>

        {/* Right reset card */}
        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-md lg:ml-auto rounded-2xl border border-brand-100 bg-white p-5 shadow-lg shadow-brand-100 text-center sm:rounded-3xl sm:p-8 sm:shadow-xl">
            {/* Decorative corner block */}
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            {/* Card title */}
            <h2 className="mb-6 text-lg font-semibold text-slate-800">
              Reset Your Password
            </h2>

            <form className="space-y-4 text-left" onSubmit={handleSubmit}>
              {/* New password field */}
              <label className="block text-sm font-medium text-slate-600">
                New Password
                <div className="input-shell mt-2">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={resetPasswords.password}
                    placeholder="new password"
                    onChange={(event) =>
                      setResetPasswords((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    required
                    className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />

                  {/* Toggle new password visibility */}
                  <button
                    type="button"
                    aria-label="Show or hide the new password"
                    className="text-slate-400"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              {/* Confirm password field */}
              <label className="block text-sm font-medium text-slate-600">
                Confirm Password
                <div className="input-shell mt-2">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={resetPasswords.confirm}
                    placeholder="re-enter new password"
                    onChange={(event) =>
                      setResetPasswords((prev) => ({
                        ...prev,
                        confirm: event.target.value,
                      }))
                    }
                    autoComplete="new-password"
                    required
                    className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />

                  {/* Toggle confirm password visibility */}
                  <button
                    type="button"
                    aria-label="Show or hide the confirmation password"
                    className="text-slate-400"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              {/* Submit button */}
              <button
                type="submit"
                className="brand-button w-full"
                disabled={resetCompleteStatus.loading}
              >
                {resetCompleteStatus.loading ? "Reset..." : "Reset"}
              </button>
            </form>

            {/* Reset feedback */}
            <Feedback
              message={resetCompleteStatus.message}
              error={resetCompleteStatus.error}
            />
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Bread Capstone Team. All rights reserved.
      </footer>
    </div>
  );
}
