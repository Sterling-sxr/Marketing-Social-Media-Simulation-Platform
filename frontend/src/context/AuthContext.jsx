/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from "react";
import { useApp } from "./AppContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const app = useApp();

  const authValue = useMemo(
    () => ({
      authUser: app.authUser,
      authCheckComplete: app.authCheckComplete,
      isAuthenticated: app.isAuthenticated,
      login: app.login,
      logout: app.logout,
      setAuthUser: app.setAuthUser,
      registerEmail: app.registerEmail,
      setRegisterEmail: app.setRegisterEmail,
      registerStatus: app.registerStatus,
      startRegister: app.startRegister,
      verifyDigits: app.verifyDigits,
      setVerifyDigits: app.setVerifyDigits,
      verifyStatus: app.verifyStatus,
      verifyContext: app.verifyContext,
      verifyRegisterCode: app.verifyRegisterCode,
      verifyResetCode: app.verifyResetCode,
      resendCode: app.resendCode,
      registerPassword: app.registerPassword,
      setRegisterPassword: app.setRegisterPassword,
      registerPasswordConfirm: app.registerPasswordConfirm,
      setRegisterPasswordConfirm: app.setRegisterPasswordConfirm,
      registerCompleteStatus: app.registerCompleteStatus,
      completeRegistration: app.completeRegistration,
      registerVerifiedEmail: app.registerVerifiedEmail,
      resetEmail: app.resetEmail,
      setResetEmail: app.setResetEmail,
      resetStatus: app.resetStatus,
      startReset: app.startReset,
      resetVerifiedEmail: app.resetVerifiedEmail,
      resetPasswords: app.resetPasswords,
      setResetPasswords: app.setResetPasswords,
      resetCompleteStatus: app.resetCompleteStatus,
      completeReset: app.completeReset,
    }),
    [app]
  );

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
