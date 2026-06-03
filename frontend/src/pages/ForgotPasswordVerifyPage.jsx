import { useState, useEffect, useRef } from "react";
import { BriefcaseMedicalIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { verifyForgotPassword, forgotPassword } from "../lib/api";
import { useForgotPasswordStore } from "../store/useForgotPasswordStore";

const ForgotPasswordVerifyPage = () => {
    const navigate = useNavigate();
    const { email, setCode } = useForgotPasswordStore();

    const [code, setLocalCode] = useState(["", "", "", "", "", ""]);
    const [codeError, setCodeError] = useState("");
    const [codeInvalid, setCodeInvalid] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(60);
    const [resendMessage, setResendMessage] = useState("");
    const codeRefs = useRef([]);

    // guard: if no email in store, send back to step 1
    useEffect(() => {
        if (!email) navigate("/forgot-password", { replace: true });
    }, [email, navigate]);

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const { mutate: verifyMutate, isPending: isVerifying } = useMutation({
        mutationFn: verifyForgotPassword,
        onSuccess: () => {
            const full = code.join("");
            setCode(full);
            navigate("/forgot-password/reset", { state: { code: full } });
        },
        onError: (err) => {
            setCodeInvalid(true);
            setCodeError(err?.response?.data?.message || "Incorrect code. Please try again.");
            setLocalCode(["", "", "", "", "", ""]);
            setTimeout(() => codeRefs.current[0]?.focus(), 50);
        },
    });

    const { mutate: resendMutate, isPending: isResending } = useMutation({
        mutationFn: forgotPassword,
        onSuccess: () => {
            setResendMessage("A new code has been sent to your email.");
            setResendCooldown(60);
            setLocalCode(["", "", "", "", "", ""]);
            setCodeInvalid(false);
            setCodeError("");
            codeRefs.current[0]?.focus();
            setTimeout(() => setResendMessage(""), 5000);
        },
        onError: () => {
            setResendMessage("Failed to resend code.");
        },
    });

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...code];
        next[index] = value.slice(-1);
        setLocalCode(next);
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
        const next = [...code];
        pasted.split("").forEach((char, i) => { next[i] = char; });
        setLocalCode(next);
        codeRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleVerify = (e) => {
        e.preventDefault();
        const full = code.join("");
        if (full.length !== 6) return;
        setCodeError("");
        setCodeInvalid(false);
        verifyMutate({ email, code: full });
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" data-theme="light">
            <div className="card bg-base-100 shadow-xl w-full max-w-md border border-primary/25">
                <div className="card-body p-8">
                    <div className="text-center mb-6">
                        <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                        <h2 className="text-xl font-bold">Enter Verification Code</h2>
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
                            {codeError && <p className="text-error text-xs text-center">{codeError}</p>}
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full"
                            disabled={isVerifying || code.join("").length !== 6}
                        >
                            {isVerifying ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Verify Code"}
                        </button>

                        <div className="text-center space-y-1">
                            <p className="text-sm text-base-content/70">
                                Did not receive an email?{" "}
                                <button
                                    type="button"
                                    onClick={() => resendMutate({ email })}
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
        </div>
    );
};

export default ForgotPasswordVerifyPage;
