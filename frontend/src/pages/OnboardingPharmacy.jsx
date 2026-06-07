import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, AddressFields, PhoneField, forwardGeocode, uploadPendingImages } from "./OnboardingShared";
import { isValidPersonName, NAME_ERROR } from "../lib/utils";

const TOTAL_STEPS = 3;

// defined outside to prevent remount on keystroke — same pattern as AddressFieldItem
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

const OnboardingPharmacy = ({ email, role, onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [uploadingFields, setUploadingFields] = useState({});
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const dobRef = useRef(null);
  const cityRef = useRef(null);
  const businessPermitExpirationRef = useRef(null);
  const fdaLicenseExpirationRef = useRef(null);
  const pharmacistLicenseExpirationRef = useRef(null);

  const [form, setForm] = useState({
    pharmacyName: "", pharmacistFirstName: "", pharmacistLastName: "",
    birthDate: "", sex: "", bio: "",
    profilePic: {}, phoneNumber: "", phoneType: "mobile",
    address: { buildingNumber: "", street: "", barangay: "", city: "", province: "", postalCode: "", coordinates: null },
    businessPermit: {}, businessPermitExpiration: "",
    fdaLicense: {}, fdaLicenseExpiration: "",
    pharmacistLicenseNumber: "", pharmacistLicenseExpiration: "",
    pharmacistLicenseImage: {}, pharmacistLegalIDImage: {},
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

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split("T")[0];
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()).toISOString().split("T")[0];
  const minExpirationDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
  const minExpiration = minExpirationDate.toISOString().split("T")[0];
  const minExpirationLabel = minExpirationDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const step1Complete =
    form.profilePic.file &&
    form.pharmacyName.trim() &&
    form.pharmacistFirstName.trim() &&
    form.pharmacistLastName.trim() &&
    form.birthDate &&
    form.sex;

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
    (form.fdaLicense.file || form.fdaLicense.key) &&
    form.fdaLicenseExpiration &&
    form.pharmacistLicenseNumber.trim() &&
    form.pharmacistLicenseExpiration &&
    (form.pharmacistLicenseImage.file || form.pharmacistLicenseImage.key) &&
    (form.pharmacistLegalIDImage.file || form.pharmacistLegalIDImage.key);

  const validateStep1 = () => {
    const e = {};
    if (!isValidPersonName(form.pharmacistFirstName)) e.pharmacistFirstName = NAME_ERROR;
    if (!isValidPersonName(form.pharmacistLastName)) e.pharmacistLastName = NAME_ERROR;
    setErrors(e);
    if (Object.keys(e).length > 0) return false;
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

  const expirationProps = { form, update, minExpiration, minExpirationLabel };

  return (
    <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
      <div className="card-body p-6 sm:p-8">
        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
        <StepHeader
          title={step === 1 ? "Pharmacy Information" : step === 2 ? "Contact & Location" : "Permits & Licenses"}
          subtitle={step === 1 ? "Tell us about your pharmacy" : step === 2 ? "Where is your pharmacy located?" : "Upload required documents"}
          role={role} email={email}
          onBack={step === 1 ? onBack : () => setStep(step - 1)}
          isFirstStep={step === 1}
        />

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }} className="space-y-4">
            <ImageUploadField label="Pharmacy / Profile Picture" field="profilePic" value={form.profilePic} onChange={(val) => update("profilePic", val)} onUploadingChange={(v) => setUploading("profilePic", v)} required />
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacy Name <span className="text-error">*</span></span></label>
              <input type="text" className="input input-bordered w-full" placeholder="MedConnect Pharmacy" value={form.pharmacyName} onChange={(e) => update("pharmacyName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist First Name <span className="text-error">*</span></span></label>
                <input type="text" className={`input input-bordered w-full${errors.pharmacistFirstName ? " input-error" : ""}`} placeholder="Pedro" value={form.pharmacistFirstName} onChange={(e) => { update("pharmacistFirstName", e.target.value); setErrors((prev) => ({ ...prev, pharmacistFirstName: undefined })); }} />
                {errors.pharmacistFirstName && <p className="text-error text-xs mt-1">{errors.pharmacistFirstName}</p>}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist Last Name <span className="text-error">*</span></span></label>
                <input type="text" className={`input input-bordered w-full${errors.pharmacistLastName ? " input-error" : ""}`} placeholder="Reyes" value={form.pharmacistLastName} onChange={(e) => { update("pharmacistLastName", e.target.value); setErrors((prev) => ({ ...prev, pharmacistLastName: undefined })); }} />
                {errors.pharmacistLastName && <p className="text-error text-xs mt-1">{errors.pharmacistLastName}</p>}
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist Date of Birth <span className="text-error">*</span></span></label>
              <input
                ref={dobRef}
                type="date"
                className="input input-bordered w-full"
                value={form.birthDate}
                onChange={(e) => {
                  const val = e.target.value;
                  const [year] = val.split("-");
                  if (year && year.length > 4) return;
                  dobRef.current?.setCustomValidity("");
                  update("birthDate", val);
                }}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist Sex <span className="text-error">*</span></span></label>
              <select className="select select-bordered w-full" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Bio</span></label>
              <textarea className="textarea textarea-bordered h-24 resize-none" placeholder="Tell us about your pharmacy" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
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
            <button className="btn btn-primary w-full" type="submit" disabled={!step2Complete}>Next →</button>
          </form>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!step3Complete) return;
            setIsSubmitting(true);
            let finalForm;
            try {
              finalForm = await uploadPendingImages(form, ["profilePic", "businessPermit", "fdaLicense", "pharmacistLicenseImage", "pharmacistLegalIDImage"]);
            } catch { setIsSubmitting(false); return; }
            mutate({ ...finalForm, role: "pharmacy" });
          }} className="space-y-4">
            <ImageUploadField label="Business Permit" field="businessPermit" value={form.businessPermit} onChange={(val) => update("businessPermit", val)} onUploadingChange={(v) => setUploading("businessPermit", v)} required />
            <ExpirationField label="Business Permit Expiration" field="businessPermitExpiration" inputRef={businessPermitExpirationRef} {...expirationProps} />
            <ImageUploadField label="FDA License" field="fdaLicense" value={form.fdaLicense} onChange={(val) => update("fdaLicense", val)} onUploadingChange={(v) => setUploading("fdaLicense", v)} required />
            <ExpirationField label="FDA License Expiration" field="fdaLicenseExpiration" inputRef={fdaLicenseExpirationRef} {...expirationProps} />
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist License Number <span className="text-error">*</span></span></label>
              <input type="text" className="input input-bordered w-full" placeholder="RPh-12345" value={form.pharmacistLicenseNumber} onChange={(e) => update("pharmacistLicenseNumber", e.target.value)} />
            </div>
            <ExpirationField label="Pharmacist License Expiration" field="pharmacistLicenseExpiration" inputRef={pharmacistLicenseExpirationRef} {...expirationProps} />
            <ImageUploadField label="Pharmacist License Image" field="pharmacistLicenseImage" value={form.pharmacistLicenseImage} onChange={(val) => update("pharmacistLicenseImage", val)} onUploadingChange={(v) => setUploading("pharmacistLicenseImage", v)} required />
            <ImageUploadField label="Pharmacist Legal ID" field="pharmacistLegalIDImage" value={form.pharmacistLegalIDImage} onChange={(val) => update("pharmacistLegalIDImage", val)} onUploadingChange={(v) => setUploading("pharmacistLegalIDImage", v)} required />
            <button className="btn btn-primary w-full" type="submit" disabled={isPending || isAnyUploading || !step3Complete || isSubmitting}>
              {isPending || isSubmitting ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default OnboardingPharmacy;