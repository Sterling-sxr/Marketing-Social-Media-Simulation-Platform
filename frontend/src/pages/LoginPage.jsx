import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import AuthLayout from "./components/AuthLayout";

export default function LoginPage() {
  const navigate = useNavigate();
  const { authUser, login, logout } = useApp();

  // Section summary: this block is documented for clarity.
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
      if (result?.needsProfile) {
        navigate("/onboarding/profile", { replace: true });
        return;
      }
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
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue."
      backTo="/"
    >
      {!authUser ? (
        <>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="field-label">
              Student email
              <input
                type="email"
                value={email}
                placeholder="z1234567@ad.unsw.edu.au"
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="field-input"
              />
            </label>

            <label className="field-label">
              Password
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
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
                  {showPassword ? "Hide" : "Show"}
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
            <p className="mt-2">
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
        <div className="space-y-3">
          <div className="alert alert-info">
            You’re already signed in.
          </div>
          <button
            type="button"
            className="brand-button w-full"
            onClick={() => navigate("/courses")}
          >
            Go to courses
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
    </AuthLayout>
  );
}
