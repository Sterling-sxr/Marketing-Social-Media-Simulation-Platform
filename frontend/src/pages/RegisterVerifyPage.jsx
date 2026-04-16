import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Feedback from "./components/Feedback";
import DigitInput from "./components/DigitInput";
import AuthLayout from "./components/AuthLayout";

export default function RegisterVerifyPage() {
  // Router navigation
  const navigate = useNavigate();

  // Verification state and actions from app context
  const {
    verifyContext,
    verifyDigits,
    setVerifyDigits,
    verifyStatus,
    verifyRegisterCode,
    resendCode,
  } = useApp();

  // Guard this page
  // Redirect if the verify flow is missing
  // Or if the mode is not "register"
  useEffect(() => {
    if (!verifyContext || verifyContext.mode !== "register") {
      navigate("/register/email", { replace: true });
    }
  }, [verifyContext, navigate]);

  // Submit verification code
  const handleSubmit = async (event) => {
    // Prevent default form submit
    if (event) event.preventDefault();

    // Verify the 4-digit code
    const success = await verifyRegisterCode();

    // Go to password step after success
    if (success) navigate("/register/password");
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the 4-digit code sent to ${verifyContext?.email || ""}.`}
      backTo="/register/email"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* 4-digit input boxes */}
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
          Resend code
        </button>
      </form>

      {/* Status feedback */}
      <Feedback
        message={verifyStatus.message}
        error={verifyStatus.error}
        devCode={verifyStatus.devCode}
      />
    </AuthLayout>
  );
}
