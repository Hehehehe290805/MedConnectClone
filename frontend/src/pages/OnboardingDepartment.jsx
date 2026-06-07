import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { BuildingIcon, PencilLineIcon } from "lucide-react";
import { createDepartmentAccount } from "../lib/api";
import { StepProgress, StepHeader, ImageUploadField, AddressFields, PhoneField, forwardGeocode, uploadPendingImages } from "./OnboardingShared";
import useAuthUser from "../hooks/useAuthUser";
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

const OnboardingDepartment = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { authUser } = useAuthUser();

    const [step, setStep] = useState(1);
    const [uploadingFields, setUploadingFields] = useState({});
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [selectedDeptType, setSelectedDeptType] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [useInstituteAddress, setUseInstituteAddress] = useState(false);
    const [showOtherInput, setShowOtherInput] = useState(false);
    const [customDeptName, setCustomDeptName] = useState("");

    const isClinic = authUser?.instituteType === "clinic";
    const isHospital = authUser?.instituteType === "hospital";

    const dobRef = useRef(null);
    const cityRef = useRef(null);
    const licenseExpirationRef = useRef(null);

    const departments = authUser?.departments || [];

    // auto-select when institute has exactly one department type
    useEffect(() => {
        if (departments.length === 1 && !selectedDeptType) {
            setSelectedDeptType(departments[0]);
        }
    }, [departments]);

    // clinic: auto-fill address from institute on mount
    useEffect(() => {
        if (isClinic && authUser?.address) {
            setForm((prev) => ({ ...prev, address: authUser.address }));
        }
    }, [isClinic, authUser?.address]);

    const [form, setForm] = useState({
        deptEmail: "",
        deptPassword: "",
        confirmPassword: "",
        profilePic: {},
        technologistFirstName: "",
        technologistLastName: "",
        birthDate: "",
        sex: "",
        bio: "",
        phoneNumber: "",
        phoneType: "mobile",
        address: {
            buildingNumber: "",
            street: "",
            barangay: "",
            city: "",
            province: "",
            postalCode: "",
            coordinates: null,
        },
        technologistLicenseNumber: "",
        technologistLicenseExpiration: "",
        technologistLicenseImage: {},
        technologistLegalIDImage: {},
    });

    const isAnyUploading = Object.values(uploadingFields).some(Boolean);
    const setUploading = (field, val) => setUploadingFields((prev) => ({ ...prev, [field]: val }));

    const { mutate, isPending } = useMutation({
        mutationFn: createDepartmentAccount,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["authUser"] });
            setShowSuccess(true);
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || "Failed to create department account.");
            setIsSubmitting(false);
        },
    });

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (field === "address") cityRef.current?.setCustomValidity("");
    };

    const today = new Date();
    const maxDOB = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split("T")[0];
    const minDOB = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()).toISOString().split("T")[0];
    const minExpirationDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    const minExpiration = minExpirationDate.toISOString().split("T")[0];
    const minExpirationLabel = minExpirationDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const step1Complete =
        form.deptEmail && EMAIL_REGEX.test(form.deptEmail) &&
        form.deptPassword && PASSWORD_REGEX.test(form.deptPassword) &&
        form.deptPassword === form.confirmPassword &&
        form.profilePic.file &&
        form.technologistFirstName.trim() &&
        form.technologistLastName.trim() &&
        form.birthDate &&
        form.sex;

    const addressFilled =
        form.address.buildingNumber?.trim() &&
        form.address.street?.trim() &&
        form.address.barangay?.trim() &&
        form.address.city?.trim() &&
        form.address.province?.trim() &&
        /^\d{4}$/.test(form.address.postalCode);

    const step2Complete =
        phoneVerified &&
        form.phoneNumber.length === 10 &&
        (isClinic ? true : addressFilled || useInstituteAddress);

    const step3Complete =
        form.technologistLicenseNumber.trim() &&
        form.technologistLicenseExpiration &&
        (form.technologistLicenseImage.file || form.technologistLicenseImage.key) &&
        (form.technologistLegalIDImage.file || form.technologistLegalIDImage.key);

    const validateStep1 = () => {
        const e = {};
        if (!isValidPersonName(form.technologistFirstName)) e.technologistFirstName = NAME_ERROR;
        if (!isValidPersonName(form.technologistLastName)) e.technologistLastName = NAME_ERROR;
        setErrors(e);
        if (Object.keys(e).length > 0) return false;
        if (!form.birthDate) {
            dobRef.current?.setCustomValidity("Date of birth is required");
            dobRef.current?.reportValidity();
            return false;
        }
        if (form.birthDate > maxDOB || form.birthDate < minDOB) {
            dobRef.current?.setCustomValidity("Age must be between 18 and 120 years old");
            dobRef.current?.reportValidity();
            return false;
        }
        dobRef.current?.setCustomValidity("");
        return true;
    };

    // --- TYPE SELECTOR (shown before steps when institute has multiple dept types) ---
    if (!selectedDeptType) {
        if (departments.length === 0) {
            return (
                <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                    <div className="card bg-base-200 w-full max-w-md shadow-xl">
                        <div className="card-body p-8 text-center space-y-4">
                            <BuildingIcon className="size-10 text-base-content/40 mx-auto" />
                            <h2 className="text-xl font-bold">No Department Types Registered</h2>
                            <p className="text-sm opacity-70">
                                Your institute has no department types set up yet. Please complete the onboarding process first.
                            </p>
                            <button className="btn btn-primary w-full" onClick={() => navigate("/")}>
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (departments.length === 1) {
            // waiting for useEffect to auto-select
            return null;
        }

        // multiple types — show selector
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                <div className="card bg-base-200 w-full max-w-md shadow-xl">
                    <div className="card-body p-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <BuildingIcon className="size-6 text-primary" />
                            <h2 className="text-xl font-bold">Select Department Type</h2>
                        </div>
                        <p className="text-sm opacity-70">
                            Which type of department are you setting up?
                        </p>
                        <div className="space-y-2">
                            {departments.map((dept) => (
                                <button
                                    key={dept._id}
                                    onClick={() => { setShowOtherInput(false); setSelectedDeptType(dept); }}
                                    className="w-full btn btn-outline text-left justify-start gap-3"
                                >
                                    <BuildingIcon className="size-4 text-primary" />
                                    {dept.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowOtherInput((v) => !v)}
                                className={`w-full btn btn-outline text-left justify-start gap-3 ${showOtherInput ? "btn-active" : ""}`}
                            >
                                <PencilLineIcon className="size-4 text-primary" />
                                Others
                            </button>
                            {showOtherInput && (
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        className="input input-bordered flex-1"
                                        placeholder="Enter department type"
                                        value={customDeptName}
                                        onChange={(e) => setCustomDeptName(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={!customDeptName.trim()}
                                        onClick={() => {
                                            setSelectedDeptType({ _id: null, name: customDeptName.trim(), isCustom: true });
                                            setShowOtherInput(false);
                                        }}
                                    >
                                        Confirm
                                    </button>
                                </div>
                            )}
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- CLINIC WITH EXISTING DEPARTMENTS: show cards instead of form ---
    const deptAccounts = authUser?.departmentAccounts || [];
    if (isClinic && deptAccounts.length >= 1 && !showSuccess) {
        const deptType = departments[0]; // clinic has 1 dept type
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                <div className="card bg-base-200 w-full max-w-md shadow-xl">
                    <div className="card-body p-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <BuildingIcon className="size-6 text-primary" />
                            <h2 className="text-xl font-bold">Department Sub-Account</h2>
                        </div>
                        <p className="text-sm opacity-70">Your clinic has 1 department sub-account set up.</p>

                        <div className="card bg-base-100 border border-base-300 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold">{deptType?.name || "Department"}</p>
                                <span className="badge badge-info badge-sm">1 Account</span>
                            </div>
                            <p className="text-xs opacity-60">Clinic departments are limited to 1 sub-account per type.</p>
                            <div className="flex gap-2 mt-2">
                                <a
                                    href={`/profile/${deptAccounts[0]}`}
                                    className="btn btn-sm btn-outline flex-1"
                                >
                                    View Details
                                </a>
                            </div>
                        </div>

                        <button className="btn btn-ghost btn-sm w-full" onClick={() => navigate("/")}>
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- HOSPITAL: show existing cards + add new ---
    if (isHospital && deptAccounts.length > 0 && !showSuccess && !selectedDeptType) {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                <div className="card bg-base-200 w-full max-w-md shadow-xl">
                    <div className="card-body p-8 space-y-4">
                        <div className="flex items-center gap-2">
                            <BuildingIcon className="size-6 text-primary" />
                            <h2 className="text-xl font-bold">Department Sub-Accounts</h2>
                        </div>
                        <p className="text-sm opacity-70">{deptAccounts.length} department(s) set up.</p>

                        <div className="space-y-2">
                            {departments.map((deptType, i) => (
                                <div key={deptType._id || i} className="card bg-base-100 border border-base-300 p-3 flex flex-row items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-sm">{deptType.name}</p>
                                    </div>
                                    <a href={`/profile/${deptAccounts[i]}`} className="btn btn-xs btn-outline shrink-0">
                                        View
                                    </a>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm flex-1" onClick={() => navigate("/")}>
                                ← Back
                            </button>
                            <button className="btn btn-primary btn-sm flex-1" onClick={() => setSelectedDeptType(departments[0] || null)}>
                                Add Department
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- SUCCESS SCREEN ---
    if (showSuccess) {
        return (
            <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
                <div className="card bg-base-200 w-full max-w-md shadow-xl">
                    <div className="card-body p-8 text-center space-y-4">
                        <div className="size-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                            <BuildingIcon className="size-8 text-success" />
                        </div>
                        <h2 className="text-2xl font-bold">Department Created!</h2>
                        <p className="text-sm opacity-70">
                            The <span className="font-semibold">{selectedDeptType.name}</span> department account has been created and is pending approval.
                        </p>
                        <button className="btn btn-primary w-full" onClick={() => navigate("/")}>
                            Back to Dashboard
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                                setShowSuccess(false);
                                setStep(1);
                                setForm({
                                    deptEmail: "", deptPassword: "", confirmPassword: "",
                                    profilePic: {}, technologistFirstName: "", technologistLastName: "",
                                    birthDate: "", sex: "", bio: "", phoneNumber: "", phoneType: "mobile",
                                    address: { buildingNumber: "", street: "", barangay: "", city: "", province: "", postalCode: "", coordinates: null },
                                    technologistLicenseNumber: "", technologistLicenseExpiration: "",
                                    technologistLicenseImage: {}, technologistLegalIDImage: {},
                                });
                                if (departments.length > 1) setSelectedDeptType(null);
                            }}
                        >
                            Add Another Department
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const sharedHeaderProps = {
        role: "department",
        email: authUser?.email,
        onBack: step === 1 ? () => { if (departments.length > 1) setSelectedDeptType(null); else navigate("/"); } : () => setStep(step - 1),
        isFirstStep: step === 1,
    };

    return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
            <div className="card bg-base-200 w-full max-w-2xl shadow-xl">
                <div className="card-body p-6 sm:p-8">
                    <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />

                    {/* Department type badge */}
                    <div className="mb-2">
                        <span className="badge badge-secondary badge-outline text-xs capitalize">
                            {selectedDeptType.name}
                        </span>
                    </div>

                    <StepHeader
                        title={step === 1 ? "Department Account Setup" : step === 2 ? "Contact & Location" : "Credentials"}
                        subtitle={step === 1 ? "Enter the department account details and technologist info" : step === 2 ? "Where is the department located?" : "Technologist license details"}
                        {...sharedHeaderProps}
                    />

                    {/* STEP 1 */}
                    {step === 1 && (
                        <form onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }} className="space-y-4">
                            <div className="divider text-xs opacity-50">Department Account Credentials</div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Department Email <span className="text-error">*</span></span></label>
                                <input
                                    type="email"
                                    className="input input-bordered w-full"
                                    placeholder="radiology@hospital.com"
                                    value={form.deptEmail}
                                    onChange={(e) => update("deptEmail", e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-control">
                                    <label className="label"><span className="label-text">Password <span className="text-error">*</span></span></label>
                                    <input
                                        type="password"
                                        className="input input-bordered w-full"
                                        placeholder="••••••••"
                                        value={form.deptPassword}
                                        onChange={(e) => update("deptPassword", e.target.value)}
                                    />
                                </div>
                                <div className="form-control">
                                    <label className="label"><span className="label-text">Confirm Password <span className="text-error">*</span></span></label>
                                    <input
                                        type="password"
                                        className="input input-bordered w-full"
                                        placeholder="••••••••"
                                        value={form.confirmPassword}
                                        onChange={(e) => update("confirmPassword", e.target.value)}
                                    />
                                </div>
                            </div>
                            {form.deptPassword && !PASSWORD_REGEX.test(form.deptPassword) && (
                                <p className="text-xs text-error">Password must be 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&)</p>
                            )}
                            {form.confirmPassword && form.deptPassword !== form.confirmPassword && (
                                <p className="text-xs text-error">Passwords do not match</p>
                            )}

                            <div className="divider text-xs opacity-50">Technologist Information</div>
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
                                    <input type="text" className={`input input-bordered w-full${errors.technologistFirstName ? " input-error" : ""}`} placeholder="Maria" value={form.technologistFirstName} onChange={(e) => { update("technologistFirstName", e.target.value); setErrors((prev) => ({ ...prev, technologistFirstName: undefined })); }} />
                                    {errors.technologistFirstName && <p className="text-error text-xs mt-1">{errors.technologistFirstName}</p>}
                                </div>
                                <div className="form-control">
                                    <label className="label"><span className="label-text">Last Name <span className="text-error">*</span></span></label>
                                    <input type="text" className={`input input-bordered w-full${errors.technologistLastName ? " input-error" : ""}`} placeholder="Santos" value={form.technologistLastName} onChange={(e) => { update("technologistLastName", e.target.value); setErrors((prev) => ({ ...prev, technologistLastName: undefined })); }} />
                                    {errors.technologistLastName && <p className="text-error text-xs mt-1">{errors.technologistLastName}</p>}
                                </div>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Date of Birth <span className="text-error">*</span></span></label>
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
                                <label className="label"><span className="label-text">Sex <span className="text-error">*</span></span></label>
                                <select className="select select-bordered w-full" value={form.sex} onChange={(e) => update("sex", e.target.value)}>
                                    <option value="">Select</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Bio</span></label>
                                <textarea className="textarea textarea-bordered h-24 resize-none" placeholder="Tell us about the department" value={form.bio} onChange={(e) => update("bio", e.target.value)} />
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
                            // clinic: address already filled from institute
                            if (isClinic || useInstituteAddress) {
                                setStep(3);
                                return;
                            }
                            const coords = form.address.coordinates;
                            let finalForm = form;
                            if (!coords) {
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
                                onVerified={setPhoneVerified}
                            />

                            {isClinic ? (
                                <AddressFields
                                    value={form.address}
                                    onChange={() => {}}
                                    errors={{}}
                                    disabled={true}
                                    label="Business Address"
                                />
                            ) : (
                                <>
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            onClick={() => {
                                                if (!useInstituteAddress) {
                                                    setForm((prev) => ({ ...prev, address: authUser?.address || prev.address }));
                                                }
                                                setUseInstituteAddress((v) => !v);
                                            }}
                                        >
                                            {useInstituteAddress ? "Enter Custom Address" : "Use Institute Address"}
                                        </button>
                                    </div>
                                    {useInstituteAddress ? (
                                        <div className="alert bg-base-300 border border-base-content/10 text-sm">
                                            <BuildingIcon className="size-4 shrink-0" />
                                            <span>Using institute address. Click "Enter Custom Address" to change.</span>
                                        </div>
                                    ) : (
                                        <AddressFields value={form.address} onChange={(val) => update("address", val)} errors={{}} cityRef={cityRef} label="Business Address" />
                                    )}
                                </>
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
                            let finalForm;
                            try {
                                finalForm = await uploadPendingImages(form, ["profilePic", "technologistLicenseImage", "technologistLegalIDImage"]);
                            } catch {
                                setIsSubmitting(false);
                                return;
                            }
                            mutate({
                                ...finalForm,
                                departmentTypeId: selectedDeptType._id || undefined,
                                customDepartmentName: selectedDeptType.isCustom ? selectedDeptType.name : undefined,
                            });
                        }} className="space-y-4">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Technologist License Number <span className="text-error">*</span></span></label>
                                <input type="text" className="input input-bordered w-full" placeholder="RT-12345" value={form.technologistLicenseNumber} onChange={(e) => update("technologistLicenseNumber", e.target.value)} />
                            </div>
                            <ExpirationField
                                label="Technologist License Expiration"
                                field="technologistLicenseExpiration"
                                inputRef={licenseExpirationRef}
                                form={form}
                                update={update}
                                minExpiration={minExpiration}
                                minExpirationLabel={minExpirationLabel}
                            />
                            <ImageUploadField label="Technologist License Image" field="technologistLicenseImage" value={form.technologistLicenseImage} onChange={(val) => update("technologistLicenseImage", val)} onUploadingChange={(v) => setUploading("technologistLicenseImage", v)} required />
                            <ImageUploadField label="Technologist Legal ID Image" field="technologistLegalIDImage" value={form.technologistLegalIDImage} onChange={(val) => update("technologistLegalIDImage", val)} onUploadingChange={(v) => setUploading("technologistLegalIDImage", v)} required />
                            <button
                                className="btn btn-primary w-full"
                                type="submit"
                                disabled={isPending || isAnyUploading || !step3Complete || isSubmitting}
                            >
                                {isPending || isSubmitting ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Create Department Account"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingDepartment;
