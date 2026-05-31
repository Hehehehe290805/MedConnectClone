import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, LanguagesField, AddressFields, PhoneField, forwardGeocode } from "./OnboardingShared";
import { SpecialtyField, SubspecialtyField, suggestSpecialty, suggestSubspecialty } from "../components/SpecialtyField";

const TOTAL_STEPS = 3;

const OnboardingDoctor = ({ email, role, onBack, onSuccess }) => {
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [uploadingFields, setUploadingFields] = useState({});

    const dobRef = useRef(null);
    const cityRef = useRef(null);

    const [form, setForm] = useState({
        profilePic: { url: "", key: "" },
        firstName: "",
        lastName: "",
        birthDate: "",
        sex: "",
        bio: "",
        languages: [],
        phoneNumber: "",
        phoneType: "mobile",
        address: {
            buildingNumber: "",
            street: "",
            barangay: "",
            city: "",
            province: "",
            postalCode: "",
            coordinates: { type: "Point", coordinates: [0, 0] },
        },
        // specialty/subSpecialty store { _id, name, status, isNew? } objects locally
        specialty: [],
        subSpecialty: [],
        licenseNumber: "",
        licenseExpiration: "",
        licenseImage: { url: "", key: "" },
        legalIDImage: { url: "", key: "" },
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
        if (field === "address") cityRef.current?.setCustomValidity("");
    };

    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
        .toISOString().split("T")[0];
    const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
        .toISOString().split("T")[0];
    const minExpiration = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        .toISOString().split("T")[0];

    const step1Complete =
        form.profilePic.url &&
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.birthDate &&
        form.sex;

    const step2Complete =
        form.languages.length > 0 &&
        form.phoneNumber.length === 10 &&
        form.address.buildingNumber.trim() &&
        form.address.street.trim() &&
        form.address.barangay.trim() &&
        form.address.city.trim() &&
        form.address.province.trim() &&
        /^\d{4}$/.test(form.address.postalCode);

    const step3Complete =
        form.specialty.length > 0 &&
        form.licenseNumber.trim() &&
        form.licenseExpiration &&
        form.licenseImage.key &&
        form.legalIDImage.key;

    const validateStep1 = () => {
        if (!form.birthDate) {
            dobRef.current?.setCustomValidity("Date of birth is required");
            dobRef.current?.reportValidity();
            return false;
        }
        if (form.birthDate > maxDate || form.birthDate < minDate) {
            dobRef.current?.setCustomValidity("Age must be between 18 and 120 years old");
            dobRef.current?.reportValidity();
            return false;
        }
        dobRef.current?.setCustomValidity("");
        return true;
    };

    // resolve local specialty/subSpecialty objects to real ObjectIds
    // suggests new ones to DB, returns arrays of ObjectIds
    const resolveSpecialties = async () => {
        const specialtyIdMap = {}; // name -> _id (for linking new subspecialties to new specialties)

        const resolvedSpecialties = await Promise.all(
            form.specialty.map(async (s) => {
                if (!s.isNew) {
                    specialtyIdMap[s.name] = s._id;
                    return s._id;
                }
                try {
                    const suggested = await suggestSpecialty(s.name);
                    specialtyIdMap[s.name] = suggested._id;
                    return suggested._id;
                } catch (err) {
                    // already exists — fetch its id from the error or re-fetch
                    // for now toast and skip
                    toast.error(`Specialty "${s.name}" already exists or could not be submitted.`);
                    return null;
                }
            })
        );

        const resolvedSubSpecialties = await Promise.all(
            form.subSpecialty.map(async (s) => {
                if (!s.isNew) return s._id;
                // root specialty id — may have just been created above
                const rootId = s.rootSpecialtyId || specialtyIdMap[s.rootSpecialtyName];
                if (!rootId) {
                    toast.error(`Could not determine root specialty for "${s.name}".`);
                    return null;
                }
                try {
                    const suggested = await suggestSubspecialty(s.name, rootId);
                    return suggested._id;
                } catch {
                    toast.error(`Subspecialty "${s.name}" already exists or could not be submitted.`);
                    return null;
                }
            })
        );

        return {
            specialty: resolvedSpecialties.filter(Boolean),
            subSpecialty: resolvedSubSpecialties.filter(Boolean),
        };
    };

    return (
        <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
            <div className="card-body p-6 sm:p-8">
                <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
                <StepHeader
                    title={step === 1 ? "Personal Information" : step === 2 ? "Contact & Location" : "Professional Details"}
                    subtitle={step === 1 ? "Tell us about yourself" : step === 2 ? "How can we reach you?" : "Your credentials and specialties"}
                    role={role}
                    email={email}
                    onBack={step === 1 ? onBack : () => setStep(step - 1)}
                    isFirstStep={step === 1}
                />

                {/* STEP 1 */}
                {step === 1 && (
                    <form onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }} className="space-y-4">
                        <ImageUploadField
                            label="Profile Picture"
                            field="profilePic"
                            value={form.profilePic}
                            onChange={(val) => update("profilePic", val)}
                            onUploadingChange={(v) => setUploading("profilePic", v)}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">First Name <span className="text-error">*</span></span></label>
                                <input type="text" className="input input-bordered w-full" placeholder="Maria" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                                <input type="text" className="input input-bordered w-full" placeholder="Santos" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Date of Birth <span className="text-error">*</span></span></label>
                            <input
                                ref={dobRef}
                                type="date"
                                className="input input-bordered w-full"
                                value={form.birthDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => {
                                    dobRef.current?.setCustomValidity("");
                                    update("birthDate", e.target.value);
                                }}
                            />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Sex <span className="text-error">*</span></span></label>
                            <select className="select select-bordered w-full" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Bio</span></label>
                            <textarea className="textarea textarea-bordered h-24 resize-none" placeholder="Tell us about yourself" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
                        </div>
                        <button className="btn btn-primary w-full" type="submit" disabled={!step1Complete || isAnyUploading}>
                            Next →
                        </button>
                    </form>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const coords = form.address.coordinates?.coordinates;
                        const needsGeocode = !coords;
                        let finalForm = form;
                        if (needsGeocode) {
                            const result = await forwardGeocode(form.address);
                            if (result) {
                                finalForm = {
                                    ...form,
                                    address: {
                                        ...form.address,
                                        coordinates: { type: "Point", coordinates: [result.lng, result.lat] },
                                    },
                                };
                            } else {
                                cityRef.current?.setCustomValidity("City not found. Please check your address.");
                                cityRef.current?.reportValidity();
                                return;
                            }
                        }
                        setForm(finalForm);
                        setStep(3);
                    }} className="space-y-4">
                        <LanguagesField value={form.languages} onChange={(val) => update("languages", val)} />
                        <PhoneField
                            phoneNumber={form.phoneNumber}
                            phoneType={form.phoneType}
                            onNumberChange={(val) => update("phoneNumber", val)}
                            onTypeChange={(val) => update("phoneType", val)}
                        />
                        <AddressFields value={form.address} onChange={(val) => update("address", val)} errors={{}} cityRef={cityRef} />
                        <button className="btn btn-primary w-full" type="submit" disabled={!step2Complete}>Next →</button>
                    </form>
                )}

                {/* STEP 3 */}
                {step === 3 && (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!step3Complete) return;

                        // resolve new specialties/subspecialties to real ObjectIds
                        const { specialty, subSpecialty } = await resolveSpecialties();

                        mutate({
                            ...form,
                            specialty,
                            subSpecialty,
                            role: "doctor",
                        });
                    }} className="space-y-4">
                        <SpecialtyField
                            value={form.specialty}
                            onChange={(val) => update("specialty", val)}
                        />
                        <SubspecialtyField
                            value={form.subSpecialty}
                            onChange={(val) => update("subSpecialty", val)}
                            selectedSpecialties={form.specialty}
                        />
                        <div className="form-control">
                            <label className="label"><span className="label-text">License Number <span className="text-error">*</span></span></label>
                            <input type="text" className="input input-bordered w-full" placeholder="MD-12345" value={form.licenseNumber} onChange={(e) => update("licenseNumber", e.target.value)} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">License Expiration <span className="text-error">*</span></span></label>
                            <input
                                type="date"
                                className="input input-bordered w-full"
                                min={minExpiration}
                                value={form.licenseExpiration}
                                onChange={(e) => update("licenseExpiration", e.target.value)}
                            />
                        </div>
                        <ImageUploadField
                            label="License Image"
                            field="licenseImage"
                            value={form.licenseImage}
                            onChange={(val) => update("licenseImage", val)}
                            onUploadingChange={(v) => setUploading("licenseImage", v)}
                            required
                        />
                        <ImageUploadField
                            label="Legal ID Image"
                            field="legalIDImage"
                            value={form.legalIDImage}
                            onChange={(val) => update("legalIDImage", val)}
                            onUploadingChange={(v) => setUploading("legalIDImage", v)}
                            required
                        />
                        <button
                            className="btn btn-primary w-full"
                            type="submit"
                            disabled={isPending || isAnyUploading || !step3Complete}
                        >
                            {isPending ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit Application"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default OnboardingDoctor;