import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, AddressFields, PhoneField, forwardGeocode, uploadPendingImages } from "./OnboardingShared";
import { DepartmentTypeField, suggestDepartmentType } from "../components/DepartmentTypeField";
import { isValidPersonName, NAME_ERROR } from "../lib/utils";

const TOTAL_STEPS = 3;

const ExpirationField = ({ label, field, inputRef, form, update, minExpiration, minExpirationLabel }) => (
    <div className="form-control">
        <label className="label"><span className="label-text">{label} <span className="text-error">*</span></span></label>
        <input
            ref={inputRef}
            type="date"
            className="input input-bordered w-full"
            min={minExpiration}
            value={form[field]}
            onChange={(e) => {
                const val = e.target.value;
                const [year] = val.split("-");
                if (year && year.length > 4) return;
                inputRef.current?.setCustomValidity("");
                update(field, val);
            }}
            onBlur={(e) => {
                if (e.target.value && e.target.value < minExpiration) {
                    inputRef.current?.setCustomValidity(`Expiration must be ${minExpirationLabel} or later`);
                } else {
                    inputRef.current?.setCustomValidity("");
                }
            }}
        />
    </div>
);

const OnboardingInstitute = ({ email, role, onBack, onSuccess }) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [uploadingFields, setUploadingFields] = useState({});
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const cityRef = useRef(null);
    const businessPermitExpirationRef = useRef(null);
    const constructionPermitExpirationRef = useRef(null);

    const [form, setForm] = useState({
        instituteName: "",
        instituteType: "",
        bio: "",
        profilePic: {},
        contactFirstName: "",
        contactLastName: "",
        phoneNumber: "",
        phoneType: "mobile",
        address: { buildingNumber: "", street: "", barangay: "", city: "", province: "", postalCode: "", coordinates: null },
        departments: [], // [{ _id, name, status, isNew? }]
        businessPermit: {},
        businessPermitExpiration: "",
        licensingAgency: "",
        constructionPermit: {},
        constructionPermitExpiration: "",
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
        if (field === "address") cityRef.current?.setCustomValidity("");
    };

    const isHospital = form.instituteType === "hospital";
    const isClinic = form.instituteType === "clinic";

    const today = new Date();
    const minExpirationDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    const minExpiration = minExpirationDate.toISOString().split("T")[0];
    const minExpirationLabel = minExpirationDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const step1Complete =
        form.instituteName.trim() &&
        form.instituteType &&
        form.profilePic.file &&
        form.contactFirstName.trim() &&
        form.contactLastName.trim();

    const step2Complete =
        phoneVerified &&
        form.phoneNumber.length === 10 &&
        form.address.buildingNumber.trim() &&
        form.address.street.trim() &&
        form.address.barangay.trim() &&
        form.address.city.trim() &&
        form.address.province.trim() &&
        /^\d{4}$/.test(form.address.postalCode);

    const step3Complete =
        (form.businessPermit.file || form.businessPermit.key) &&
        form.businessPermitExpiration &&
        form.licensingAgency.trim() &&
        (!isHospital || ((form.constructionPermit.file || form.constructionPermit.key) && form.constructionPermitExpiration));

    const expirationProps = { form, update, minExpiration, minExpirationLabel };

    // resolve new department types to real ObjectIds on submit
    const resolveDepartmentTypes = async () => {
        const resolved = await Promise.all(
            form.departments.map(async (d) => {
                if (!d.isNew) return d._id;
                try {
                    const suggested = await suggestDepartmentType(d.name);
                    return suggested._id;
                } catch {
                    toast.error(`Department type "${d.name}" already exists or could not be submitted.`);
                    return null;
                }
            })
        );
        return resolved.filter(Boolean);
    };

    return (
        <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
            <div className="card-body p-6 sm:p-8">
                <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
                <StepHeader
                    title={step === 1 ? "Institute Information" : step === 2 ? "Contact & Location" : "Permits & Documents"}
                    subtitle={step === 1 ? "Tell us about your institute" : step === 2 ? "Where is your institute located?" : "Upload required documents"}
                    role={role} email={email}
                    onBack={step === 1 ? onBack : () => setStep(step - 1)}
                    isFirstStep={step === 1}
                />

                {/* STEP 1 */}
                {step === 1 && (
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const e2 = {};
                        if (!isValidPersonName(form.contactFirstName)) e2.contactFirstName = NAME_ERROR;
                        if (!isValidPersonName(form.contactLastName)) e2.contactLastName = NAME_ERROR;
                        setErrors(e2);
                        if (Object.keys(e2).length > 0) return;
                        setStep(2);
                    }} className="space-y-4">
                        <ImageUploadField label="Institute Profile Picture" field="profilePic" value={form.profilePic} onChange={(val) => update("profilePic", val)} onUploadingChange={(v) => setUploading("profilePic", v)} required />
                        <div className="form-control">
                            <label className="label"><span className="label-text">Institute Name <span className="text-error">*</span></span></label>
                            <input type="text" className="input input-bordered w-full" placeholder="Manila Doctors Hospital" value={form.instituteName} onChange={(e) => update("instituteName", e.target.value)} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Institute Type <span className="text-error">*</span></span></label>
                            <select className="select select-bordered w-full" value={form.instituteType} onChange={(e) => update("instituteType", e.target.value)}>
                                <option value="">Select type</option>
                                <option value="clinic">Clinic</option>
                                <option value="hospital">Hospital</option>
                            </select>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Bio</span></label>
                            <textarea className="textarea textarea-bordered h-24 resize-none" placeholder="Tell us about your institute" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
                        </div>
                        <div className="divider text-xs opacity-50">Contact Person</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">First Name <span className="text-error">*</span></span></label>
                                <input type="text" className={`input input-bordered w-full${errors.contactFirstName ? " input-error" : ""}`} placeholder="Juan" value={form.contactFirstName} onChange={(e) => { update("contactFirstName", e.target.value); setErrors((prev) => ({ ...prev, contactFirstName: undefined })); }} />
                                {errors.contactFirstName && <p className="text-error text-xs mt-1">{errors.contactFirstName}</p>}
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                                <input type="text" className={`input input-bordered w-full${errors.contactLastName ? " input-error" : ""}`} placeholder="dela Cruz" value={form.contactLastName} onChange={(e) => { update("contactLastName", e.target.value); setErrors((prev) => ({ ...prev, contactLastName: undefined })); }} />
                                {errors.contactLastName && <p className="text-error text-xs mt-1">{errors.contactLastName}</p>}
                            </div>
                        </div>
                        <button className="btn btn-primary w-full" type="submit" disabled={!step1Complete || isAnyUploading}>Next →</button>
                    </form>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const coords = form.address.coordinates;
                        let finalForm = form;
                        if (!coords) {
                            const result = await forwardGeocode(form.address);
                            if (result) { finalForm = { ...form, address: { ...form.address, coordinates: { type: "Point", coordinates: [result.lng, result.lat] } } }; }
                            else { cityRef.current?.setCustomValidity("City not found. Please check your address."); cityRef.current?.reportValidity(); return; }
                        }
                        setForm(finalForm);
                        setStep(3);
                    }} className="space-y-4">
                        <PhoneField phoneNumber={form.phoneNumber} phoneType={form.phoneType} onNumberChange={(val) => update("phoneNumber", val)} onTypeChange={(val) => update("phoneType", val)} onVerified={setPhoneVerified} />
                        <AddressFields value={form.address} onChange={(val) => update("address", val)} errors={{}} cityRef={cityRef} label="Business Address" />
                        {form.instituteType && (
                            <DepartmentTypeField
                                value={form.departments}
                                onChange={(val) => update("departments", val)}
                                isClinic={isClinic}
                            />
                        )}
                        <button className="btn btn-primary w-full" type="submit" disabled={!step2Complete}>Next →</button>
                    </form>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!step3Complete) return;
                        setIsSubmitting(true);
                        const imageFields = ["profilePic", "businessPermit"];
                        if (isHospital) imageFields.push("constructionPermit");
                        let finalForm;
                        try { finalForm = await uploadPendingImages(form, imageFields); }
                        catch { setIsSubmitting(false); return; }
                        const departments = await resolveDepartmentTypes();
                        mutate({ ...finalForm, departments, role: "institute" });
                    }} className="space-y-4">
                        <ImageUploadField label="Business Permit" field="businessPermit" value={form.businessPermit} onChange={(val) => update("businessPermit", val)} onUploadingChange={(v) => setUploading("businessPermit", v)} required />
                        <ExpirationField label="Business Permit Expiration" field="businessPermitExpiration" inputRef={businessPermitExpirationRef} {...expirationProps} />
                        <div className="form-control">
                            <label className="label"><span className="label-text">Licensing Agency <span className="text-error">*</span></span></label>
                            <input type="text" className="input input-bordered w-full" placeholder="e.g. DOH, PhilHealth, LGU" value={form.licensingAgency} onChange={(e) => update("licensingAgency", e.target.value)} />
                        </div>
                        {isHospital && (
                            <>
                                <ImageUploadField label="Construction Permit" field="constructionPermit" value={form.constructionPermit} onChange={(val) => update("constructionPermit", val)} onUploadingChange={(v) => setUploading("constructionPermit", v)} required />
                                <ExpirationField label="Construction Permit Expiration" field="constructionPermitExpiration" inputRef={constructionPermitExpirationRef} {...expirationProps} />
                            </>
                        )}
                        <button className="btn btn-primary w-full" type="submit" disabled={isPending || isAnyUploading || !step3Complete || isSubmitting}>
                            {isPending || isSubmitting ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit Application"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default OnboardingInstitute;