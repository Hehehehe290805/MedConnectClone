import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepHeader, ImageUploadField, PhoneField } from "./OnboardingShared";

const OnboardingAdmin = ({ email, role, onBack, onSuccess }) => {
    const queryClient = useQueryClient();
    const [uploadingFields, setUploadingFields] = useState({});

    const [form, setForm] = useState({
        profilePic: { url: "", key: "" },
        firstName: "",
        lastName: "",
        phoneNumber: "",
        phoneType: "mobile",
    });

    const isAnyUploading = Object.values(uploadingFields).some(Boolean);
    const setUploading = (field, val) =>
        setUploadingFields((prev) => ({ ...prev, [field]: val }));

    const { mutate, isPending } = useMutation({
        mutationFn: completeOnboarding,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["authUser"] });
            onSuccess();
        },
        onError: (err) => {
            const data = err?.response?.data;
            toast.error(data?.message || "Onboarding failed.");
        },
    });

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const formComplete =
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.phoneNumber.length === 10;

    return (
        <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
            <div className="card-body p-6 sm:p-8">
                <StepHeader
                    title="Admin Profile"
                    subtitle="Complete your admin profile"
                    role={role}
                    email={email}
                    onBack={onBack}
                    isFirstStep={true}
                />
                <form onSubmit={(e) => { e.preventDefault(); mutate({ ...form, role: "admin" }); }} className="space-y-4">
                    <ImageUploadField
                        label="Profile Picture"
                        field="profilePic"
                        value={form.profilePic}
                        onChange={(val) => update("profilePic", val)}
                        onUploadingChange={(v) => setUploading("profilePic", v)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text">First Name <span className="text-error">*</span></span></label>
                            <input type="text" className="input input-bordered w-full" placeholder="Ana" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                            <input type="text" className="input input-bordered w-full" placeholder="Gonzales" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                        </div>
                    </div>
                    <PhoneField
                        phoneNumber={form.phoneNumber}
                        phoneType={form.phoneType}
                        onNumberChange={(val) => update("phoneNumber", val)}
                        onTypeChange={(val) => update("phoneType", val)}
                    />
                    <button className="btn btn-primary w-full" type="submit" disabled={isPending || isAnyUploading || !formComplete}>
                        {isPending ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit for Approval"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default OnboardingAdmin;