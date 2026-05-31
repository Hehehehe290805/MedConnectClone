import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, AddressFields, PhoneField, forwardGeocode } from "./OnboardingShared";

const TOTAL_STEPS = 3;

const OnboardingPharmacy = ({ email, role, onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [uploadingFields, setUploadingFields] = useState({});

  const dobRef = useRef(null);
  const cityRef = useRef(null);

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
    form.pharmacyName.trim() &&
    form.pharmacistFirstName.trim() &&
    form.pharmacistLastName.trim() &&
    form.birthDate &&
    form.sex;

  const step2Complete =
    form.phoneNumber.length === 10 &&
    form.address.buildingNumber.trim() &&
    form.address.street.trim() &&
    form.address.barangay.trim() &&
    form.address.city.trim() &&
    form.address.province.trim() &&
    /^\d{4}$/.test(form.address.postalCode);

  const step3Complete =
    form.businessPermit.url &&
    form.businessPermitExpiration &&
    form.fdaLicense.url &&
    form.fdaLicenseExpiration &&
    form.pharmacistLicenseNumber.trim() &&
    form.pharmacistLicenseExpiration &&
    form.pharmacistLicenseImage.url &&
    form.pharmacistLegalIDImage.url;

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

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }} className="space-y-4">
            <ImageUploadField
              label="Pharmacy / Profile Picture"
              field="profilePic"
              value={form.profilePic}
              onChange={(val) => update("profilePic", val)}
              onUploadingChange={(v) => setUploading("profilePic", v)}
              required
            />
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacy Name <span className="text-error">*</span></span></label>
              <input type="text" className="input input-bordered w-full" placeholder="MedConnect Pharmacy" value={form.pharmacyName} onChange={(e) => update("pharmacyName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist First Name <span className="text-error">*</span></span></label>
                <input type="text" className="input input-bordered w-full" placeholder="Pedro" value={form.pharmacistFirstName} onChange={(e) => update("pharmacistFirstName", e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Pharmacist Last Name <span className="text-error">*</span></span></label>
                <input type="text" className="input input-bordered w-full" placeholder="Reyes" value={form.pharmacistLastName} onChange={(e) => update("pharmacistLastName", e.target.value)} />
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist Date of Birth <span className="text-error">*</span></span></label>
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
          <form onSubmit={(e) => { e.preventDefault(); mutate({ ...form, role: "pharmacy" }); }} className="space-y-4">
            <ImageUploadField label="Business Permit" field="businessPermit" value={form.businessPermit} onChange={(val) => update("businessPermit", val)} onUploadingChange={(v) => setUploading("businessPermit", v)} required />
            <div className="form-control">
              <label className="label"><span className="label-text">Business Permit Expiration <span className="text-error">*</span></span></label>
              <input type="date" className="input input-bordered w-full" min={minExpiration} value={form.businessPermitExpiration} onChange={(e) => update("businessPermitExpiration", e.target.value)} />
            </div>
            <ImageUploadField label="FDA License" field="fdaLicense" value={form.fdaLicense} onChange={(val) => update("fdaLicense", val)} onUploadingChange={(v) => setUploading("fdaLicense", v)} required />
            <div className="form-control">
              <label className="label"><span className="label-text">FDA License Expiration <span className="text-error">*</span></span></label>
              <input type="date" className="input input-bordered w-full" min={minExpiration} value={form.fdaLicenseExpiration} onChange={(e) => update("fdaLicenseExpiration", e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist License Number <span className="text-error">*</span></span></label>
              <input type="text" className="input input-bordered w-full" placeholder="RPh-12345" value={form.pharmacistLicenseNumber} onChange={(e) => update("pharmacistLicenseNumber", e.target.value)} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Pharmacist License Expiration <span className="text-error">*</span></span></label>
              <input type="date" className="input input-bordered w-full" min={minExpiration} value={form.pharmacistLicenseExpiration} onChange={(e) => update("pharmacistLicenseExpiration", e.target.value)} />
            </div>
            <ImageUploadField label="Pharmacist License Image" field="pharmacistLicenseImage" value={form.pharmacistLicenseImage} onChange={(val) => update("pharmacistLicenseImage", val)} onUploadingChange={(v) => setUploading("pharmacistLicenseImage", v)} required />
            <ImageUploadField label="Pharmacist Legal ID" field="pharmacistLegalIDImage" value={form.pharmacistLegalIDImage} onChange={(val) => update("pharmacistLegalIDImage", val)} onUploadingChange={(v) => setUploading("pharmacistLegalIDImage", v)} required />
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

export default OnboardingPharmacy;