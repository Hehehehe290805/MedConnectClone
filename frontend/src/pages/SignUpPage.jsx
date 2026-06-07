import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon, XIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import useSignUp from "../hooks/useSignUp";
import { useSignUpStore } from "../store/useSignUpStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const TERMS_TEXT = `Terms of Service

Last updated: 2024

1. Acceptance of Terms
By accessing and using MedConnect, you accept and agree to be bound by these Terms of Service.

2. Use of Service
MedConnect provides a platform to connect patients with licensed medical professionals. You agree to use the service only for lawful purposes.

3. Medical Disclaimer
MedConnect is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.

4. Account Responsibility
You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.

5. Privacy
Your use of MedConnect is also governed by our Privacy Policy below.

6. Termination
We reserve the right to terminate accounts that violate these terms.

7. Changes to Terms
We may modify these terms at any time. Continued use of the service constitutes acceptance of the modified terms.`;

const PRIVACY_TEXT = `Privacy Policy

Last updated: 2024

1. Information We Collect
We collect information you provide directly, including name, email, date of birth, and medical professional credentials.

2. How We Use Information
We use your information to provide and improve our services, verify professional credentials, and communicate with you.

3. Information Sharing
We do not sell your personal information. We may share information with service providers who assist in our operations.

4. Data Security
We implement industry-standard security measures to protect your personal information.

5. Cookies
We use cookies to maintain your session and improve user experience.

6. Medical Information
Any medical information shared through the platform is protected and handled with strict confidentiality.

7. Your Rights
You have the right to access, correct, or delete your personal information at any time through your account settings.

8. Contact
For privacy concerns, contact us at privacy@medconnect-112605.me`;

const TermsPopup = ({ onAccept, onClose }) => {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const contentRef = useRef(null);

    const handleScroll = () => {
        const el = contentRef.current;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            setScrolledToBottom(true);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-base-100 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-base-300">
                    <h2 className="text-lg font-bold">Terms of Service & Privacy Policy</h2>
                    <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>
                <div
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 text-sm space-y-6"
                >
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{TERMS_TEXT}</pre>
                    <div className="divider" />
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{PRIVACY_TEXT}</pre>
                    <div className="h-4" />
                </div>
                <div className="p-6 border-t border-base-300">
                    {!scrolledToBottom && (
                        <p className="text-xs opacity-50 text-center mb-3">
                            Please scroll to the bottom to accept
                        </p>
                    )}
                    <button
                        className="btn btn-primary w-full"
                        disabled={!scrolledToBottom}
                        onClick={onAccept}
                    >
                        I have read and accept the Terms & Privacy Policy
                    </button>
                </div>
            </div>
        </div>
    );
};

const SignUpPage = () => {
    const navigate = useNavigate();
    const { email, step, setEmail, reset } = useSignUpStore();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsPopup, setShowTermsPopup] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [adminCode, setAdminCode] = useState("");

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [codeError, setCodeError] = useState("");
    const [codeInvalid, setCodeInvalid] = useState(false);
    const [resendMessage, setResendMessage] = useState("");
    const codeRefs = useRef([]);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const termsCheckboxRef = useRef(null);
    const adminCodeRef = useRef(null);

    const { signupMutation, isSigningUp, verifyMutation, isVerifying, resendMutation, isResending } = useSignUp();

    useEffect(() => { reset(); }, []);

    useEffect(() => {
        if (step === "verify") {
            setResendCooldown(60);
            if (emailRef.current) emailRef.current.setCustomValidity("");
            if (passwordRef.current) passwordRef.current.setCustomValidity("");
        }
    }, [step]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const images = ["/i_0.png", "/i_1.png", "/i_2.png"];
    const texts = [
        "Start your journey to better health with expert care.",
        "Get advice from top medical professionals.",
        "Your trusted partner for reliable medical guidance.",
    ];
    const [currentIndex, setCurrentIndex] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setCurrentIndex(prev => (prev + 1) % images.length), 5000);
        return () => clearInterval(interval);
    }, []);

    const getPasswordValidity = (val) => {
        if (!val) return "Password is required";
        const missing = [];
        if (val.length < 8) missing.push("at least 8 characters");
        if (!/[A-Z]/.test(val)) missing.push("an uppercase letter");
        if (!/[a-z]/.test(val)) missing.push("a lowercase letter");
        if (!/\d/.test(val)) missing.push("a number");
        if (!/[@$!%*?&]/.test(val)) missing.push("a symbol (@$!%*?&)");
        return missing.length > 0 ? "Password needs: " + missing.join(", ") : "";
    };

    const handleSignup = (e) => {
        e.preventDefault();

        // check terms first
        if (!termsAccepted) {
            termsCheckboxRef.current?.setCustomValidity("Please accept the Terms of Service and Privacy Policy.");
            termsCheckboxRef.current?.reportValidity();
            return;
        }

        // validate email
        if (!formData.email) {
            emailRef.current?.setCustomValidity("Email is required");
            emailRef.current?.reportValidity();
            return;
        }
        if (!EMAIL_REGEX.test(formData.email)) {
            emailRef.current?.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
            emailRef.current?.reportValidity();
            return;
        }

        // validate password
        const pwMsg = getPasswordValidity(formData.password);
        if (pwMsg) {
            passwordRef.current?.setCustomValidity(pwMsg);
            passwordRef.current?.reportValidity();
            return;
        }

        if (isAdminMode && !adminCode.trim()) {
            adminCodeRef.current?.setCustomValidity("Admin code is required");
            adminCodeRef.current?.reportValidity();
            return;
        }

        const payload = { email: formData.email, password: formData.password };
        if (isAdminMode) payload.adminCode = adminCode;

        signupMutation(
            payload,
            { onError: (err) => toast.error(err?.response?.data?.message || "Something went wrong.") }
        );
    };

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        if (value && index < 5) codeRefs.current[index + 1]?.focus();
    };

    const handleCodeKeyDown = (index, e) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            codeRefs.current[index - 1]?.focus();
        }
    };

    const handleCodePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        const newCode = [...code];
        pasted.split("").forEach((char, i) => { newCode[i] = char; });
        setCode(newCode);
        codeRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleVerify = (e) => {
        e.preventDefault();
        const fullCode = code.join("");
        if (fullCode.length !== 6) return;
        setCodeError("");
        setCodeInvalid(false);
        verifyMutation({ email, code: fullCode }, {
            onSuccess: () => navigate("/onboarding"),
            onError: (err) => {
                setCodeInvalid(true);
                setCodeError(err?.response?.data?.message || "Incorrect code. Please try again.");
                setCode(["", "", "", "", "", ""]);
                setTimeout(() => codeRefs.current[0]?.focus(), 50);
            },
        });
    };

    const handleResend = () => {
        if (resendCooldown > 0) return;
        resendMutation({ email }, {
            onSuccess: () => {
                setResendMessage("A new code has been sent to your email.");
                setResendCooldown(60);
                setCode(["", "", "", "", "", ""]);
                setCodeInvalid(false);
                setCodeError("");
                codeRefs.current[0]?.focus();
                setTimeout(() => setResendMessage(""), 5000);
            },
            onError: (err) => {
                setResendMessage(err?.response?.data?.message || "Failed to resend code.");
            },
        });
    };

    return (
        <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="light">
            <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">

                {/* LEFT — FORM */}
                <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
                    <div className="mb-4 flex items-center justify-start gap-2">
                        <BriefcaseMedicalIcon className="size-9 text-accent" />
                        <span className="text-accent text-3xl font-bold font-mono tracking-wider">MedConnect</span>
                    </div>

                    <div className="w-full">
                        <form onSubmit={handleSignup}>
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-semibold">Create an Account</h2>
                                    <p className="text-sm opacity-70">Live a healthy life today with MedConnect!</p>
                                </div>
                                <div className="space-y-3">

                                    {/* EMAIL */}
                                    <div className="form-control w-full">
                                        <label className="label"><span className="label-text">Email</span></label>
                                        <input
                                            ref={emailRef}
                                            type="email"
                                            autoComplete="email"
                                            placeholder="john@gmail.com"
                                            className="input input-bordered w-full"
                                            value={formData.email}
                                            required
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                                e.target.setCustomValidity("");
                                            }}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                if (!val) e.target.setCustomValidity("Email is required");
                                                else if (!EMAIL_REGEX.test(val)) e.target.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
                                                else e.target.setCustomValidity("");
                                            }}
                                        />
                                    </div>

                                    {/* PASSWORD */}
                                    <div className="form-control w-full">
                                        <label className="label"><span className="label-text">Password</span></label>
                                        <input
                                            ref={passwordRef}
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="••••••••"
                                            className="input input-bordered w-full"
                                            value={formData.password}
                                            required
                                            onChange={(e) => {
                                                setFormData({ ...formData, password: e.target.value });
                                                e.target.setCustomValidity("");
                                            }}
                                            onBlur={(e) => {
                                                const msg = getPasswordValidity(e.target.value);
                                                e.target.setCustomValidity(msg);
                                            }}
                                        />
                                        {!formData.password && (
                                            <p className="text-xs opacity-70 mt-1">
                                                Must be 8+ characters with uppercase, lowercase, number, and symbol
                                            </p>
                                        )}
                                    </div>

                                    {/* ADMIN CODE */}
                                    {isAdminMode && (
                                        <div className="form-control w-full">
                                            <label className="label"><span className="label-text">Admin Code</span></label>
                                            <input
                                                ref={adminCodeRef}
                                                type="text"
                                                placeholder="Enter admin code"
                                                className="input input-bordered w-full"
                                                value={adminCode}
                                                required
                                                onChange={(e) => {
                                                    setAdminCode(e.target.value);
                                                    e.target.setCustomValidity("");
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* TERMS */}
                                    <div className="form-control">
                                        <label className="label cursor-pointer justify-start gap-2">
                                            <input
                                                ref={termsCheckboxRef}
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={termsAccepted}
                                                onChange={() => {
                                                    if (!termsAccepted) setShowTermsPopup(true);
                                                }}
                                            />
                                            <span className="text-xs leading-tight">
                                                I agree to the{" "}
                                                <span
                                                    className="text-primary hover:underline cursor-pointer"
                                                    onClick={(e) => { e.preventDefault(); setShowTermsPopup(true); }}
                                                >
                                                    terms of service
                                                </span>
                                                {" "}and{" "}
                                                <span
                                                    className="text-primary hover:underline cursor-pointer"
                                                    onClick={(e) => { e.preventDefault(); setShowTermsPopup(true); }}
                                                >
                                                    privacy policy
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    <button className="btn btn-primary w-full text-white" type="submit" disabled={isSigningUp}>
                                        {isSigningUp ? <><span className="loading loading-spinner loading-xs" />Loading...</> : "Create Account"}
                                    </button>
                                    <div className="text-center mt-4">
                                        <p className="text-sm">
                                            Already have an account?{" "}
                                            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                                        </p>
                                    </div>
                                    
                                    <div className="text-center mt-3 pt-3 border-t border-base-300">
                                        <button
                                            type="button"
                                            className="text-xs opacity-40 hover:opacity-70 transition-opacity"
                                            onClick={() => setIsAdminMode(!isAdminMode)}
                                        >
                                            {isAdminMode ? "<- Back to User Sign Up" : "Admin Sign Up ->"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* RIGHT — IMAGE */}
                <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
                    <div className="max-w-md p-8">
                        <div className="relative aspect-square max-w-sm mx-auto">
                            <img src={images[currentIndex]} alt="MedConnect illustration" className="w-full h-full" />
                        </div>
                        <div className="text-center space-y-3 mt-6">
                            <h2 className="text-xl font-semibold">Connect with licensed professionals</h2>
                            <p className="opacity-70">{texts[currentIndex]}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TERMS POPUP */}
            {showTermsPopup && (
                <TermsPopup
                    onAccept={() => {
                        setTermsAccepted(true);
                        termsCheckboxRef.current?.setCustomValidity("");
                        setShowTermsPopup(false);
                    }}
                    onClose={() => setShowTermsPopup(false)}
                />
            )}

            {/* EMAIL VERIFY POPUP */}
            {step === "verify" && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-base-100 rounded-xl shadow-xl p-8 w-full max-w-md">
                        <div className="text-center mb-6">
                            <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                            <h2 className="text-xl font-bold">Verify Your Email</h2>
                            <p className="text-sm opacity-70 mt-1">
                                We sent a 6-digit code to{" "}
                                <span className="font-medium text-primary">{email}</span>
                            </p>
                        </div>

                        <form onSubmit={handleVerify} className="space-y-6">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex justify-center gap-2">
                                    {code.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => (codeRefs.current[i] = el)}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => {
                                                setCodeInvalid(false);
                                                setCodeError("");
                                                handleCodeChange(i, e.target.value);
                                            }}
                                            onKeyDown={(e) => handleCodeKeyDown(i, e)}
                                            onPaste={i === 0 ? handleCodePaste : undefined}
                                            className={`input input-bordered w-12 h-12 text-center text-xl font-bold ${codeInvalid ? "input-error" : ""}`}
                                        />
                                    ))}
                                </div>
                                {codeError && (
                                    <p className="text-error text-xs text-center">{codeError}</p>
                                )}
                            </div>

                            <button className="btn btn-primary w-full" type="submit" disabled={isVerifying || code.join("").length !== 6}>
                                {isVerifying ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Verify Email"}
                            </button>

                            <div className="text-center space-y-1">
                                <p className="text-sm text-base-content/70">
                                    Did not receive an email?{" "}
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        disabled={resendCooldown > 0 || isResending}
                                        className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                        {isResending ? "Sending..."
                                            : resendCooldown > 0 ? `Resend Code (${resendCooldown}s)`
                                                : "Resend Code"}
                                    </button>
                                </p>
                                {resendMessage && (
                                    <p className={`text-xs ${resendMessage.includes("sent") ? "text-success" : "text-error"}`}>
                                        {resendMessage}
                                    </p>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignUpPage;