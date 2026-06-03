import { useState, useRef, useEffect } from "react";
import { BriefcaseMedicalIcon } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { resetForgotPassword } from "../lib/api";
import { useForgotPasswordStore } from "../store/useForgotPasswordStore";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

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

const ForgotPasswordResetPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { email, code: storeCode, reset } = useForgotPasswordStore();
    const code = location.state?.code || storeCode;

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const newPasswordRef = useRef(null);
    const confirmPasswordRef = useRef(null);

    // guard: if no email/code, redirect to step 1
    useEffect(() => {
        if (!email || !code) navigate("/forgot-password", { replace: true });
    }, [email, code, navigate]);

    const { mutate, isPending } = useMutation({
        mutationFn: resetForgotPassword,
        onSuccess: () => {
            reset();
            toast.success("Password updated successfully.");
            navigate("/login");
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || "Failed to reset password.");
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const pwMsg = getPasswordValidity(newPassword);
        if (pwMsg) {
            newPasswordRef.current?.setCustomValidity(pwMsg);
            newPasswordRef.current?.reportValidity();
            return;
        }

        if (newPassword !== confirmPassword) {
            confirmPasswordRef.current?.setCustomValidity("Passwords do not match");
            confirmPasswordRef.current?.reportValidity();
            return;
        }

        mutate({ email, code, newPassword });
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" data-theme="light">
            <div className="card bg-base-100 shadow-xl w-full max-w-md border border-primary/25">
                <div className="card-body p-8 space-y-6">
                    <div className="text-center">
                        <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                        <h1 className="text-2xl font-bold">Set New Password</h1>
                        <p className="text-sm opacity-70 mt-1">Enter your new password below.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text">New Password</span></label>
                            <input
                                ref={newPasswordRef}
                                type="password"
                                className="input input-bordered w-full"
                                placeholder="••••••••"
                                value={newPassword}
                                required
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    e.target.setCustomValidity("");
                                    confirmPasswordRef.current?.setCustomValidity("");
                                }}
                                onBlur={(e) => {
                                    const msg = getPasswordValidity(e.target.value);
                                    e.target.setCustomValidity(msg);
                                }}
                            />
                            {!newPassword && (
                                <p className="text-xs opacity-70 mt-1">
                                    Must be 8+ characters with uppercase, lowercase, number, and symbol
                                </p>
                            )}
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Confirm New Password</span></label>
                            <input
                                ref={confirmPasswordRef}
                                type="password"
                                className="input input-bordered w-full"
                                placeholder="••••••••"
                                value={confirmPassword}
                                required
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    e.target.setCustomValidity("");
                                }}
                                onBlur={(e) => {
                                    if (e.target.value && e.target.value !== newPassword) {
                                        e.target.setCustomValidity("Passwords do not match");
                                    } else {
                                        e.target.setCustomValidity("");
                                    }
                                }}
                            />
                        </div>

                        <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                            {isPending ? <><span className="loading loading-spinner loading-xs" />Updating...</> : "Update Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordResetPage;
