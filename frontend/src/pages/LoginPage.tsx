import React, { useState } from "react";
import {
  Building2,
  Lock,
  Mail,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api";

export function LoginPage() {
  const { login, error: authError, isLoading: isAuthLoading } = useAuth();

  // State for toggling views
  const [viewState, setViewState] = useState<
    "login" | "request_reset" | "verify_reset"
  >("login");

  // Login Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Reset Form State
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Local Loading/Error States
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(username, password);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      await api.post("/users/request-reset/", { email: resetEmail });
      setSuccessMessage("If the email exists, a reset code has been sent.");
      setViewState("verify_reset");
    } catch (err: any) {
      setLocalError(
        err.response?.data?.detail ||
          "Failed to request reset. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (newPassword !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/users/verify-reset/", {
        email: resetEmail,
        otp: otp,
        new_password: newPassword,
      });
      setSuccessMessage("Password successfully reset! You can now log in.");
      setViewState("login");
      // Pre-fill username for context if possible, but keep simple
      setUsername("");
      setPassword("");
    } catch (err: any) {
      setLocalError(
        err.response?.data?.detail ||
          "Failed to verify code. Please check your OTP and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 sm:p-12">
      <div className="w-full max-w-md flex flex-col">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/20">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">BuildWise</h1>
          <p className="text-slate-300">Project Control Suite</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 relative overflow-hidden transition-all duration-300">
          {/* Default Login View */}
          {viewState === "login" && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                Sign In
              </h2>

              {successMessage && (
                <div className="p-3 mb-6 flex items-center gap-2 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
                  <CheckCircle2 size={16} />
                  <p>{successMessage}</p>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Username
                  </label>
                  <div className="relative">
                    <Building2
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="admin"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 flex items-center gap-2 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                    <AlertCircle size={16} />
                    <p>{authError}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 pb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-slate-600">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setViewState("request_reset");
                      setSuccessMessage("");
                      setLocalError("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md shadow-blue-500/20"
                >
                  {isAuthLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            </div>
          )}

          {/* Request Reset Code View */}
          {viewState === "request_reset" && (
            <div className="animate-fade-in pl-1">
              <button
                onClick={() => setViewState("login")}
                className="mb-6 flex flex-row items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Reset Password
              </h2>
              <p className="text-slate-500 text-sm mb-6 pb-2 border-b border-slate-100">
                Enter your account email address and we will send you a secure
                6-digit verification code.
              </p>

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                {localError && (
                  <div className="p-3 flex items-start gap-2 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{localError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !resetEmail}
                  className="w-full mt-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md shadow-orange-500/20"
                >
                  {isLoading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            </div>
          )}

          {/* Verify Reset Code View */}
          {viewState === "verify_reset" && (
            <div className="animate-fade-in pl-1">
              <button
                onClick={() => setViewState("login")}
                className="mb-6 flex flex-row items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>

              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Verify & Reset
              </h2>
              <p className="text-slate-500 text-sm mb-6 pb-2 border-b border-slate-100">
                We've sent a 6-digit code to <strong>{resetEmail}</strong>.
                Please enter it below to create a new password.
              </p>

              {successMessage && !localError && (
                <div className="p-3 mb-6 flex items-start gap-2 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <p>{successMessage}</p>
                </div>
              )}

              <form onSubmit={handleVerifyReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, ""))
                      } // numbers only
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition tracking-widest font-mono text-center text-lg"
                      placeholder="XXXXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 pt-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      required
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {localError && (
                  <div className="p-3 flex items-start gap-2 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p>{localError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    otp.length !== 6 ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center shadow-md shadow-blue-500/20"
                >
                  {isLoading ? "Verifying..." : "Reset Password & Login"}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={handleRequestReset}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Didn't receive a code? Resend
                  </button>
                </div>
              </form>
            </div>
          )}

          {viewState === "login" && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-center text-sm text-slate-500">
                Need access? Contact your administrator
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400/80 text-sm mt-8">
          © {new Date().getFullYear()} Adroit Construction Company Ltd.
        </p>
      </div>
    </div>
  );
}
