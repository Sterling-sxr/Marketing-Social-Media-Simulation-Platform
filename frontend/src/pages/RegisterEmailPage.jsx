import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";

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
        <nav className="flex items-center gap-3"></nav>
      </header>

      <main className="flex-1 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:flex-row lg:items-center">
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-2 lg:pt-6">
          <div className="relative z-10 space-y-6 max-w-[520px] -mt-4 sm:-mt-6 lg:-mt-10">
            <h1 className="text-2xl font-bold sm:text-4xl lg:text-4xl">
              First verify your student email
            </h1>
            <p className="text-slate-600">
              Enter your school email address to get the verification code
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

        {/* Right-hand registration card */}
        <aside className="order-2 lg:order-none flex-1">
          <div className="relative w-full max-w-md lg:ml-auto rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100 text-center">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            <h2 className="mb-6 text-lg font-semibold text-slate-800">
              Verify your email
            </h2>

            <form className="space-y-4 text-left" onSubmit={handleSubmit}>
              <label className="mb-6 block text-sm font-medium text-slate-600">
                Student Email
                <div className="input-shell mt-2">
                  <input
                    type="email"
                    value={registerEmail}
                    placeholder="z1234567@ad.unsw.edu.au"
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
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
              Already Have An Account?{" "}
              <button
                type="button"
                className="font-semibold text-brand hover:text-brand-dark"
                onClick={() => navigate("/")}
              >
                Sign In
              </button>
            </p>
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
