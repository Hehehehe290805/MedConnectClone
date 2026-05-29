import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepHeader, ImageUploadField, PhoneField } from "./OnboardingShared";

const OnboardingAdmin = ({ email, role, onBack, onSuccess }) => {
    const queryClient = useQueryClient();
    const [uploadingFields, setUploadingFields] = useState({});
    const [errors, setErrors] = useState({});

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
            if (data?.errors && Array.isArray(data.errors)) {
                const mapped = {};
                data.errors.forEach((e) => { mapped[e.field] = e.message; });
                setErrors(mapped);
                toast.error("Please fix the errors below.");
            } else {
                toast.error(data?.message || "Onboarding failed.");
            }
        },
    });

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.firstName.trim()) e.firstName = "First name is required";
        if (!form.lastName.trim()) e.lastName = "Last name is required";
        if (!form.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
        if (form.phoneNumber.length !== 10) e.phoneNumber = "Phone number must be 10 digits";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        mutate({ ...form, role: "admin" });
    };

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
                <form onSubmit={handleSubmit} className="space-y-4">
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
                            <input type="text" className={`input input-bordered w-full ${errors.firstName ? "input-error" : ""}`} placeholder="Ana" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                            {errors.firstName && <p className="text-error text-xs mt-1">{errors.firstName}</p>}
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                            <input type="text" className={`input input-bordered w-full ${errors.lastName ? "input-error" : ""}`} placeholder="Gonzales" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                            {errors.lastName && <p className="text-error text-xs mt-1">{errors.lastName}</p>}
                        </div>
                    </div>
                    <PhoneField
                        phoneNumber={form.phoneNumber}
                        phoneType={form.phoneType}
                        onNumberChange={(val) => update("phoneNumber", val)}
                        onTypeChange={(val) => update("phoneType", val)}
                        error={errors.phoneNumber}
                    />
                    <button className="btn btn-primary w-full" type="submit" disabled={isPending || isAnyUploading}>
                        {isPending ? <><span className="loading loading-spinner loading-xs" />Submitting</>
                            : isAnyUploading ? <><span className="loading loading-spinner loading-xs" />Uploading...</>
                                : "Submit for Approval"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default OnboardingAdmin;