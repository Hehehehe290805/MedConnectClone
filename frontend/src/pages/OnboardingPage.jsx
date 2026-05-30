import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
    BriefcaseMedicalIcon,
    UserIcon,
    StethoscopeIcon,
    BuildingIcon,
    ShieldIcon,
    PillIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import OnboardingPatient from "./OnboardingPatient";
import OnboardingDoctor from "./OnboardingDoctor";
import OnboardingPharmacy from "./OnboardingPharmacy";
import OnboardingAdmin from "./OnboardingAdmin";

const ROLES = [
    { key: "patient", label: "Patient", icon: UserIcon, enabled: true },
    { key: "doctor", label: "Doctor", icon: StethoscopeIcon, enabled: true },
    { key: "pharmacy", label: "Pharmacy", icon: PillIcon, enabled: true },
    { key: "institute", label: "Institute", icon: BuildingIcon, enabled: false },
    { key: "admin", label: "Admin", icon: ShieldIcon, enabled: true },
];

const OnboardingPage = () => {
    const { authUser } = useAuthUser();
    const { logoutMutation } = useLogout();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedRole, setSelectedRole] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // admin code conversion state
    const [showAdminCode, setShowAdminCode] = useState(false);
    const [adminCode, setAdminCode] = useState("");
    const [adminCodeError, setAdminCodeError] = useState("");
    const [adminCodeLoading, setAdminCodeLoading] = useState(false);

    const handleRoleSelect = (role) => {
        if (!role.enabled) {
            navigate("/coming-soon");
            return;
        }
        if (role.key === "admin") {
            setShowAdminCode(true);
            return;
        }
        setSelectedRole(role.key);
    };

    const handleAdminCodeSubmit = async (e) => {
        e.preventDefault();
        if (!adminCode.trim()) { setAdminCodeError("Admin code is required."); return; }
        setAdminCodeLoading(true);
        setAdminCodeError("");
        try {
            await axiosInstance.post("/onboarding/admin/convert", { adminCode });
            // refetch authUser so protectRoute sees Admin doc
            await queryClient.invalidateQueries({ queryKey: ["authUser"] });
            setShowAdminCode(false);
            setSelectedRole("admin");
        } catch (err) {
            setAdminCodeError(err?.response?.data?.message || "Invalid admin code.");
        } finally {
            setAdminCodeLoading(false);
        }
    };

    const handleOnboardingSuccess = () => {
        // optimistically update authUser status to prevent flash
        queryClient.setQueryData(["authUser"], (old) => {
            if (!old?.data) return old;
            return {
                ...old,
                data: {
                    ...old.data,
                    status: selectedRole === "patient" ? "onBoarded" : "pending",
                    role: selectedRole,
                },
            };
        });
        setShowSuccess(true);
    };

    const handleLogin = () => {
        logoutMutation(undefined, {
            onSuccess: () => navigate("/login"),
        });
    };

    // --- ADMIN CODE POPUP ---
    if (showAdminCode) {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4" data-theme="light">
                <div className="card bg-base-200 w-full max-w-md shadow-xl">
                    <div className="card-body p-8">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldIcon className="size-6 text-primary" />
                            <h2 className="text-xl font-bold">Admin Verification</h2>
                        </div>
                        <p className="text-sm opacity-70 mb-4">
                            Enter your admin code to register as an administrator.
                        </p>
                        <form onSubmit={handleAdminCodeSubmit} className="space-y-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Admin Code <span className="text-error">*</span></span></label>
                                <input
                                    type="password"
                                    className={`input input-bordered w-full ${adminCodeError ? "input-error" : ""}`}
                                    placeholder="Enter admin code"
                                    value={adminCode}
                                    onChange={(e) => { setAdminCode(e.target.value); setAdminCodeError(""); }}
                                    autoFocus
                                />
                                {adminCodeError && <p className="text-error text-xs mt-1">{adminCodeError}</p>}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline flex-1"
                                    onClick={() => { setShowAdminCode(false); setAdminCode(""); setAdminCodeError(""); }}
                                >
                                    Back
                                </button>
                                <button className="btn btn-primary flex-1" type="submit" disabled={adminCodeLoading}>
                                    {adminCodeLoading ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : "Continue"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // --- SUCCESS POPUP ---
    if (showSuccess) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-base-100 rounded-xl shadow-xl p-8 w-full max-w-md text-center">
                    <div className="size-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BriefcaseMedicalIcon className="size-8 text-success" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
                    <p className="text-sm opacity-70 mb-6">
                        {selectedRole === "patient"
                            ? "Your account is ready. Please log in to get started."
                            : "Your application has been submitted and is pending approval. Please log in to check your status."}
                    </p>
                    <button className="btn btn-primary w-full" onClick={handleLogin}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    // --- ROLE SELECT ---
    if (!selectedRole) {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
                    <div className="card-body p-8">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <BriefcaseMedicalIcon className="size-8 text-primary" />
                            <span className="text-primary text-2xl font-bold font-mono tracking-wider">MedConnect</span>
                        </div>
                        <h1 className="text-2xl font-bold text-center mb-1">You are signing up as a</h1>
                        <p className="text-center text-sm opacity-70 mb-6">Select your role to continue</p>

                        <div className="grid grid-cols-2 gap-4 mb-2">
                            {ROLES.slice(0, 4).map((role) => {
                                const Icon = role.icon;
                                return (
                                    <button
                                        key={role.key}
                                        onClick={() => handleRoleSelect(role)}
                                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-base-300 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                                    >
                                        <Icon className={`size-8 ${role.enabled ? "text-primary" : "text-base-content/40"}`} />
                                        <span className={`font-semibold ${role.enabled ? "text-base-content" : "text-base-content/40"}`}>
                                            {role.label}
                                        </span>
                                        {!role.enabled && <span className="text-xs opacity-50">Coming soon</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex justify-center">
                            {ROLES.slice(4).map((role) => {
                                const Icon = role.icon;
                                return (
                                    <button
                                        key={role.key}
                                        onClick={() => handleRoleSelect(role)}
                                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-base-300 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all w-1/2"
                                    >
                                        <Icon className="size-8 text-primary" />
                                        <span className="font-semibold text-base-content">{role.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- ROLE-SPECIFIC ONBOARDING ---
    const onboardingProps = {
        email: authUser?.email,
        role: selectedRole,
        onBack: () => setSelectedRole(null),
        onSuccess: handleOnboardingSuccess,
    };

    return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
            {selectedRole === "patient" && <OnboardingPatient {...onboardingProps} />}
            {selectedRole === "doctor" && <OnboardingDoctor {...onboardingProps} />}
            {selectedRole === "pharmacy" && <OnboardingPharmacy {...onboardingProps} />}
            {selectedRole === "admin" && <OnboardingAdmin {...onboardingProps} />}
        </div>
    );
};

export default OnboardingPage;