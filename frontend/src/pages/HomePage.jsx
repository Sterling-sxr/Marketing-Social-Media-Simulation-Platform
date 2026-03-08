import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import CircleImage from "./components/CircleImage";
import { Eye, EyeOff } from "lucide-react";


export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, login, logout } = useApp();

  // ===== Login form state (reuse LoginPage logic) =====
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
      await login(email, password);
      setStatus({ loading: false, message: "Login Success!", error: "" });
      navigate("/studenthome");
    } catch (error) {
      setStatus({ loading: false, message: "", error: error.message });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 text-slate-900 flex flex-col">
      {/* Header */}
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
          {authUser ? (
            <>
              {}
            </>
          ) : null}
        </nav>
      </header>

      <main className="flex-1 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 lg:flex-row lg:items-center">
        <section className="order-1 lg:order-none relative flex-1 md:min-h-[460px] lg:min-h-[520px] pt-2 lg:pt-6">
          <div className="relative z-10 space-y-6 max-w-[520px] -mt-4 sm:-mt-6 lg:-mt-10">
            <h1 className="text-2xl font-bold sm:text-4xl lg:text-4xl">
              Join us and explore a new campus social platform
            </h1>
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
          <div className="relative w-full max-w-md lg:ml-auto rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-100 text-center">
            <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-3xl bg-gradient-to-b from-brand/10 to-brand/0" />

            <h2 className="mb-6 text-lg font-semibold text-slate-800">Login</h2>
            {/* <p className="mb-6 text-sm text-slate-500">Student Portal</p> */}

            {!authUser ? (
              <>
                <form className="space-y-4 text-left" onSubmit={handleSubmit}>
                  <label className="block text-sm font-medium text-slate-600">
                    Email
                    <div className="input-shell mt-2">
                      <input
                        type="email"
                        value={email}
                        placeholder="Enter your university email"
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                  </label>

                  <label className="block text-sm font-medium text-slate-600">
                    Password
                    <div className="input-shell mt-2">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        placeholder="Enter your password"
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        className="w-full bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Show or hide password"
                        className="text-slate-400"
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
                    {status.loading ? "Login..." : "Login"}
                  </button>
                </form>

                <Feedback message={status.message} error={status.error} />

                <div className="pt-2 text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() => navigate("/reset/email")}
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    Forget Password?
                  </button>
                  <p className="mt-2">
                    Not have an account?
                    <button
                      type="button"
                      onClick={() => navigate("/register/email")}
                      className="ml-1 font-semibold text-brand hover:text-brand-dark"
                    >
                      Register now
                    </button>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 text-left">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-dark py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:from-brand-dark hover:to-brand"
                    onClick={() => navigate("/courses")}
                  >
                    enter course
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-orange-200 py-3 text-sm font-semibold text-brand transition hover:border-brand hover:text-brand-dark"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
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
