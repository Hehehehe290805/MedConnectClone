import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding, convertToAdmin } from "../lib/api";
import { StepHeader, ImageUploadField, PhoneField, uploadPendingImages } from "./OnboardingShared";

const OnboardingAdmin = ({ email, role, onBack, onSuccess }) => {
    const queryClient = useQueryClient();
    const [uploadingFields, setUploadingFields] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [adminCodeError, setAdminCodeError] = useState("");
    const [phoneVerified, setPhoneVerified] = useState(false);

    const [form, setForm] = useState({
        adminCode: "",
        profilePic: {},
        firstName: "",
        lastName: "",
        phoneNumber: "",
        phoneType: "mobile",
    });

    const isAnyUploading = Object.values(uploadingFields).some(Boolean);
    const setUploading = (field, val) => setUploadingFields((prev) => ({ ...prev, [field]: val }));

    const { mutate, isPending } = useMutation({
        mutationFn: completeOnboarding,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["authUser"] }); onSuccess(); },
        onError: (err) => { toast.error(err?.response?.data?.message || "Onboarding failed."); setIsSubmitting(false); },
    });

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (field === "adminCode") setAdminCodeError("");
    };

    const formComplete =
        form.adminCode.trim() &&
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.phoneNumber.length === 10 &&
        phoneVerified;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formComplete) return;

        if (!form.adminCode.trim()) {
            setAdminCodeError("Admin code is required.");
            return;
        }

        setIsSubmitting(true);

        let finalForm = form;
        if (form.profilePic.file) {
            try { finalForm = await uploadPendingImages(form, ["profilePic"]); }
            catch { setIsSubmitting(false); return; }
        }

        try {
            await convertToAdmin({ adminCode: form.adminCode });
            await queryClient.invalidateQueries({ queryKey: ["authUser"] });
        } catch (err) {
            setAdminCodeError(err?.response?.data?.message || "Invalid admin code.");
            setIsSubmitting(false);
            return;
        }

        mutate({ ...finalForm, role: "admin" });
    };

    return (
        <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
            <div className="card-body p-6 sm:p-8">
                <StepHeader title="Admin Profile" subtitle="Complete your admin profile" role={role} email={email} onBack={onBack} isFirstStep={true} />
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label"><span className="label-text">Admin Code <span className="text-error">*</span></span></label>
                        <input
                            type="text"
                            className={`input input-bordered w-full ${adminCodeError ? "input-error" : ""}`}
                            placeholder="Enter your admin code"
                            value={form.adminCode}
                            onChange={(e) => update("adminCode", e.target.value)}
                        />
                        {adminCodeError && <p className="text-error text-xs mt-1">{adminCodeError}</p>}
                    </div>
                    <ImageUploadField label="Profile Picture" field="profilePic" value={form.profilePic} onChange={(val) => update("profilePic", val)} onUploadingChange={(v) => setUploading("profilePic", v)} />
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
                    <PhoneField phoneNumber={form.phoneNumber} phoneType={form.phoneType} onNumberChange={(val) => update("phoneNumber", val)} onTypeChange={(val) => update("phoneType", val)} onVerified={setPhoneVerified} />
                    <button className="btn btn-primary w-full" type="submit" disabled={isPending || isAnyUploading || !formComplete || isSubmitting}>
                        {isPending || isSubmitting ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit for Approval"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default OnboardingAdmin;
