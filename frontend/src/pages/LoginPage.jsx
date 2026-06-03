import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon, ShieldIcon, KeyRoundIcon, LockIcon } from "lucide-react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { login, adminLogin, verify2FA, resetForgotPassword } from "../lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// step: "user" | "admin" | "twoFactor" | "locked"
const LoginPage = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [lockedCode, setLockedCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const emailRef = useRef(null);

  const images = ["/i_0.png", "/i_1.png", "/i_2.png"];
  const texts = [
    "Start your journey to better health with expert care.",
    "Get advice from top medical professionals.",
    "Your trusted partner for reliable medical guidance.",
  ];
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlideIdx(i => (i + 1) % images.length), 5000);
    return () => clearInterval(t);
  }, []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["authUser"] });

  // Regular user login
  const { mutate: doUserLogin, isPending: isUserLogging } = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (data?.data?.requires2FA) setStep("twoFactor");
      else invalidate();
    },
    onError: (err) => {
      if (err?.response?.status === 429) { setStep("locked"); setFormError(""); return; }
      toast.error(err?.response?.data?.message || "Invalid email or password.");
    },
  });

  // Admin login (email + password + admin code all at once)
  const { mutate: doAdminLogin, isPending: isAdminLogging } = useMutation({
    mutationFn: adminLogin,
    onSuccess: (data) => {
      if (data?.data?.requires2FA) setStep("twoFactor");
      else invalidate();
    },
    onError: (err) => {
      if (err?.response?.status === 429) { setStep("locked"); setFormError(""); return; }
      setFormError(err?.response?.data?.message || "Invalid credentials or admin code.");
    },
  });

  // 2FA verification
  const { mutate: doVerify2FA, isPending: isVerifying } = useMutation({
    mutationFn: verify2FA,
    onSuccess: () => invalidate(),
    onError: (err) => setFormError(err?.response?.data?.message || "Invalid or expired code."),
  });

  // Brute-force lockout reset
  const { mutate: doResetPassword, isPending: isResetting } = useMutation({
    mutationFn: resetForgotPassword,
    onSuccess: () => {
      toast.success("Password reset! You can now sign in with your new password.");
      setStep("user");
      setLockedCode(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (err) => setFormError(err?.response?.data?.message || "Invalid or expired code."),
  });

  const isPending = isUserLogging || isAdminLogging || isVerifying || isResetting;

  const validateEmail = () => {
    if (!EMAIL_REGEX.test(email)) {
      emailRef.current?.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
      emailRef.current?.reportValidity();
      return false;
    }
    return true;
  };

  const handleUserLogin = (e) => {
    e.preventDefault();
    if (!validateEmail()) return;
    doUserLogin({ email, password });
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setFormError("");
    if (!email || !password || !adminCode.trim()) {
      setFormError("All fields are required.");
      return;
    }
    doAdminLogin({ email, password, adminCode });
  };

  const handleVerify2FA = (e) => {
    e.preventDefault();
    setFormError("");
    if (twoFACode.length !== 6) { setFormError("Please enter the 6-digit code."); return; }
    doVerify2FA({ email, code: twoFACode });
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    setFormError("");
    if (lockedCode.length !== 6) { setFormError("Enter the 6-digit code from your email."); return; }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setFormError("Password needs 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&).");
      return;
    }
    if (newPassword !== confirmPassword) { setFormError("Passwords do not match."); return; }
    doResetPassword({ email, code: lockedCode, newPassword });
  };

  const resetToUser = () => {
    setStep("user");
    setFormError("");
    setTwoFACode("");
    setAdminCode("");
    setLockedCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const ImagePanel = () => (
    <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
      <div className="max-w-md p-8">
        <div className="relative aspect-square max-w-sm mx-auto">
          <img src={images[slideIdx]} alt="MedConnect illustration" className="w-full h-full" />
        </div>
        <div className="text-center space-y-3 mt-6">
          <h2 className="text-xl font-semibold">Connect with licensed professionals</h2>
          <p className="opacity-70">{texts[slideIdx]}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="light">
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">

        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseMedicalIcon className="size-9 text-primary" />
            <span className="text-accent text-3xl font-bold font-mono tracking-wider">MedConnect</span>
          </div>

          {/* ── User login ── */}
          {step === "user" && (
            <form onSubmit={handleUserLogin} className="space-y-4 w-full">
              <div>
                <h2 className="text-xl font-semibold">Welcome Back</h2>
                <p className="text-sm opacity-70">Sign in to continue your journey to better health.</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Email</span></label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="JohnDoe@example.com"
                    className="input input-bordered w-full"
                    value={email}
                    required
                    onChange={(e) => { setEmail(e.target.value); e.target.setCustomValidity(""); }}
                    onBlur={(e) => {
                      if (!e.target.value) e.target.setCustomValidity("Email is required");
                      else if (!EMAIL_REGEX.test(e.target.value)) e.target.setCustomValidity("Please enter a valid email address.");
                      else e.target.setCustomValidity("");
                    }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Password</span></label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="input input-bordered w-full"
                    value={password}
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                  {isPending ? <><span className="loading loading-spinner loading-xs" />Signing in...</> : "Sign In"}
                </button>

                <div className="text-center">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
                </div>

                <div className="text-center mt-1">
                  <p className="text-sm">
                    Don't have an account?{" "}
                    <Link to="/signup" className="text-primary hover:underline">Create one</Link>
                  </p>
                </div>

                {/* Admin login — subtle, out of the way */}
                <div className="text-center mt-3 pt-3 border-t border-base-300">
                  <button
                    type="button"
                    className="text-xs opacity-40 hover:opacity-70 transition-opacity"
                    onClick={() => { setStep("admin"); setFormError(""); }}
                  >
                    Admin Login →
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── Admin login ── */}
          {step === "admin" && (
            <form onSubmit={handleAdminLogin} className="space-y-4 w-full">
              <div className="flex items-center gap-2">
                <ShieldIcon className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">Admin Login</h2>
              </div>
              <p className="text-sm opacity-70">Enter your email, password, and admin code to sign in.</p>

              <div className="flex flex-col gap-3">
                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Email</span></label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    className="input input-bordered w-full"
                    value={email}
                    autoFocus
                    required
                    onChange={(e) => { setEmail(e.target.value); setFormError(""); }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Password</span></label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="input input-bordered w-full"
                    value={password}
                    required
                    onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Admin Code</span></label>
                  <input
                    type="text"
                    placeholder="Enter your admin code"
                    className={`input input-bordered w-full ${formError ? "input-error" : ""}`}
                    value={adminCode}
                    required
                    onChange={(e) => { setAdminCode(e.target.value); setFormError(""); }}
                  />
                  {formError && <p className="text-error text-xs mt-1">{formError}</p>}
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                  {isPending ? <><span className="loading loading-spinner loading-xs" />Signing in...</> : "Sign In as Admin"}
                </button>

                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={resetToUser}>
                  ← Back to User Login
                </button>
              </div>
            </form>
          )}

          {/* ── 2FA verification ── */}
          {step === "twoFactor" && (
            <form onSubmit={handleVerify2FA} className="space-y-4 w-full">
              <div className="flex items-center gap-2">
                <KeyRoundIcon className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">Two-Factor Verification</h2>
              </div>
              <p className="text-sm opacity-70">
                A 6-digit code was sent to{" "}
                <span className="font-medium text-primary">{email}</span>. Enter it below to sign in.
              </p>

              <div className="flex flex-col gap-3">
                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Verification Code</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className={`input input-bordered w-full tracking-widest text-center text-lg ${formError ? "input-error" : ""}`}
                    value={twoFACode}
                    autoFocus
                    onChange={(e) => { setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6)); setFormError(""); }}
                  />
                  {formError && <p className="text-error text-xs mt-1">{formError}</p>}
                </div>

                <button type="submit" className="btn btn-primary w-full" disabled={isPending || twoFACode.length !== 6}>
                  {isPending ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Verify & Sign In"}
                </button>

                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={resetToUser}>
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ── Account locked (brute-force) — inline reset ── */}
          {step === "locked" && (
            <form onSubmit={handleResetPassword} className="space-y-4 w-full">
              <div className="flex items-center gap-2">
                <LockIcon className="size-5 text-error" />
                <h2 className="text-xl font-semibold">Account Locked</h2>
              </div>

              <div className="alert bg-error/10 border border-error/20 text-sm py-3">
                Too many failed attempts. A 6-digit reset code was sent to your email — enter it below along with a new password to unlock your account.
              </div>

              <div className="flex flex-col gap-3">
                {/* Email editable in case user refreshed the page */}
                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Email</span></label>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    value={email}
                    required
                    onChange={(e) => { setEmail(e.target.value); setFormError(""); }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Reset Code (from email)</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    className={`input input-bordered w-full tracking-widest text-center text-lg ${formError ? "input-error" : ""}`}
                    value={lockedCode}
                    autoFocus
                    onChange={(e) => { setLockedCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setFormError(""); }}
                  />
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">New Password</span></label>
                  <input
                    type="password"
                    placeholder="New password"
                    className="input input-bordered w-full"
                    value={newPassword}
                    required
                    onChange={(e) => { setNewPassword(e.target.value); setFormError(""); }}
                  />
                  <p className="text-xs opacity-50 mt-1">8+ chars, uppercase, lowercase, number, symbol (@$!%*?&)</p>
                </div>

                <div className="form-control w-full">
                  <label className="label"><span className="label-text">Confirm New Password</span></label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    className="input input-bordered w-full"
                    value={confirmPassword}
                    required
                    onChange={(e) => { setConfirmPassword(e.target.value); setFormError(""); }}
                  />
                </div>

                {formError && <p className="text-error text-xs">{formError}</p>}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isPending || lockedCode.length !== 6 || !newPassword || !confirmPassword}
                >
                  {isResetting
                    ? <><span className="loading loading-spinner loading-xs" />Resetting...</>
                    : "Reset Password & Unlock"}
                </button>

                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={resetToUser}>
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        <ImagePanel />
      </div>
    </div>
  );
};

export default LoginPage;
