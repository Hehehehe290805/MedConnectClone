import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, LanguagesField, AddressFields, PhoneField, forwardGeocode } from "./OnboardingShared";

const TOTAL_STEPS = 2;

const OnboardingPatient = ({ email, role, onBack, onSuccess }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [uploadingFields, setUploadingFields] = useState({});
  const [errors, setErrors] = useState({});

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
  });

  const isAnyUploading = Object.values(uploadingFields).some(Boolean);
  const setUploading = (field, val) =>
    setUploadingFields((prev) => ({ ...prev, [field]: val }));
  const dobRef = useRef(null);
  const cityRef = useRef(null);

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
    if (field === "address") cityRef.current?.setCustomValidity("");
  };

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];

  // step 1 required: profilePic, firstName, lastName, birthDate, sex
  const step1Complete = form.profilePic.url && form.firstName.trim() && form.lastName.trim() && form.birthDate && form.sex;

  // step 2 required: languages, phoneNumber(10 digits), street, barangay, city, province, postalCode(4 digits)
  const step2Complete =
    form.languages.length > 0 &&
    form.phoneNumber.length === 10 &&
    form.address.buildingNumber.trim() &&
    form.address.street.trim() &&
    form.address.barangay.trim() &&
    form.address.city.trim() &&
    form.address.province.trim() &&
    /^\d{4}$/.test(form.address.postalCode);

  const validateStep1 = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.birthDate) {
      dobRef.current?.setCustomValidity("Date of birth is required");
      dobRef.current?.reportValidity();
      return false;
    } else if (form.birthDate > maxDate || form.birthDate < minDate) {
        dobRef.current?.setCustomValidity("Age must be between 18 and 120 years old");
        dobRef.current?.reportValidity();
        return false;
      } else {
      dobRef.current?.setCustomValidity("");
    }
    if (!form.sex) e.sex = "Sex is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (form.languages.length === 0) e.languages = "At least one language is required";
    if (!form.phoneNumber.trim()) e.phoneNumber = "Phone number is required";
    else if (form.phoneNumber.length !== 10) e.phoneNumber = "Phone number must be 10 digits";
    if (!form.address.buildingNumber.trim()) e["address.buildingNumber"] = "Building / House No. is required";
    if (!form.address.street.trim()) e["address.street"] = "Street is required";
    if (!form.address.barangay.trim()) e["address.barangay"] = "Barangay is required";
    if (!form.address.city.trim()) e["address.city"] = "City is required";
    if (!form.address.province.trim()) e["address.province"] = "Province is required";
    if (!form.address.postalCode.trim()) e["address.postalCode"] = "Postal code is required";
    else if (!/^\d{4}$/.test(form.address.postalCode)) e["address.postalCode"] = "Postal code must be 4 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
      <div className="card-body p-6 sm:p-8">
        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
        <StepHeader
          title={step === 1 ? "Personal Information" : "Contact & Location"}
          subtitle={step === 1 ? "Tell us about yourself" : "How can we reach you?"}
          role={role}
          email={email}
          onBack={step === 1 ? onBack : () => setStep(1)}
          isFirstStep={step === 1}
        />

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
                <input
                  type="text"
                  className={`input input-bordered w-full ${errors.firstName ? "input-error" : ""}`}
                  placeholder="Juan"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                />
                {errors.firstName && <p className="text-error text-xs mt-1">{errors.firstName}</p>}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                <input
                  type="text"
                  className={`input input-bordered w-full ${errors.lastName ? "input-error" : ""}`}
                  placeholder="dela Cruz"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                />
                {errors.lastName && <p className="text-error text-xs mt-1">{errors.lastName}</p>}
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Date of Birth <span className="text-error">*</span></span></label>
              <input
                ref={dobRef}
                type="date"
                className={`input input-bordered w-full ${errors.birthDate ? "input-error" : ""}`}
                value={form.birthDate}
                max={maxDate}
                min={minDate}
                onChange={(e) => {
                  const val = e.target.value;
                    dobRef.current?.setCustomValidity("");
                    update("birthDate", e.target.value);
                }}
              />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Sex <span className="text-error">*</span></span></label>
              <select
                className={`select select-bordered w-full ${errors.sex ? "select-error" : ""}`}
                value={form.sex}
                onChange={(e) => update("sex", e.target.value)}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.sex && <p className="text-error text-xs mt-1">{errors.sex}</p>}
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Bio</span></label>
              <textarea
                className="textarea textarea-bordered h-24 resize-none"
                placeholder="Tell us about yourself"
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={!step1Complete || isAnyUploading}
            >
              Next →
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!validateStep2()) return;
            // if coordinates are still [0,0] (user didn't use map pin), forward-geocode from typed address
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
            mutate({ ...finalForm, role: "patient" });
          }} className="space-y-4">
            <LanguagesField value={form.languages} onChange={(val) => update("languages", val)} error={errors.languages} />
            <PhoneField
              phoneNumber={form.phoneNumber}
              phoneType={form.phoneType}
              onNumberChange={(val) => update("phoneNumber", val)}
              onTypeChange={(val) => update("phoneType", val)}
              error={errors.phoneNumber}
            />
            <AddressFields
              value={form.address}
              onChange={(val) => update("address", val)}
              errors={errors}
              cityRef={cityRef}
            />
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={isPending || !step2Complete}
            >
              {isPending ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Complete Onboarding"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default OnboardingPatient;