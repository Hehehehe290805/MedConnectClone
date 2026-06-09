import { useState, useRef, useEffect } from "react";
import { BriefcaseMedicalIcon, UserIcon, ShieldIcon, MailIcon, SmartphoneIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { lookupForgotPasswordAccount, forgotPassword } from "../lib/api";
import { useForgotPasswordStore } from "../store/useForgotPasswordStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { setEmail, setMockCode, setRecoveryMethod, reset } = useForgotPasswordStore();

    const [role, setRole] = useState(null); // null | "user" | "admin"
    const [step, setStep] = useState("identify"); // "identify" | "choose_channel"
    const [inputMode, setInputMode] = useState("email"); // "email" | "phone"
    const [identifier, setIdentifier] = useState("");
    const [phoneDigits, setPhoneDigits] = useState("");
    const [adminCode, setAdminCode] = useState("");
    const [notFoundError, setNotFoundError] = useState(false);
    const [availableChannels, setAvailableChannels] = useState([]);

    const inputRef = useRef(null);

    useEffect(() => { reset(); }, []);

    const isAdmin = role === "admin";

    const resolvedIdentifier = inputMode === "phone" ? `+63${phoneDigits}` : identifier;

    const { mutate: lookup, isPending: isLooking } = useMutation({
        mutationFn: lookupForgotPasswordAccount,
        onSuccess: (data) => {
            setAvailableChannels(data?.data?.channels ?? ["email"]);
            setStep("choose_channel");
        },
        onError: (err) => {
            if (err?.response?.status === 404) {
                setNotFoundError(true);
            }
        },
    });

    const { mutate: sendCode, isPending: isSending } = useMutation({
        mutationFn: forgotPassword,
        onSuccess: (data) => {
            setEmail(resolvedIdentifier);
            setRecoveryMethod("email");
            if (data?.data?.mockCode) {
                setMockCode(data.data.mockCode);
                setRecoveryMethod("phone");
            }
            navigate("/forgot-password/verify");
        },
    });

    const handleIdentifySubmit = (e) => {
        e.preventDefault();
        setNotFoundError(false);

        if (inputMode === "phone") {
            if (phoneDigits.length !== 10) {
                inputRef.current?.setCustomValidity("Enter 10 digits after +63");
                inputRef.current?.reportValidity();
                return;
            }
            const payload = { email: `+63${phoneDigits}` };
            if (isAdmin && adminCode.trim()) payload.adminCode = adminCode.trim();
            lookup(payload);
            return;
        }

        if (!EMAIL_REGEX.test(identifier)) {
            inputRef.current?.setCustomValidity("Please enter a valid email address");
            inputRef.current?.reportValidity();
            return;
        }

        const payload = { email: identifier };
        if (isAdmin && adminCode.trim()) payload.adminCode = adminCode.trim();
        lookup(payload);
    };

    const handleChannelSelect = (channel) => {
        const payload = { email: resolvedIdentifier, channel };
        if (isAdmin && adminCode.trim()) payload.adminCode = adminCode.trim();
        sendCode(payload);
    };

    const switchMode = (mode) => {
        setInputMode(mode);
        setIdentifier("");
        setPhoneDigits("");
        setNotFoundError(false);
        inputRef.current?.setCustomValidity("");
    };

    const handleRetry = () => {
        setNotFoundError(false);
        setStep("identify");
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" data-theme="light">

            {/* Role picker */}
            {!role && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6">
                        <div className="text-center">
                            <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                            <h2 className="text-xl font-bold">Account Recovery</h2>
                            <p className="text-sm opacity-60 mt-1">Select your account type to continue.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button className="btn btn-outline btn-primary flex-col gap-2 h-auto py-5" onClick={() => setRole("user")}>
                                <UserIcon className="size-6" />
                                <span>User</span>
                            </button>
                            <button className="btn btn-outline btn-primary flex-col gap-2 h-auto py-5" onClick={() => setRole("admin")}>
                                <ShieldIcon className="size-6" />
                                <span>Admin</span>
                            </button>
                        </div>
                        <div className="text-center">
                            <Link to="/login" className="text-sm text-primary hover:underline">← Back to Login</Link>
                        </div>
                    </div>
                </div>
            )}

            <div className={`card bg-base-100 shadow-xl w-full max-w-md border border-primary/25 transition-opacity ${role ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="card-body p-8 space-y-5">
                    <div className="text-center">
                        <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                        <h1 className="text-2xl font-bold">Forgot Password</h1>
                        <p className="text-sm opacity-70 mt-1">
                            {step === "choose_channel"
                                ? "How would you like to receive your reset code?"
                                : isAdmin
                                    ? "Admin account recovery."
                                    : "Enter your registered email or phone number."}
                        </p>
                    </div>

                    {/* Step: identify */}
                    {step === "identify" && (
                        <form onSubmit={handleIdentifySubmit} className="space-y-4">

                            {/* Email / Phone toggle — user only */}
                            {!isAdmin && (
                                <div className="form-control">
                                    {inputMode === "email" ? (
                                        <>
                                            <label className="label"><span className="label-text">Email</span></label>
                                            <input
                                                ref={inputRef}
                                                type="email"
                                                className="input input-bordered w-full"
                                                placeholder="you@example.com"
                                                value={identifier}
                                                required
                                                onChange={(e) => { setIdentifier(e.target.value); setNotFoundError(false); e.target.setCustomValidity(""); }}
                                                onBlur={(e) => {
                                                    if (!e.target.value) e.target.setCustomValidity("Email is required");
                                                    else if (!EMAIL_REGEX.test(e.target.value)) e.target.setCustomValidity("Please enter a valid email address");
                                                    else e.target.setCustomValidity("");
                                                }}
                                            />
                                            <button type="button" className="text-xs text-primary hover:underline text-left mt-1 w-fit" onClick={() => switchMode("phone")}>
                                                Use phone number instead
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <label className="label"><span className="label-text">Phone Number</span></label>
                                            <div className="flex">
                                                <span className="input input-bordered rounded-r-none flex items-center px-3 bg-base-200 text-sm font-mono select-none border-r-0">+63</span>
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={12}
                                                    placeholder="917 123 4567"
                                                    className="input input-bordered rounded-l-none flex-1 w-0"
                                                    value={phoneDigits.replace(/^(\d{3})(\d{3})(\d{0,4})$/, (_, a, b, c) => c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a)}
                                                    required
                                                    onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); setPhoneDigits(d); setNotFoundError(false); e.target.setCustomValidity(""); }}
                                                    onBlur={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, "");
                                                        if (!raw) e.target.setCustomValidity("Phone number is required");
                                                        else if (raw.length !== 10) e.target.setCustomValidity("Enter 10 digits after +63");
                                                        else e.target.setCustomValidity("");
                                                    }}
                                                />
                                            </div>
                                            <button type="button" className="text-xs text-primary hover:underline text-left mt-1 w-fit" onClick={() => switchMode("email")}>
                                                Use email instead
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Admin: email only */}
                            {isAdmin && (
                                <>
                                    <div className="form-control">
                                        <label className="label"><span className="label-text">Email</span></label>
                                        <input
                                            ref={inputRef}
                                            type="email"
                                            className="input input-bordered w-full"
                                            placeholder="admin@example.com"
                                            value={identifier}
                                            required
                                            onChange={(e) => { setIdentifier(e.target.value); setNotFoundError(false); e.target.setCustomValidity(""); }}
                                        />
                                    </div>
                                    <div className="form-control">
                                        <label className="label"><span className="label-text">Admin Code</span></label>
                                        <input
                                            type="text"
                                            className="input input-bordered w-full"
                                            placeholder="Enter your admin code"
                                            value={adminCode}
                                            onChange={(e) => setAdminCode(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Account not found error */}
                            {notFoundError && (
                                <div className="bg-error/10 border border-error/30 rounded-lg p-4 space-y-3">
                                    <p className="text-error text-sm font-medium">
                                        No account found with that {inputMode === "phone" ? "phone number" : "email address"}.
                                    </p>
                                    <p className="text-sm opacity-60">
                                        Double-check and try again, or contact support if you believe this is an error.
                                    </p>
                                    <button type="button" className="btn btn-sm btn-outline btn-error w-full" onClick={handleRetry}>
                                        ← Try a different {inputMode === "phone" ? "phone number" : "email"}
                                    </button>
                                </div>
                            )}

                            {!notFoundError && (
                                <button type="submit" className="btn btn-primary w-full" disabled={isLooking}>
                                    {isLooking ? <><span className="loading loading-spinner loading-xs" />Checking...</> : "Continue"}
                                </button>
                            )}
                        </form>
                    )}

                    {/* Step: choose channel */}
                    {step === "choose_channel" && (
                        <div className="space-y-3">
                            {availableChannels.includes("email") && (
                                <button
                                    className="btn btn-outline btn-primary w-full justify-start gap-3"
                                    onClick={() => handleChannelSelect("email")}
                                    disabled={isSending}
                                >
                                    <MailIcon className="size-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Send to Email</p>
                                        <p className="text-xs opacity-60 font-normal">We'll send a 6-digit code to your registered email.</p>
                                    </div>
                                </button>
                            )}
                            {availableChannels.includes("phone") && (
                                <button
                                    className="btn btn-outline btn-primary w-full justify-start gap-3"
                                    onClick={() => handleChannelSelect("phone")}
                                    disabled={isSending}
                                >
                                    <SmartphoneIcon className="size-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Send to Phone</p>
                                        <p className="text-xs opacity-60 font-normal">We'll send a 6-digit code to your verified phone number.</p>
                                    </div>
                                </button>
                            )}
                            {isSending && (
                                <p className="text-center text-sm opacity-60 flex items-center justify-center gap-2">
                                    <span className="loading loading-spinner loading-xs" />Sending your code...
                                </p>
                            )}
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm w-full mt-1"
                                onClick={() => setStep("identify")}
                                disabled={isSending}
                            >
                                ← Use a different email or phone
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm pt-1">
                        <button className="text-base-content opacity-50 hover:opacity-80 transition-opacity" onClick={() => { setRole(null); setStep("identify"); setNotFoundError(false); }}>
                            ← Change account type
                        </button>
                        <Link to="/login" className="text-primary hover:underline">Back to Login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
