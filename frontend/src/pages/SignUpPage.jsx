import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon, XIcon, AlertTriangleIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import useSignUp from "../hooks/useSignUp";
import { useSignUpStore } from "../store/useSignUpStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const TERMS_TEXT = `MEDCONNECT TERMS AND CONDITIONS

Last Updated: June 2026

1. Sign Up and Login

1.1 Users must provide accurate, complete, and up-to-date information when creating an account on MedConnect.

1.2 Patients, doctors, pharmacists, and administrators are responsible for maintaining the confidentiality of their login credentials.

1.3 Users must not share their accounts with others or allow unauthorized access to their accounts.

1.4 MedConnect reserves the right to suspend or terminate accounts found to contain false information, fraudulent credentials, or violations of these Terms and Conditions.

1.5 Licensed healthcare professionals must provide valid credentials for verification before gaining access to professional services on the platform.

---

2. Privacy Act and Data Protection

2.1 MedConnect is committed to protecting user privacy and handling personal information in accordance with applicable data protection laws, including the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).

2.2 We collect information such as names, email addresses, contact information, dates of birth, healthcare credentials, and other data necessary to provide our services.

2.3 User information is collected, stored, and processed solely for legitimate healthcare, communication, verification, and platform management purposes.

2.4 MedConnect implements industry-standard security measures to safeguard personal and medical information from unauthorized access, disclosure, or misuse.

2.5 Users have the right to access, update, or request the deletion of their personal information, subject to legal and regulatory requirements.

---

3. All Interactions Between Users and Doctors

3.1 MedConnect serves as a platform that facilitates communication between patients and licensed healthcare professionals.

3.2 All consultations, advice, recommendations, and medical opinions provided through the platform remain the responsibility of the healthcare professional.

3.3 Patients must provide accurate health information to ensure appropriate medical guidance and services.

3.4 MedConnect does not replace emergency medical services and should not be used during life-threatening medical emergencies.

3.5 Users are expected to maintain respectful and professional conduct during all interactions on the platform.

3.6 Any abuse, harassment, discrimination, or inappropriate behavior may result in account suspension or termination.

---

4. Patients, Institutes, and Services

4.1 Patients may access healthcare services offered by accredited medical professionals, clinics, hospitals, and healthcare institutions registered on MedConnect.

4.2 Healthcare institutions are responsible for ensuring the accuracy of information regarding their facilities, schedules, and services.

4.3 MedConnect does not guarantee the availability, outcome, or quality of services provided by third-party healthcare institutions.

4.4 Appointment scheduling, service requests, and healthcare transactions are subject to the policies and availability of the participating institution.

4.5 Patients are responsible for reviewing and understanding any requirements, fees, or policies associated with healthcare services before proceeding.

---

5. Patients and Pharmacy Services

5.1 MedConnect may facilitate communication and transactions between patients and partner pharmacies.

5.2 Prescription medications may only be dispensed upon presentation and verification of a valid prescription issued by a licensed healthcare professional.

5.3 Patients are responsible for ensuring that prescription information submitted through the platform is accurate and valid.

5.4 Pharmacies are responsible for the quality, availability, dispensing, and delivery of medications offered through their services.

5.5 MedConnect is not liable for delays, stock shortages, pricing discrepancies, or issues arising from third-party pharmacy operations.

---

6. Admin Discretion

6.1 MedConnect administrators reserve the right to monitor platform activities to maintain security, compliance, and service quality.

6.2 Administrators may review reports, complaints, or suspected violations of platform policies.

6.3 MedConnect reserves the right to suspend, restrict, or terminate user accounts that violate these Terms and Conditions or engage in activities that compromise platform integrity.

6.4 Administrators may remove content, restrict access, or take appropriate actions when necessary to protect users, healthcare professionals, and the platform.

6.5 Decisions made by platform administrators regarding policy enforcement shall be considered final, subject to applicable laws and regulations.

---

7. Medical Disclaimer

7.1 MedConnect is not a substitute for professional medical advice, diagnosis, treatment, or emergency medical care.

7.2 Users should always consult qualified healthcare professionals regarding medical concerns.

7.3 Reliance on information obtained through the platform is at the user's own discretion and responsibility.

---

8. Changes to Terms

8.1 MedConnect reserves the right to modify these Terms and Conditions at any time.

8.2 Updated terms will be posted within the platform, and continued use of MedConnect constitutes acceptance of any revisions.

---

9. Contact Information

For questions, concerns, or privacy-related requests, users may contact:
Email: privacy@medconnect-112605.me

By creating an account and using MedConnect, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.`;

const PRIVACY_TEXT = `Privacy Policy

Last updated: June 2026

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
    const { email, step, signupMethod, mockCode, setEmail, reset } = useSignUpStore();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [signupMode, setSignupMode] = useState("email"); // "email" | "phone"
    const [phoneDigits, setPhoneDigits] = useState("");    // 10 digits after +63
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsPopup, setShowTermsPopup] = useState(false);

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [codeError, setCodeError] = useState("");
    const [codeInvalid, setCodeInvalid] = useState(false);
    const [resendMessage, setResendMessage] = useState("");
    const codeRefs = useRef([]);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const termsCheckboxRef = useRef(null);
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

        if (!termsAccepted) {
            termsCheckboxRef.current?.setCustomValidity("Please accept the Terms of Service and Privacy Policy.");
            termsCheckboxRef.current?.reportValidity();
            return;
        }

        if (signupMode === "phone") {
            if (phoneDigits.length !== 10) {
                emailRef.current?.setCustomValidity("Enter your 10-digit mobile number after +63");
                emailRef.current?.reportValidity();
                return;
            }
            const pwMsg = getPasswordValidity(formData.password);
            if (pwMsg) { passwordRef.current?.setCustomValidity(pwMsg); passwordRef.current?.reportValidity(); return; }
            signupMutation(
                { phone: `+63${phoneDigits}`, password: formData.password },
                { onError: (err) => toast.error(err?.response?.data?.message || "Something went wrong.") }
            );
            return;
        }

        // Email mode
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

        const pwMsg = getPasswordValidity(formData.password);
        if (pwMsg) { passwordRef.current?.setCustomValidity(pwMsg); passwordRef.current?.reportValidity(); return; }

        const payload = { email: formData.email, password: formData.password };

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
        const payload = signupMethod === "phone" ? { phone: email, code: fullCode } : { email, code: fullCode };
        verifyMutation(payload, {
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
        const payload = signupMethod === "phone" ? { phone: email } : { email };
        resendMutation(payload, {
            onSuccess: (data) => {
                setResendMessage(signupMethod === "phone" ? "A new code has been generated." : "A new code has been sent to your email.");
                setResendCooldown(60);
                setCode(["", "", "", "", "", ""]);
                setCodeInvalid(false);
                setCodeError("");
                // Update mockCode if phone signup returned a new one
                if (data?.data?.mockCode) {
                    const { setMockCode } = useSignUpStore.getState();
                    setMockCode(data.data.mockCode);
                }
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

                                    {/* EMAIL / PHONE TOGGLE */}
                                    <div className="form-control w-full">
                                        {signupMode === "email" ? (
                                            <>
                                                <label className="label"><span className="label-text">Email</span></label>
                                                <input
                                                    ref={emailRef}
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="john@gmail.com"
                                                    className="input input-bordered w-full"
                                                    value={formData.email}
                                                    required
                                                    onChange={(e) => { setFormData({ ...formData, email: e.target.value }); e.target.setCustomValidity(""); }}
                                                    onBlur={(e) => {
                                                        const val = e.target.value;
                                                        if (!val) e.target.setCustomValidity("Email is required");
                                                        else if (!EMAIL_REGEX.test(val)) e.target.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
                                                        else e.target.setCustomValidity("");
                                                    }}
                                                />
                                                <button type="button" className="text-xs text-primary hover:underline text-left mt-1 w-fit" onClick={() => { setSignupMode("phone"); setFormData({ ...formData, email: "" }); emailRef.current?.setCustomValidity(""); }}>
                                                    Signup using mobile number
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <label className="label"><span className="label-text">Mobile Number</span></label>
                                                <div className="flex">
                                                    <span className="input input-bordered rounded-r-none flex items-center px-3 bg-base-200 text-sm font-mono select-none border-r-0">+63</span>
                                                    <input
                                                        ref={emailRef}
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={12}
                                                        placeholder="917 123 4567"
                                                        className="input input-bordered rounded-l-none flex-1 w-0"
                                                        value={phoneDigits.replace(/^(\d{3})(\d{3})(\d{0,4})$/, (_, a, b, c) => c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a)}
                                                        required
                                                        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); setPhoneDigits(d); e.target.setCustomValidity(""); }}
                                                        onBlur={(e) => {
                                                            const raw = e.target.value.replace(/\D/g, "");
                                                            if (!raw) e.target.setCustomValidity("Mobile number is required");
                                                            else if (raw.length !== 10) e.target.setCustomValidity("Enter 10 digits after +63");
                                                            else e.target.setCustomValidity("");
                                                        }}
                                                    />
                                                </div>
                                                <button type="button" className="text-xs text-primary hover:underline text-left mt-1 w-fit" onClick={() => { setSignupMode("email"); setPhoneDigits(""); emailRef.current?.setCustomValidity(""); }}>
                                                    Signup using email
                                                </button>
                                            </>
                                        )}
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

            {/* VERIFY POPUP */}
            {step === "verify" && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-base-100 rounded-xl shadow-xl p-8 w-full max-w-md">
                        <div className="text-center mb-6">
                            <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                            <h2 className="text-xl font-bold">{signupMethod === "phone" ? "Verify Your Phone" : "Verify Your Email"}</h2>
                            {signupMethod === "phone" ? (
                                <p className="text-sm opacity-70 mt-1">Enter the code below to confirm your mobile number.</p>
                            ) : (
                                <p className="text-sm opacity-70 mt-1">We sent a 6-digit code to <span className="font-medium text-primary">{email}</span></p>
                            )}
                        </div>

                        {/* Demo mock code banner for phone signup */}
                        {signupMethod === "phone" && mockCode && (
                            <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm mb-4">
                                <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                                <p className="text-xs opacity-80">
                                    <strong>⚠ Demo mode</strong> — No SMS sent. Your code: <strong className="font-mono text-base">{mockCode}</strong>
                                </p>
                            </div>
                        )}


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
                                {isVerifying ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : signupMethod === "phone" ? "Verify Phone" : "Verify Email"}
                            </button>

                            <div className="text-center space-y-1">
                                <p className="text-sm text-base-content/70">
                                    {signupMethod === "phone" ? "Need a new code?" : "Did not receive an email?"}{" "}
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