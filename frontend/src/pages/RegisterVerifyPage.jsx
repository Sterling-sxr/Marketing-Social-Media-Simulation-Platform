import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import DigitInput from "./components/DigitInput";
import CircleImage from "./components/CircleImage";

export default function RegisterVerifyPage() {
  const navigate = useNavigate();
  const {
    verifyContext,
    verifyDigits,
    setVerifyDigits,
    verifyStatus,
    verifyRegisterCode,
    resendCode,
  } = useApp();

  useEffect(() => {
    if (!verifyContext || verifyContext.mode !== "register") {
      navigate("/register/email", { replace: true });
    }
  }, [verifyContext, navigate]);

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    const success = await verifyRegisterCode();
    if (success) navigate("/register/password");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 text-slate-900 flex flex-col">
      {/* Top nav (matches HomePage) */}
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
            onClick={() => navigate("/register/email")}
          >
            ←
          </button>
        </nav>
      </header>

      {/* Main area: left copy + right verification card (stacked on small screens) */}
      <main className="flex-1 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:flex-row lg:items-center">
        {/* Left copy section */}
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-2 lg:pt-6">
          <div className="relative z-10 space-y-4 max-w-[520px] -mt-4 sm:-mt-6 lg:-mt-10">
            <h1 className="text-2xl font-bold sm:text-4xl lg:text-4xl">
              Second, enter the code you received
            </h1>
            <p className="text-slate-600">
              We have sent a 4-digit verification code to your school email
              address:
              <p></p>
              <span className="font-semibold text-slate-800">
                {" "}
                {verifyContext?.email || ""}
              </span>
            </p>
          </div>

          {/* Decorative circles shown at md+ behind the text */}
          <div className="absolute inset-0 hidden md:block pointer-events-none z-0">
            <CircleImage
              src="/logo.jpg"
              alt="circle-1"
              className="absolute left-[8rem] top-40 h-62 w-64 animate-floatBigFast"
              style={{ animationDelay: "0s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-2"
              className="absolute left-[23rem] top-20 h-30 w-40 animate-floatBigFast"
              style={{ animationDelay: "1.2s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-3"
              className="absolute left-12 bottom-1 h-24 w-24 animate-floatFast"
              style={{ animationDelay: "2.4s" }}
            />
          </div>
        </section>

        {/* Right-hand verification card */}
        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-md lg:ml-auto rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100 text-center">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            <h2 className="mb-6 text-lg font-semibold text-slate-800">
              Verify Code
            </h2>

            <form className="mb-6 space-y-4 text-left" onSubmit={handleSubmit}>
              <DigitInput
                digits={verifyDigits}
                onChange={(index, value) =>
                  setVerifyDigits((prev) =>
                    prev.map((item, i) => (i === index ? value : item))
                  )
                }
                onSubmit={handleSubmit}
              />

              <button
                type="submit"
                className="brand-button w-full"
                disabled={verifyStatus.loading}
              >
                {verifyStatus.loading ? "Verify..." : "Verify"}
              </button>

              <button
                type="button"
                className="secondary-button w-full"
                disabled={verifyStatus.loading}
                onClick={resendCode}
              >
                Resend Code
              </button>
            </form>

            <Feedback
              message={verifyStatus.message}
              error={verifyStatus.error}
              devCode={verifyStatus.devCode}
            />

            <button
              type="button"
              className="mt-2 block w-full text-center text-sm font-semibold text-brand hover:text-brand-dark"
              disabled={verifyStatus.loading}
              onClick={resendCode}
            >
              Didn’t receive the code? Send Again
            </button>
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
