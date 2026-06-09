import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon, ShieldIcon, KeyRoundIcon, SmartphoneIcon } from "lucide-react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { login, adminLogin, verify2FA, switch2FAChannel } from "../lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// step: "user" | "admin" | "twoFactor" | "locked"
const LoginPage = () => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [formError, setFormError] = useState("");
  const [loginMode, setLoginMode] = useState("email"); // "email" | "phone"
  const [failCount, setFailCount] = useState(0);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [twoFAChannel, setTwoFAChannel] = useState("email"); // "email" | "phone"
  const [twoFAMockCode, setTwoFAMockCode] = useState(null); // non-null when channel is "phone" (mock SMS)
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
      if (data?.data?.requires2FA) {
        setStep("twoFactor");
        if (data.data.channel) setTwoFAChannel(data.data.channel);
        if (data.data.mockCode) setTwoFAMockCode(data.data.mockCode);
      } else invalidate();
    },
    onError: (err) => {
      const newFail = failCount + 1;
      setFailCount(newFail);
      if (newFail >= 5) setShowForgotHint(true);
      toast.error(err?.response?.data?.message || "Invalid credentials.");
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
      setFormError(err?.response?.data?.message || "Invalid credentials or admin code.");
    },
  });

  // 2FA verification
  const { mutate: doVerify2FA, isPending: isVerifying } = useMutation({
    mutationFn: verify2FA,
    onSuccess: () => invalidate(),
    onError: (err) => setFormError(err?.response?.data?.message || "Invalid or expired code."),
  });

  // 2FA channel switch
  const { mutate: doSwitch2FAChannel, isPending: isSwitchingChannel } = useMutation({
    mutationFn: (preferPhone) => switch2FAChannel({ email: loginMode === "phone" ? `+63${email}` : email, preferPhone }),
    onSuccess: (data) => {
      setTwoFAChannel(data.data?.channel ?? "email");
      setTwoFAMockCode(data.data?.mockCode ?? null);
      setTwoFACode("");
      setFormError("");
    },
    onError: (err) => setFormError(err?.response?.data?.message || "Could not switch channel."),
  });

  const isPending = isUserLogging || isAdminLogging || isVerifying;

  const handleUserLogin = (e) => {
    e.preventDefault();
    const inputEl = emailRef.current;
    if (loginMode === "phone") {
      if (!email || email.length !== 10) {
        inputEl?.setCustomValidity("Enter your 10-digit mobile number after +63");
        inputEl?.reportValidity();
        return;
      }
      doUserLogin({ email: `+63${email}`, password });
    } else {
      if (!email.trim()) {
        inputEl?.setCustomValidity("Email is required");
        inputEl?.reportValidity();
        return;
      }
      doUserLogin({ email: email.trim(), password });
    }
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

  const resetToUser = () => {
    setStep("user");
    setFormError("");
    setTwoFACode("");
    setAdminCode("");
    setTwoFAChannel("email");
    setTwoFAMockCode(null);
    setLoginMode("email");
    setShowForgotHint(false);
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
                <p className="text-sm opacity-70">Live a healthy life today with MedConnect!</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="form-control w-full">
                  {loginMode === "email" ? (
                    <>
                      <label className="label"><span className="label-text">Email</span></label>
                      <input
                        ref={emailRef}
                        type="email"
                        placeholder="name@example.com"
                        className="input input-bordered w-full"
                        value={email}
                        required
                        onChange={(e) => { setEmail(e.target.value); e.target.setCustomValidity(""); }}
                        onBlur={(e) => {
                          if (!e.target.value.trim()) e.target.setCustomValidity("Email is required");
                          else e.target.setCustomValidity("");
                        }}
                      />
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline text-left mt-1 w-fit"
                        onClick={() => { setLoginMode("phone"); setEmail(""); emailRef.current?.setCustomValidity(""); }}
                      >
                        Login using mobile number
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="label"><span className="label-text">Phone Number</span></label>
                      <div className="flex">
                        <span className="input input-bordered rounded-r-none flex items-center px-3 bg-base-200 text-sm font-mono select-none border-r-0">+63</span>
                        <input
                          ref={emailRef}
                          type="text"
                          inputMode="numeric"
                          maxLength={12}
                          placeholder="917 123 4567"
                          className="input input-bordered rounded-l-none flex-1 w-0"
                          value={email.replace(/\D/g, "").slice(0,10).replace(/^(\d{3})(\d{3})(\d{0,4})$/, (_, a, b, c) => c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a)}
                          required
                          onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); setEmail(d); e.target.setCustomValidity(""); }}
                          onBlur={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            if (!raw) e.target.setCustomValidity("Phone number is required");
                            else if (raw.length !== 10) e.target.setCustomValidity("Enter 10 digits after +63");
                            else e.target.setCustomValidity("");
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline text-left mt-1 w-fit"
                        onClick={() => { setLoginMode("email"); setEmail(""); emailRef.current?.setCustomValidity(""); }}
                      >
                        Login using email
                      </button>
                    </>
                  )}
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
              {twoFAChannel === "phone" ? (
                <p className="text-sm opacity-70">
                  A 6-digit code was sent to your <span className="font-medium text-primary">phone</span>. Enter it below.
                </p>
              ) : (
                <p className="text-sm opacity-70">
                  A 6-digit code was sent to{" "}
                  <span className="font-medium text-primary">{email}</span>. Enter it below to sign in.
                </p>
              )}

              {/* Mock phone SMS code */}
              {twoFAMockCode && (
                <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm">
                  <SmartphoneIcon className="size-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-xs opacity-80">
                    <strong>⚠ Demo mode</strong> — No SMS sent. Your code: <strong className="font-mono text-base">{twoFAMockCode}</strong>
                  </p>
                </div>
              )}

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

                <button type="submit" className="btn btn-primary w-full" disabled={isPending || isSwitchingChannel || twoFACode.length !== 6}>
                  {isVerifying ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Verify & Sign In"}
                </button>

                {/* Try another way — only visible when user has a verified phone (backend will reject if not) */}
                <button
                  type="button"
                  className="text-xs text-primary hover:underline text-center disabled:opacity-40"
                  disabled={isSwitchingChannel}
                  onClick={() => doSwitch2FAChannel(twoFAChannel !== "phone")}
                >
                  {isSwitchingChannel ? "Switching…" : twoFAChannel === "phone" ? "Try email instead" : "Try another way (SMS)"}
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

      {/* Forgot-password hint — shown after 5 failed attempts, fully optional */}
      {showForgotHint && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm text-center">
            <h3 className="font-bold text-lg mb-2">Having trouble signing in?</h3>
            <p className="text-sm opacity-70 mb-5">
              You've made several failed attempts. If you've forgotten your password, you can reset it now — or keep trying if you think you remember it.
            </p>
            <div className="flex flex-col gap-2">
              <Link to="/forgot-password" className="btn btn-primary w-full" onClick={() => setShowForgotHint(false)}>
                Reset My Password
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForgotHint(false)}>
                Keep trying
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowForgotHint(false)} />
        </div>
      )}
    </div>
  );
};

export default LoginPage;
