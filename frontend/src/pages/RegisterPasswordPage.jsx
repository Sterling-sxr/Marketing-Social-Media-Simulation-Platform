import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";

export default function RegisterPasswordPage() {
  const navigate = useNavigate();
  const {
    registerVerifiedEmail,
    registerPassword,
    setRegisterPassword,
    registerPasswordConfirm,
    setRegisterPasswordConfirm,
    registerCompleteStatus,
    completeRegistration,
    resetRegisterFlow,
  } = useApp();

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!registerVerifiedEmail) {
      navigate("/register/email", { replace: true });
    }
  }, [registerVerifiedEmail, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await completeRegistration();
    if (success) {
      resetRegisterFlow();
      navigate("/register/success", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 text-slate-900 flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Donut Logo"
            className="h-8 w-8 object-cover mix-blend-multiply"
          />
          <span className="text-xl font-semibold text-brand-dark">
            Donut campus social simulation platform
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-orange-200 px-5 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:text-brand-dark"
            onClick={() => navigate("/register/verify")}
          >
            ←
          </button>
          {/* <button
            type="button"
            className="rounded-full bg-gradient-to-r from-brand to-brand-dark px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:from-brand-dark hover:to-brand"
            onClick={() => navigate("/login")}
          >
            Already have an account? Sign in
          </button> */}
        </nav>
      </header>

      <main className="flex-1 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:flex-row lg:items-center">
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-2 lg:pt-6">
          <div className="relative z-10 space-y-4 max-w-[520px] -mt-4 sm:-mt-6 lg:-mt-10">
            <h1 className="text-2xl font-bold sm:text-4xl lg:text-4xl">
              Third, set your password
            </h1>
            <p className="text-slate-600">
              Set a password(at least 8 digits) for{" "}
              <span className="font-semibold text-slate-800">
                {registerVerifiedEmail || ""}
              </span>{" "}
              and join the course community after completing registration.
            </p>
          </div>

          <div className="absolute inset-0 hidden md:block pointer-events-none z-0">
            <CircleImage
              src="/logo.jpg"
              alt="circle-1"
              className="absolute left-[8rem] top-36 h-64 w-64 animate-floatBigFast"
              style={{ animationDelay: "0s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-2"
              className="absolute left-[23rem] top-20 h-40 w-40 animate-floatBigFast"
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

        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-md lg:ml-auto rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100 text-center">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            <h2 className="mb-6 text-lg font-semibold text-slate-800">
              Set Your Password
            </h2>

            <form className="space-y-4 text-left" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-600">
                Password
                <div className="input-shell mt-2">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={registerPassword}
                    placeholder="At least 8 digits"
                    onChange={(event) =>
                      setRegisterPassword(event.target.value)
                    }
                    autoComplete="new-password"
                    required
                    className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Show or hide password"
                    className="text-slate-400"
                    onClick={() => setShowPwd((v) => !v)}
                  >
                    {showPwd ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-medium text-slate-600">
                Confirm Password
                <div className="input-shell mt-2">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={registerPasswordConfirm}
                    placeholder="Re-enter the password"
                    onChange={(event) =>
                      setRegisterPasswordConfirm(event.target.value)
                    }
                    autoComplete="new-password"
                    required
                    className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Show or hide confirmation password"
                    className="text-slate-400"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                className="brand-button w-full"
                disabled={registerCompleteStatus.loading}
              >
                {registerCompleteStatus.loading ? "Submitting..." : "Register"}
              </button>
            </form>

            <Feedback
              message={registerCompleteStatus.message}
              error={registerCompleteStatus.error}
            />
          </div>
        </aside>
      </main>

      {/* Footer pinned to the bottom */}
      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Donut Capstone Team. All rights reserved.
      </footer>
    </div>
  );
}
