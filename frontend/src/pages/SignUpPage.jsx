import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon, XIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import useSignUp from "../hooks/useSignUp";
import { useSignupStore } from "../store/useSignupStore";

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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-6 border-b border-base-300">
                    <h2 className="text-lg font-bold">Terms of Service & Privacy Policy</h2>
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
    const { email, step, setStep, setEmail, reset } = useSignupStore();

    const [formData, setFormData] = useState({ email: "", password: "", terms: false });
    const [fieldErrors, setFieldErrors] = useState({});
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsPopup, setShowTermsPopup] = useState(false);

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendMessage, setResendMessage] = useState("");
    const codeRefs = useRef([]);

    const { signupMutation, isSigningUp, signupError, verifyMutation, isVerifying, verifyError, resendMutation, isResending } = useSignUp();

    useEffect(() => { reset(); }, []);

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

    const validateForm = () => {
        const e = {};
        if (!formData.email) {
            e.email = "Email is required";
        } else if (!EMAIL_REGEX.test(formData.email)) {
            e.email = "Please enter a valid email address";
        }
        if (!formData.password) {
            e.password = "Password is required";
        } else if (!PASSWORD_REGEX.test(formData.password)) {
            e.password = "Password must be 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&)";
        }
        if (!termsAccepted) {
            e.terms = "You must accept the Terms of Service and Privacy Policy";
        }
        setFieldErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSignup = (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        signupMutation({ email: formData.email, password: formData.password });
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
        verifyMutation({ email, code: fullCode }, {
            onSuccess: () => navigate("/onboarding"),
            onError: () => { },
        });
    };

    const handleResend = () => {
        if (resendCooldown > 0) return;
        resendMutation({ email }, {
            onSuccess: () => {
                setResendMessage("A new code has been sent to your email.");
                setResendCooldown(60);
                setCode(["", "", "", "", "", ""]);
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
                        <form onSubmit={handleSignup} noValidate>
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
                                            type="email"
                                            autoComplete="email"
                                            placeholder="john@gmail.com"
                                            className={`input input-bordered w-full ${fieldErrors.email ? "input-error" : ""}`}
                                            value={formData.email}
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                                            }}
                                            onBlur={() => {
                                                if (!formData.email) {
                                                    setFieldErrors(prev => ({ ...prev, email: "Email is required" }));
                                                } else if (!EMAIL_REGEX.test(formData.email)) {
                                                    setFieldErrors(prev => ({ ...prev, email: "Please enter a valid email address" }));
                                                }
                                            }}
                                        />
                                        {fieldErrors.email && (
                                            <div className="label">
                                                <span className="label-text-alt text-error">{fieldErrors.email}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* PASSWORD */}
                                    <div className="form-control w-full">
                                        <label className="label"><span className="label-text">Password</span></label>
                                        <input
                                            type="password"
                                            autoComplete="new-password"
                                            placeholder="••••••••"
                                            className={`input input-bordered w-full ${fieldErrors.password ? "input-error" : ""}`}
                                            value={formData.password}
                                            onChange={(e) => {
                                                setFormData({ ...formData, password: e.target.value });
                                                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                                            }}
                                            onBlur={() => {
                                                if (!formData.password) {
                                                    setFieldErrors(prev => ({ ...prev, password: "Password is required" }));
                                                } else if (!PASSWORD_REGEX.test(formData.password)) {
                                                    setFieldErrors(prev => ({ ...prev, password: "Password must be 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&)" }));
                                                }
                                            }}
                                        />
                                        {fieldErrors.password ? (
                                            <div className="label">
                                                <span className="label-text-alt text-error">{fieldErrors.password}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs opacity-70 mt-1">
                                                Must be 8+ characters with uppercase, lowercase, number, and symbol
                                            </p>
                                        )}
                                    </div>

                                    {/* TERMS */}
                                    <div className="form-control">
                                        <label className="label cursor-pointer justify-start gap-2">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={termsAccepted}
                                                disabled={!termsAccepted}
                                                onChange={() => {
                                                    if (!termsAccepted) setShowTermsPopup(true);
                                                }}
                                                onClick={() => {
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
                                        {fieldErrors.terms && (
                                            <p className="text-error text-xs ml-1">{fieldErrors.terms}</p>
                                        )}
                                    </div>

                                    {signupError && (
                                        <div className="alert alert-error">
                                            <span className="text-sm">{signupError?.response?.data?.message || "Something went wrong."}</span>
                                        </div>
                                    )}

                                    <button className="btn btn-primary w-full text-white" type="submit" disabled={isSigningUp}>
                                        {isSigningUp ? <><span className="loading loading-spinner loading-xs" />Loading...</> : "Create Account"}
                                    </button>
                                    <div className="text-center mt-4">
                                        <p className="text-sm">
                                            Already have an account?{" "}
                                            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                                        </p>
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
                        setShowTermsPopup(false);
                        setFieldErrors(prev => ({ ...prev, terms: undefined }));
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

                        {verifyError && (
                            <div className="alert alert-error mb-4">
                                <span className="text-sm">{verifyError?.response?.data?.message || "Invalid code."}</span>
                            </div>
                        )}

                        <form onSubmit={handleVerify} className="space-y-6">
                            <div className="flex justify-center gap-2">
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (codeRefs.current[i] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleCodeChange(i, e.target.value)}
                                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                                        onPaste={i === 0 ? handleCodePaste : undefined}
                                        className="input input-bordered w-12 h-12 text-center text-xl font-bold"
                                    />
                                ))}
                            </div>

                            <button className="btn btn-primary w-full" type="submit" disabled={isVerifying || code.join("").length !== 6}>
                                {isVerifying ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Verify Email"}
                            </button>

                            <div className="text-center space-y-1">
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0 || isResending}
                                    className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isResending ? "Sending..."
                                        : resendCooldown > 0 ? `Resend code (${resendCooldown}s)`
                                            : "Resend code"}
                                </button>
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