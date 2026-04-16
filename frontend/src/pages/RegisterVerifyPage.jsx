import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import DigitInput from "./components/DigitInput";
import AuthLayout from "./components/AuthLayout";

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
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 4-digit code sent to ${verifyContext?.email || ""}.`}
      backTo="/register/email"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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
          {verifyStatus.loading ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          className="secondary-button w-full"
          disabled={verifyStatus.loading}
          onClick={resendCode}
        >
          Resend code
        </button>
      </form>

      <Feedback
        message={verifyStatus.message}
        error={verifyStatus.error}
        devCode={verifyStatus.devCode}
      />
    </AuthLayout>
  );
}
