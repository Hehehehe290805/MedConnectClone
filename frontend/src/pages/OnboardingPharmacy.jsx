import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, AddressFields, PhoneField } from "./OnboardingShared";

const TOTAL_STEPS = 3;

const OnboardingPharmacy = ({ email, role, onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [uploadingFields, setUploadingFields] = useState({});
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    pharmacyName: "",
    pharmacistFirstName: "",
    pharmacistLastName: "",
    birthDate: "",
    sex: "",
    bio: "",
    profilePic: { url: "", key: "" },
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
    businessPermit: { url: "", key: "" },
    businessPermitExpiration: "",
    fdaLicense: { url: "", key: "" },
    fdaLicenseExpiration: "",
    pharmacistLicenseNumber: "",
    pharmacistLicenseExpiration: "",
    pharmacistLicenseImage: { url: "", key: "" },
    pharmacistLegalIDImage: { url: "", key: "" },
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

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];
  const minExpiration = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    .toISOString().split("T")[0];

  const validateStep1 = () => {
    const e = {};
    if (!form.pharmacyName.trim()) e.pharmacyName = "Pharmacy name is required";
    if (!form.pharmacistFirstName.trim()) e.pharmacistFirstName = "First name is required";
    if (!form.pharmacistLastName.trim()) e.pharmacistLastName = "Last name is required";
    if (!form.birthDate) e.birthDate = "Date of birth is required";
    if (!form.sex) e.sex = "Sex is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    if (form.phoneNumber.length !== 10) e.phoneNumber = "Phone number must be 10 digits";
    if (!form.address.street.trim()) e["address.street"] = "Street is required";
    if (!form.address.barangay.trim()) e["address.barangay"] = "Barangay is required";
    if (!form.address.city.trim()) e["address.city"] = "City is required";
    if (!form.address.province.trim()) e["address.province"] = "Province is required";
    if (!form.address.postalCode.trim()) e["address.postalCode"] = "Postal code is required";
    if (form.address.postalCode && !/^\d{4}$/.test(form.address.postalCode))
      e["address.postalCode"] = "Postal code must be 4 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    if (!form.businessPermit.url) e.businessPermit = "Business permit image is required";
    if (!form.businessPermitExpiration) e.businessPermitExpiration = "Business permit expiration is required";
    if (!form.fdaLicense.url) e.fdaLicense = "FDA license image is required";
    if (!form.fdaLicenseExpiration) e.fdaLicenseExpiration = "FDA license expiration is required";
    if (!form.pharmacistLicenseNumber.trim()) e.pharmacistLicenseNumber = "License number is required";
    if (!form.pharmacistLicenseExpiration) e.pharmacistLicenseExpiration = "License expiration is required";
    if (!form.pharmacistLicenseImage.url) e.pharmacistLicenseImage = "License image is required";
    if (!form.pharmacistLegalIDImage.url) e.pharmacistLegalIDImage = "Legal ID image is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
      <div className="card-body p-6 sm:p-8">
        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
        <StepHeader
          title={step === 1 ? "Pharmacy Information" : step === 2 ? "Contact & Location" : "Permits & Licenses"}
          subtitle={step === 1 ? "Tell us about your pharmacy" : step === 2 ? "Where is your pharmacy located?" : "Upload required documents"}
          role={role}
          email={email}
          onBack={step === 1 ? onBack : () => setStep(step - 1)}
          isFirstStep={step === 1}
        />

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }} className="space-y-4">
            <ImageUploadField
              label="Pharmacy / Profile Picture"
              field="profilePic"
              value={form.profilePic}
              onChange={(val) => update("profilePic", val)}
              onUploadingChange={(v) => setUploading("profilePic", v)}
            />
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacy Name <span className="text-error">*</span></span></label>
              <input type="text" className={`input input-bordered w-full ${errors.pharmacyName ? "input-error" : ""}`} placeholder="MedConnect Pharmacy" value={form.pharmacyName} onChange={(e) => update("pharmacyName", e.target.value)} />
              {errors.pharmacyName && <p className="text-error text-xs mt-1">{errors.pharmacyName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist First Name <span className="text-error">*</span></span></label>
                <input type="text" className={`input input-bordered w-full ${errors.pharmacistFirstName ? "input-error" : ""}`} placeholder="Pedro" value={form.pharmacistFirstName} onChange={(e) => update("pharmacistFirstName", e.target.value)} />
                {errors.pharmacistFirstName && <p className="text-error text-xs mt-1">{errors.pharmacistFirstName}</p>}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist Last Name <span className="text-error">*</span></span></label>
                <input type="text" className={`input input-bordered w-full ${errors.pharmacistLastName ? "input-error" : ""}`} placeholder="Reyes" value={form.pharmacistLastName} onChange={(e) => update("pharmacistLastName", e.target.value)} />
                {errors.pharmacistLastName && <p className="text-error text-xs mt-1">{errors.pharmacistLastName}</p>}
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist Date of Birth <span className="text-error">*</span></span></label>
              <input type="date" className={`input input-bordered w-full ${errors.birthDate ? "input-error" : ""}`} value={form.birthDate} min={minDate} max={maxDate} onChange={(e) => update("birthDate", e.target.value)} />
              {errors.birthDate && <p className="text-error text-xs mt-1">{errors.birthDate}</p>}
              <p className="text-xs opacity-50 mt-1">Must be 18–120 years old</p>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist Sex <span className="text-error">*</span></span></label>
              <select className={`select select-bordered w-full ${errors.sex ? "select-error" : ""}`} value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.sex && <p className="text-error text-xs mt-1">{errors.sex}</p>}
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Bio</span></label>
              <textarea className="textarea textarea-bordered h-24 resize-none" placeholder="Tell us about your pharmacy" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={isAnyUploading}>
              {isAnyUploading ? <><span className="loading loading-spinner loading-xs" />Uploading...</> : "Next →"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateStep2()) setStep(3); }} className="space-y-4">
            <PhoneField
              phoneNumber={form.phoneNumber}
              phoneType={form.phoneType}
              onNumberChange={(val) => update("phoneNumber", val)}
              onTypeChange={(val) => update("phoneType", val)}
              error={errors.phoneNumber}
            />
            <AddressFields value={form.address} onChange={(val) => update("address", val)} errors={errors} />
            <button className="btn btn-primary w-full" type="submit">Next →</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateStep3()) mutate({ ...form, role: "pharmacy" }); }} className="space-y-4">
            <ImageUploadField label="Business Permit" field="businessPermit" value={form.businessPermit} onChange={(val) => update("businessPermit", val)} onUploadingChange={(v) => setUploading("businessPermit", v)} required />
            {errors.businessPermit && <p className="text-error text-xs">{errors.businessPermit}</p>}
            <div className="form-control">
              <label className="label"><span className="label-text">Business Permit Expiration <span className="text-error">*</span></span></label>
              <input type="date" className={`input input-bordered w-full ${errors.businessPermitExpiration ? "input-error" : ""}`} min={minExpiration} value={form.businessPermitExpiration} onChange={(e) => update("businessPermitExpiration", e.target.value)} />
              {errors.businessPermitExpiration && <p className="text-error text-xs mt-1">{errors.businessPermitExpiration}</p>}
            </div>
            <ImageUploadField label="FDA License" field="fdaLicense" value={form.fdaLicense} onChange={(val) => update("fdaLicense", val)} onUploadingChange={(v) => setUploading("fdaLicense", v)} required />
            {errors.fdaLicense && <p className="text-error text-xs">{errors.fdaLicense}</p>}
            <div className="form-control">
              <label className="label"><span className="label-text">FDA License Expiration <span className="text-error">*</span></span></label>
              <input type="date" className={`input input-bordered w-full ${errors.fdaLicenseExpiration ? "input-error" : ""}`} min={minExpiration} value={form.fdaLicenseExpiration} onChange={(e) => update("fdaLicenseExpiration", e.target.value)} />
              {errors.fdaLicenseExpiration && <p className="text-error text-xs mt-1">{errors.fdaLicenseExpiration}</p>}
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist License Number <span className="text-error">*</span></span></label>
              <input type="text" className={`input input-bordered w-full ${errors.pharmacistLicenseNumber ? "input-error" : ""}`} placeholder="RPh-12345" value={form.pharmacistLicenseNumber} onChange={(e) => update("pharmacistLicenseNumber", e.target.value)} />
              {errors.pharmacistLicenseNumber && <p className="text-error text-xs mt-1">{errors.pharmacistLicenseNumber}</p>}
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist License Expiration <span className="text-error">*</span></span></label>
              <input type="date" className={`input input-bordered w-full ${errors.pharmacistLicenseExpiration ? "input-error" : ""}`} min={minExpiration} value={form.pharmacistLicenseExpiration} onChange={(e) => update("pharmacistLicenseExpiration", e.target.value)} />
              {errors.pharmacistLicenseExpiration && <p className="text-error text-xs mt-1">{errors.pharmacistLicenseExpiration}</p>}
            </div>
            <ImageUploadField label="Pharmacist License Image" field="pharmacistLicenseImage" value={form.pharmacistLicenseImage} onChange={(val) => update("pharmacistLicenseImage", val)} onUploadingChange={(v) => setUploading("pharmacistLicenseImage", v)} required />
            {errors.pharmacistLicenseImage && <p className="text-error text-xs">{errors.pharmacistLicenseImage}</p>}
            <ImageUploadField label="Pharmacist Legal ID" field="pharmacistLegalIDImage" value={form.pharmacistLegalIDImage} onChange={(val) => update("pharmacistLegalIDImage", val)} onUploadingChange={(v) => setUploading("pharmacistLegalIDImage", v)} required />
            {errors.pharmacistLegalIDImage && <p className="text-error text-xs">{errors.pharmacistLegalIDImage}</p>}
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={isPending || isAnyUploading ||
                !form.businessPermit.url || !form.fdaLicense.url ||
                !form.pharmacistLicenseImage.url || !form.pharmacistLegalIDImage.url}
            >
              {isPending ? <><span className="loading loading-spinner loading-xs" />Submitting</>
                : isAnyUploading ? <><span className="loading loading-spinner loading-xs" />Uploading...</>
                  : "Submit Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default OnboardingPharmacy;