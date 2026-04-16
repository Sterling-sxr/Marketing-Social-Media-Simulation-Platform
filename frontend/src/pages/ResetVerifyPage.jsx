import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import DigitInput from "./components/DigitInput";
import CircleImage from "./components/CircleImage";

export default function ResetVerifyPage() {
  // Router navigation
  const navigate = useNavigate();

  // Verification state and actions from app context
  const {
    verifyContext,
    verifyDigits,
    setVerifyDigits,
    verifyStatus,
    verifyResetCode,
    resendCode,
  } = useApp();

  // Guard this page
  // Redirect if reset verify context is missing
  // Or if the mode is not "reset"
  useEffect(() => {
    if (!verifyContext || verifyContext.mode !== "reset") {
      navigate("/reset/email", { replace: true });
    }
  }, [verifyContext, navigate]);

  // Submit verification code
  const handleSubmit = async (event) => {
    // Prevent default form submit
    if (event) event.preventDefault();

    // Verify reset code
    const success = await verifyResetCode();

    // Go to reset password page after success
    if (success) navigate("/reset/password");
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

        {/* Top navigation */}
        <nav className="flex items-center gap-3">
          {/* Back button */}
          <button
            type="button"
            className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand hover:text-brand-dark sm:px-5 sm:text-sm"
            onClick={() => navigate("/reset/email")}
          >
            ←
          </button>
        </nav>
      </header>

      {/* Main content area */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-3 py-4 sm:gap-10 sm:px-6 sm:py-10 lg:flex-row lg:items-center">
        {/* Left intro section */}
        <section className="order-1 lg:order-none relative flex-1 pt-1 lg:pt-6">
          <div className="relative z-10 space-y-4 max-w-[560px] lg:-mt-10">
            {/* Main heading */}
            <h1 className="text-center text-2xl font-bold sm:text-left sm:text-4xl lg:text-4xl">
              Verify your email
            </h1>

            {/* Intro text */}
            <p className="text-slate-600">
              We have sent a 6-digit verification code to{" "}
              <span className="font-semibold text-slate-800">
                {verifyContext?.email || ""}
              </span>{" "}
              Please enter it to continue.
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

        {/* Right verification card */}
        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-md lg:ml-auto rounded-2xl border border-brand-100 bg-white p-5 shadow-lg shadow-brand-100 text-center sm:rounded-3xl sm:p-8 sm:shadow-xl">
            {/* Decorative corner block */}
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            {/* Card title */}
            <h2 className="mb-6 text-lg font-semibold text-slate-800">
              Verify reset code
            </h2>

            <form className="space-y-4 text-left" onSubmit={handleSubmit}>
              {/* 6-digit input boxes */}
              <DigitInput
                digits={verifyDigits}
                onChange={(index, value) =>
                  setVerifyDigits((prev) =>
                    prev.map((item, i) => (i === index ? value : item))
                  )
                }
                onSubmit={handleSubmit}
              />

              {/* Verify button */}
              <button
                type="submit"
                className="brand-button w-full"
                disabled={verifyStatus.loading}
              >
                {verifyStatus.loading ? "Verifying..." : "Verify"}
              </button>

              {/* Resend code button */}
              <button
                type="button"
                className="secondary-button w-full"
                disabled={verifyStatus.loading}
                onClick={resendCode}
              >
                Resend Code
              </button>
            </form>

            {/* Verification feedback */}
            <Feedback
              message={verifyStatus.message}
              error={verifyStatus.error}
              devCode={verifyStatus.devCode}
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
