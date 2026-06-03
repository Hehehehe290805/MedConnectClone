import { useState, useRef, useEffect } from "react";
import { BriefcaseMedicalIcon, UserIcon, ShieldIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { forgotPassword } from "../lib/api";
import { useForgotPasswordStore } from "../store/useForgotPasswordStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const { setEmail, reset } = useForgotPasswordStore();
    const [email, setLocalEmail] = useState("");
    const [adminCode, setAdminCode] = useState("");
    const emailRef = useRef(null);

    // Role picker modal — shown on page load
    const [role, setRole] = useState(null); // null | "user" | "admin"
    const isAdminMode = role === "admin";

    useEffect(() => { reset(); }, []);

    const { mutate, isPending } = useMutation({
        mutationFn: forgotPassword,
        onSuccess: () => {
            setEmail(email);
            navigate("/forgot-password/verify");
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || "Something went wrong.");
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!EMAIL_REGEX.test(email)) {
            emailRef.current?.setCustomValidity("Please enter a valid email address (e.g. name@example.com)");
            emailRef.current?.reportValidity();
            return;
        }
        const payload = { email };
        if (isAdminMode && adminCode.trim()) payload.adminCode = adminCode.trim();
        mutate(payload);
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" data-theme="light">

            {/* Role picker modal — shown until user selects */}
            {!role && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-base-100 rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-6">
                        <div className="text-center">
                            <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                            <h2 className="text-xl font-bold">Who are you?</h2>
                            <p className="text-sm opacity-60 mt-1">Select your account type to continue.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className="btn btn-outline btn-primary flex-col gap-2 h-auto py-5"
                                onClick={() => setRole("user")}
                            >
                                <UserIcon className="size-6" />
                                <span>User</span>
                            </button>
                            <button
                                className="btn btn-outline btn-primary flex-col gap-2 h-auto py-5"
                                onClick={() => setRole("admin")}
                            >
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

            {/* Forgot password form — visible behind the modal, shown fully after role selected */}
            <div className={`card bg-base-100 shadow-xl w-full max-w-md border border-primary/25 transition-opacity ${role ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                <div className="card-body p-8 space-y-6">
                    <div className="text-center">
                        <BriefcaseMedicalIcon className="size-10 text-primary mx-auto mb-3" />
                        <h1 className="text-2xl font-bold">Forgot Password</h1>
                        <p className="text-sm opacity-70 mt-1">
                            {isAdminMode ? "Admin account recovery." : "Enter your email and we'll send you a verification code."}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Email</span></label>
                            <input
                                ref={emailRef}
                                type="email"
                                className="input input-bordered w-full"
                                placeholder="you@example.com"
                                value={email}
                                required
                                onChange={(e) => {
                                    setLocalEmail(e.target.value);
                                    e.target.setCustomValidity("");
                                }}
                                onBlur={(e) => {
                                    if (!e.target.value) e.target.setCustomValidity("Email is required");
                                    else if (!EMAIL_REGEX.test(e.target.value)) e.target.setCustomValidity("Please enter a valid email address.");
                                    else e.target.setCustomValidity("");
                                }}
                            />
                        </div>

                        {isAdminMode && (
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
                        )}

                        <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                            {isPending ? <><span className="loading loading-spinner loading-xs" />Sending...</> : "Send Code"}
                        </button>
                    </form>

                    <div className="flex items-center justify-between text-sm">
                        <button
                            className="text-base-content opacity-50 hover:opacity-80 transition-opacity"
                            onClick={() => setRole(null)}
                        >
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
