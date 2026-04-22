import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { getDefaultLandingPath } from "../lib/access";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";
import { Eye, EyeOff } from "lucide-react";


export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, login, logout } = useApp();

  // Context: Compute shared values once so all branches use the same normalized inputs.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: "", error: "" });
    try {
      const result = await login(email, password);
      setStatus({ loading: false, message: "Login Success!", error: "" });
      navigate(getDefaultLandingPath(result?.user), { replace: true });
    } catch (error) {
      setStatus({ loading: false, message: "", error: error.message });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 text-slate-900 flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-3 py-3 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Bread Logo"
            className="h-7 w-7 object-cover mix-blend-multiply sm:h-8 sm:w-8"
          />
          <span className="text-sm font-semibold text-brand-dark sm:text-xl">
            Bread campus social simulation platform
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-3 py-4 sm:gap-10 sm:px-6 sm:py-10 lg:flex-row lg:items-center">
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-1 lg:pt-6">
          <div className="relative z-10 max-w-[560px] space-y-4 sm:space-y-6 lg:-mt-10">
            <h1 className="text-2xl font-bold sm:text-4xl lg:text-4xl">
              Join us and explore a new campus social platform
            </h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Create posts, follow classmates, and explore engagement analytics
              through simulation.
            </p>
          </div>

          <div className="absolute inset-0 hidden md:block pointer-events-none z-0">
            <CircleImage
              src="/logo.jpg"
              alt="circle-1"
              className="absolute left-[10rem] top-36 h-64 w-62 animate-floatBigFast"
              style={{ animationDelay: "0s" }}
            />
            <CircleImage
              src="/logo.jpg"
              alt="circle-2"
              className="absolute left-[24rem] top-11 h-40 w-40 animate-floatBigFast"
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
          <div className="relative w-full max-w-md rounded-2xl border border-brand-100 bg-white/85 p-5 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-1 ring-brand-100 backdrop-blur sm:rounded-3xl sm:p-8 lg:ml-auto">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            <h2 className="mb-6 text-lg font-semibold text-slate-800">Login</h2>

            {!authUser ? (
              <>
                <form className="space-y-4 text-left" onSubmit={handleSubmit}>
                  <label className="field-label text-sm">
                    Email
                    <input
                      type="email"
                      value={email}
                      placeholder="Enter your university email"
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="field-input"
                    />
                  </label>

                  <label className="field-label text-sm">
                    Password
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        placeholder="Enter your password"
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        className="field-input pr-10"
                      />
                      <button
                        type="button"
                        aria-label="Show or hide password"
                        className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-brand-50 px-2 py-1 text-slate-500 hover:bg-brand-100"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOff size={18} strokeWidth={2} />
                        ) : (
                          <Eye size={18} strokeWidth={2} />
                        )}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    className="brand-button w-full"
                    disabled={status.loading}
                  >
                    {status.loading ? "Signing in..." : "Sign in"}
                  </button>
                </form>

                <Feedback message={status.message} error={status.error} />

                <div className="pt-2 text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() => navigate("/reset/email")}
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    Forgot password?
                  </button>
                  <p className="mt-2 break-words">
                    New here?
                    <button
                      type="button"
                      onClick={() => navigate("/register/email")}
                      className="ml-1 font-semibold text-brand hover:text-brand-dark"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3 text-left">
                <div className="alert alert-info">You’re already signed in.</div>
                <button
                  type="button"
                  className="brand-button w-full"
                  onClick={() => navigate("/courses")}
                >
                  Enter courses
                </button>
                <button
                  type="button"
                  className="secondary-button w-full"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </aside>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Bread Capstone Team. All rights reserved.
      </footer>
    </div>
  );
}
