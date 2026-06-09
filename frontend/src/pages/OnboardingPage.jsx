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
import useAuthUser from "../hooks/useAuthUser";
import useLogout from "../hooks/useLogout";
import OnboardingPatient from "./OnboardingPatient";
import OnboardingDoctor from "./OnboardingDoctor";
import OnboardingPharmacy from "./OnboardingPharmacy";
import OnboardingInstitute from "./OnboardingInstitute";
import OnboardingAdmin from "./OnboardingAdmin";
const ROLES = [
    { key: "patient", label: "Patient", icon: UserIcon },
    { key: "doctor", label: "Doctor", icon: StethoscopeIcon },
    { key: "pharmacy", label: "Pharmacy", icon: PillIcon },
    { key: "institute", label: "Institute", icon: BuildingIcon },
    { key: "admin", label: "Admin", icon: ShieldIcon },
];

const OnboardingPage = () => {
    const { authUser } = useAuthUser();
    const { logoutMutation } = useLogout();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedRole, setSelectedRole] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleRoleSelect = (role) => {
        setSelectedRole(role.key);
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
        queryClient.invalidateQueries({ queryKey: ["authUser"] });
        setShowSuccess(true);
    };

    const handleLogin = () => {
        logoutMutation(undefined, {
            onSuccess: () => navigate("/login"),
        });
    };

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
                                        <Icon className="size-8 text-primary" />
                                        <span className="font-semibold text-base-content">
                                            {role.label}
                                        </span>
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
        signupMethod: authUser?.signupMethod ?? "email",
        phoneNumber: authUser?.phoneNumber,
        role: selectedRole,
        onBack: () => setSelectedRole(null),
        onSuccess: handleOnboardingSuccess,
    };

    return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
            {selectedRole === "patient" && <OnboardingPatient {...onboardingProps} />}
            {selectedRole === "doctor" && <OnboardingDoctor {...onboardingProps} />}
            {selectedRole === "pharmacy" && <OnboardingPharmacy {...onboardingProps} />}
            {selectedRole === "institute" && <OnboardingInstitute {...onboardingProps} />}
            {selectedRole === "admin" && <OnboardingAdmin {...onboardingProps} />}
        </div>
    );
};

export default OnboardingPage;