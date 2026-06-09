import { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloudIcon, XIcon, ArrowLeftIcon, MapPinIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import imageCompression from "browser-image-compression";
import { uploadFile, requestPhoneVerify, confirmPhoneVerify, requestOnboardingEmailVerify, confirmOnboardingEmailVerify } from "../lib/api";
import toast from "react-hot-toast";
import { LANGUAGES } from "../constants";
import MapPinModal from "../components/MapPinModal";
import PSGCAddressFields from "../components/PSGCAddressFields";
export { forwardGeocode } from "../components/MapPinModal";

// --- STEP PROGRESS BAR ---
export const StepProgress = ({ currentStep, totalSteps }) => (
    <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${i < currentStep ? "bg-primary" : "bg-base-300"}`}
            />
        ))}
    </div>
);

// --- STEP HEADER ---
export const StepHeader = ({ title, subtitle, role, email, phoneNumber, onBack, isFirstStep }) => (
    <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
            <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center size-9 rounded-full bg-primary text-primary-content hover:bg-primary/80 transition-colors flex-shrink-0"
            >
                <ArrowLeftIcon className="size-4" />
            </button>
            <span className="text-sm opacity-60">
                {isFirstStep ? "Change role" : "Previous step"}
            </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-primary badge-outline text-xs capitalize">{role}</span>
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
        <div className="mt-3 flex gap-4">
            <div className="form-control flex-1">
                <label className="label py-0">
                    <span className="label-text text-xs">{email ? "Email" : "Phone"}</span>
                </label>
                <input
                    type="text"
                    value={email || phoneNumber || ""}
                    readOnly
                    disabled
                    className="input input-bordered input-sm bg-base-200 cursor-not-allowed opacity-60"
                />
            </div>
            <div className="form-control w-28">
                <label className="label py-0"><span className="label-text text-xs">Role</span></label>
                <input
                    type="text"
                    value={role || ""}
                    readOnly
                    disabled
                    className="input input-bordered input-sm bg-base-200 cursor-not-allowed opacity-60 capitalize"
                />
            </div>
        </div>
    </div>
);

// --- IMAGE UPLOAD FIELD ---
// value: { file: File } before upload, { url, key } after upload (set by submit handler)
// onChange: called with { file } on selection
// onUploadingChange: not used for upload state anymore, kept for API compat
export const ImageUploadField = ({ label, field, value, onChange, required = false, onUploadingChange }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const inputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        setIsProcessing(true);
        if (onUploadingChange) onUploadingChange(true);
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: field === "profilePic" ? 0.5 : 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            });
            // store compressed file locally — S3 upload happens on form submit
            onChange({ file: compressed });
        } catch (err) {
            toast.error(`Failed to process ${label}: ${err.message}`);
        } finally {
            setIsProcessing(false);
            if (onUploadingChange) onUploadingChange(false);
        }
    };

    // preview: use object URL for local file, or url for already-uploaded
    const previewUrl = value?.file
        ? URL.createObjectURL(value.file)
        : value?.url || null;

    const hasFile = !!(value?.file || value?.key);

    return (
        <div className="form-control">
            <label className="label">
                <span className="label-text">
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                </span>
            </label>
            <div
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                        hasFile
                        ? "border-success/50 bg-success/5 hover:border-success"
                        : "border-base-300 hover:border-primary hover:bg-primary/5"
                } ${isProcessing ? "opacity-60 pointer-events-none cursor-not-allowed" : "cursor-pointer"}`}
                onClick={() => !isProcessing && inputRef.current?.click()}
            >
                {isProcessing ? (
                    <div className="py-4 flex flex-col items-center gap-2">
                        <span className="loading loading-spinner loading-md text-primary" />
                        <p className="text-sm opacity-60">Processing image...</p>
                    </div>
                ) : hasFile ? (
                    <div className="relative flex flex-col items-center">
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt={label}
                                className={`mx-auto object-cover rounded-lg ${field === "profilePic" ? "size-24 rounded-full" : "h-32 w-full"
                                    }`}
                            />
                        ) : (
                            // private file — no preview URL available, show placeholder
                            <div className={`flex items-center justify-center bg-base-200 rounded-lg ${field === "profilePic" ? "size-24 rounded-full" : "h-32 w-full"
                                }`}>
                                <UploadCloudIcon className="size-8 text-success" />
                            </div>
                        )}
                        <p className="text-xs opacity-60 mt-2">Click to replace</p>
                    </div>
                ) : (
                    <div className="py-4">
                        <UploadCloudIcon className="size-8 text-base-content/40 mx-auto mb-2" />
                        <p className="text-sm opacity-60">Click to upload or drag and drop</p>
                        <p className="text-xs opacity-40 mt-1">
                            PNG, JPG up to {field === "profilePic" ? "500KB" : "1MB"}
                        </p>
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
            />
            {required && !hasFile && (
                <p className="text-xs text-error mt-1">{label} is required</p>
            )}
        </div>
    );
};

// --- UPLOAD PENDING IMAGES HELPER ---
// Call this in submit handler before completeOnboarding
// imageFieldNames: array of field names that are image fields e.g. ["profilePic", "licenseImage"]
// form: current form state
// returns updated form with { url, key } replacing { file } for each image field
export const uploadPendingImages = async (form, imageFieldNames) => {
    const updated = { ...form };
    for (const fieldName of imageFieldNames) {
        const fieldValue = form[fieldName];
        if (!fieldValue?.file) continue; // already uploaded or not set
        try {
            const result = await uploadFile(fieldValue.file, fieldName);
            const { url, key } = result.data;
            if (!key) throw new Error(`Upload response missing key for ${fieldName}`);
            updated[fieldName] = { url: url || "", key };
        } catch (err) {
            toast.error(`Failed to upload ${fieldName}: ${err.message}`);
            throw err; // abort submit
        }
    }
    return updated;
};

// --- LANGUAGES FIELD ---
export const LanguagesField = ({ value = [], onChange, error }) => {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedSet = new Set(value.map((l) => l.toLowerCase()));
    const queryTrimmed = query.trim();

    const filtered = LANGUAGES.filter(
        (l) => !selectedSet.has(l.toLowerCase()) && l.toLowerCase().includes(query.toLowerCase())
    );

    const showAddNew = queryTrimmed &&
        !selectedSet.has(queryTrimmed.toLowerCase()) &&
        !LANGUAGES.some((l) => l.toLowerCase() === queryTrimmed.toLowerCase());

    const add = (lang) => {
        if (selectedSet.has(lang.toLowerCase())) return;
        onChange([...value, lang]);
        setQuery("");
    };

    const remove = (lang) => onChange(value.filter((l) => l !== lang));

    return (
        <div className="form-control" ref={dropdownRef}>
            <label className="label">
                <span className="label-text">Languages <span className="text-error">*</span></span>
            </label>
            <input
                type="text"
                className={`input input-bordered w-full ${error ? "input-error" : ""}`}
                placeholder="Search or type a language..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && (filtered.length > 0 || showAddNew) && (
                <div className="relative z-20">
                    <div className="absolute w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                        {filtered.map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                                onClick={() => add(lang)}
                            >
                                {lang}
                            </button>
                        ))}
                        {showAddNew && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 text-primary font-medium border-t border-base-300"
                                onClick={() => add(queryTrimmed)}
                            >
                                + Add "{queryTrimmed}"
                            </button>
                        )}
                    </div>
                </div>
            )}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map((lang) => (
                        <span key={lang} className="badge badge-primary gap-1 py-3">
                            {lang}
                            <button type="button" onClick={() => remove(lang)}>
                                <XIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {error && <p className="text-error text-xs mt-1">{error}</p>}
        </div>
    );
};

// --- ADDRESS FIELD ITEM ---
const AddressFieldItem = ({ label, fieldKey, placeholder, required, type = "text", maxLength, value, onChange, error, inputRef, disabled = false }) => (
    <div className="form-control">
        <label className="label py-0">
            <span className="label-text text-sm">
                {label}{required && <span className="text-error ml-1">*</span>}
            </span>
        </label>
        <input
            ref={inputRef}
            type={type}
            disabled={disabled}
            className={`input input-bordered w-full ${error ? "input-error" : ""} ${disabled ? "cursor-not-allowed" : ""}`}
            placeholder={placeholder}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(fieldKey, e.target.value)}
        />
        {error && <p className="text-error text-xs mt-0.5">{error}</p>}
    </div>
);

// --- ADDRESS FIELDS ---
// label: heading shown above the fields (default "Address", use "Business Address" for non-patient roles)
// disabled: when true all fields are read-only and the map pin button is hidden (used for clinic dept address)
export const AddressFields = ({ value = {}, onChange, errors = {}, cityRef, label = "Address", disabled = false }) => {
    const [mapOpen, setMapOpen] = useState(false);
    const update = (field, val) => { if (!disabled) onChange({ ...value, [field]: val }); };

    const handleMapConfirm = useCallback((result) => {
        onChange({
            ...value,
            ...(result.street && { street: result.street }),
            ...(result.barangay && { barangay: result.barangay }),
            ...(result.city && { city: result.city }),
            ...(result.postalCode && { postalCode: result.postalCode }),
            coordinates: result.coordinates,
        });
        toast.success("Address autofilled from pin location");
    }, [value, onChange]);

    return (
        <>
            {!disabled && (
                <MapPinModal
                    isOpen={mapOpen}
                    onClose={() => setMapOpen(false)}
                    onConfirm={handleMapConfirm}
                />
            )}
            <div className="space-y-3">
                <label className="label pb-0">
                    <span className="label-text font-medium">
                        {label}{!disabled && <span className="text-error"> *</span>}
                    </span>
                    {disabled && <span className="label-text-alt opacity-50 text-xs">Auto-filled from institute</span>}
                </label>
                {!disabled && (
                    <button
                        type="button"
                        className="btn btn-outline btn-primary btn-sm gap-2 w-full"
                        onClick={() => setMapOpen(true)}
                    >
                        <MapPinIcon className="size-4" />
                        Pin Location on Map
                    </button>
                )}

                {/* Unified 2-column grid — order: building, street, barangay, city, province, postal code */}
                <div className={`grid grid-cols-2 gap-3 ${disabled ? "opacity-60" : ""}`}>
                    <AddressFieldItem label="Building / House No." fieldKey="buildingNumber" placeholder="Unit 4B" required={!disabled} value={value.buildingNumber || ""} onChange={update} error={errors["address.buildingNumber"]} disabled={disabled} />
                    <AddressFieldItem label="Street" fieldKey="street" placeholder="Rizal Street" required={!disabled} value={value.street || ""} onChange={update} error={errors["address.street"]} disabled={disabled} />

                    {/* PSGC fields: Barangay | City / Province | [Postal Code follows] */}
                    {!disabled ? (
                        <PSGCAddressFields
                            required
                            value={{
                                province: value.province || "",
                                city: value.city || "",
                                barangay: value.barangay || "",
                                postalCode: value.postalCode || "",
                            }}
                            onChange={({ province, city, barangay, postalCode }) =>
                                onChange({ ...value, province, city, barangay, ...(postalCode ? { postalCode } : {}) })
                            }
                        />
                    ) : (
                        <>
                            <AddressFieldItem label="Barangay" fieldKey="barangay" placeholder="Barangay 1" required={false} value={value.barangay || ""} onChange={update} disabled />
                            <AddressFieldItem label="City / Municipality" fieldKey="city" placeholder="Manila" required={false} value={value.city || ""} onChange={update} disabled />
                            <AddressFieldItem label="Province" fieldKey="province" placeholder="Metro Manila" required={false} value={value.province || ""} onChange={update} disabled />
                        </>
                    )}

                    <AddressFieldItem label="Postal Code" fieldKey="postalCode" placeholder="1000" required={!disabled} value={value.postalCode || ""} onChange={update} error={errors["address.postalCode"]} maxLength={4} disabled={disabled} />
                </div>
            </div>
        </>
    );
};

// Formats 10 raw digits for display: "9171234567" → "917 123 4567"
export const formatPhoneDisplay = (digits = "") => {
    const d = digits.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
};

// --- EMAIL VERIFICATION FIELD (phone-signup onboarding only) ---
const EMAIL_REGEX_FIELD = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EmailVerificationField = ({ email, onEmailChange, onVerified, error }) => {
    const [otpInput, setOtpInput] = useState("");
    const [verified, setVerified] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [requestError, setRequestError] = useState("");
    const [isRequesting, setIsRequesting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const handleEmailChange = (e) => {
        onEmailChange(e.target.value);
        setVerified(false);
        setOtpInput("");
        setRequestError("");
        onVerified?.(false);
    };

    const openVerifyModal = async () => {
        setRequestError("");
        setIsRequesting(true);
        try {
            await requestOnboardingEmailVerify({ email });
            setOtpInput("");
            setShowModal(true);
        } catch (err) {
            setRequestError(err?.response?.data?.message || "Failed to send code.");
        } finally {
            setIsRequesting(false);
        }
    };

    const verifyCode = async () => {
        setIsConfirming(true);
        try {
            await confirmOnboardingEmailVerify({ code: otpInput });
            setVerified(true);
            onVerified?.(true);
            setShowModal(false);
        } catch (err) {
            setOtpInput("");
            toast.error(err?.response?.data?.message || "Incorrect code. Try again.");
        } finally {
            setIsConfirming(false);
        }
    };

    const canSend = EMAIL_REGEX_FIELD.test(email) && !isRequesting;

    return (
        <div className="form-control space-y-2">
            <label className="label pb-0">
                <span className="label-text">
                    Email Address <span className="text-error">*</span>
                </span>
                {verified && (
                    <span className="flex items-center gap-1 text-success text-xs font-medium">
                        <CheckCircleIcon className="size-3.5" /> Verified
                    </span>
                )}
            </label>
            <div className="flex gap-2">
                <input
                    type="email"
                    className={`input input-bordered flex-1 ${error ? "input-error" : ""} ${verified ? "input-success" : ""}`}
                    placeholder="name@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    disabled={verified}
                />
                {!verified && (
                    <button type="button" className="btn btn-outline btn-sm h-12" disabled={!canSend} onClick={openVerifyModal}>
                        {isRequesting ? <span className="loading loading-spinner loading-xs" /> : "Verify"}
                    </button>
                )}
            </div>
            {error && <p className="text-error text-xs">{error}</p>}
            {requestError && <p className="text-error text-xs">{requestError}</p>}
            {!verified && EMAIL_REGEX_FIELD.test(email) && (
                <p className="text-xs opacity-50">
                    Verify your email to enable login with email and 2FA.
                </p>
            )}

            {showModal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => setShowModal(false)}>
                            <XIcon className="size-4" />
                        </button>
                        <h3 className="font-bold text-lg mb-1">Verify Email Address</h3>
                        <p className="text-sm opacity-60 mb-4">
                            Enter the 6-digit code sent to <span className="font-medium text-primary">{email}</span>.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-bordered flex-1 text-center font-mono tracking-widest"
                                placeholder="Enter 6-digit code"
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                maxLength={6}
                                autoFocus
                            />
                            <button type="button" className="btn btn-primary" disabled={otpInput.length !== 6 || isConfirming} onClick={verifyCode}>
                                {isConfirming ? <span className="loading loading-spinner loading-xs" /> : "Verify"}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowModal(false)} />
                </div>
            )}
        </div>
    );
};

// --- PHONE NUMBER FIELD ---
export const PhoneField = ({ phoneNumber, phoneType, onNumberChange, onTypeChange, error, onVerified }) => {
    const isMobile = phoneType === "mobile";
    const [mockOtp, setMockOtp] = useState(null);
    const [otpInput, setOtpInput] = useState("");
    const [verified, setVerified] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [requestError, setRequestError] = useState("");
    const [isRequesting, setIsRequesting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    const handleNumberInput = (e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        onNumberChange(digits);
        setMockOtp(null);
        setOtpInput("");
        setVerified(false);
        setRequestError("");
        onVerified?.(false);
    };

    const openVerifyModal = async () => {
        setRequestError("");
        setIsRequesting(true);
        try {
            const data = await requestPhoneVerify({ phoneNumber: "0" + phoneNumber, phoneType });
            setMockOtp(data?.data?.mockCode || null);
            setOtpInput("");
            setShowModal(true);
        } catch (err) {
            setRequestError(err?.response?.data?.message || "Failed to send verification code.");
        } finally {
            setIsRequesting(false);
        }
    };

    const verifyCode = async () => {
        setIsConfirming(true);
        try {
            await confirmPhoneVerify({ code: otpInput });
            setVerified(true);
            onVerified?.(true);
            setShowModal(false);
        } catch (err) {
            setOtpInput("");
            toast.error(err?.response?.data?.message || "Incorrect code. Try again.");
        } finally {
            setIsConfirming(false);
        }
    };

    const canSend = isMobile && phoneNumber.length === 10 && !isRequesting;

    return (
        <div className="form-control space-y-2">
            <label className="label pb-0">
                <span className="label-text">
                    Phone Number <span className="text-error">*</span>
                </span>
                {verified && (
                    <span className="flex items-center gap-1 text-success text-xs font-medium">
                        <CheckCircleIcon className="size-3.5" /> Verified
                    </span>
                )}
            </label>
            <div className="flex gap-2">
                <select
                    className="select select-bordered w-32 flex-shrink-0"
                    value={phoneType}
                    onChange={(e) => { onTypeChange(e.target.value); setMockOtp(null); setVerified(false); onVerified?.(false); }}
                    disabled={verified}
                >
                    <option value="mobile">Mobile</option>
                    <option value="telephone">Telephone</option>
                </select>
                <div className="relative flex-1">
                    {isMobile && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60 font-medium pointer-events-none">+63</span>
                    )}
                    <input
                        type="tel"
                        className={`input input-bordered w-full ${isMobile ? "pl-12" : ""} ${error ? "input-error" : ""} ${verified ? "input-success" : ""}`}
                        placeholder={isMobile ? "917 123 4567" : "028123456"}
                        value={isMobile ? formatPhoneDisplay(phoneNumber) : phoneNumber}
                        onChange={handleNumberInput}
                        maxLength={isMobile ? 12 : 10}
                        disabled={verified}
                    />
                </div>
                {!verified && (
                    <button type="button" className="btn btn-outline btn-sm h-12" disabled={!canSend} onClick={openVerifyModal}>
                        {isRequesting ? <span className="loading loading-spinner loading-xs" /> : "Verify"}
                    </button>
                )}
            </div>
            {error && <p className="text-error text-xs">{error}</p>}
            {requestError && <p className="text-error text-xs">{requestError}</p>}

            {/* Note for unverified phone */}
            {!verified && phoneNumber.length === 10 && isMobile && (
                <p className="text-xs opacity-50">
                    Without verification, this number cannot be used for login or 2FA. You can verify later in Settings.
                </p>
            )}

            {/* Verification popup */}
            {showModal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <button
                            type="button"
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => setShowModal(false)}
                        >
                            <XIcon className="size-4" />
                        </button>
                        <h3 className="font-bold text-lg mb-1">Verify Phone Number</h3>
                        <p className="text-sm opacity-60 mb-4">Enter the 6-digit code to confirm your mobile number.</p>

                        <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 mb-4">
                            <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                            <p className="text-xs opacity-80">
                                <strong>⚠ Demo mode</strong> — No SMS sent. Your code:{" "}
                                <strong className="font-mono text-base">{mockOtp}</strong>
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-bordered flex-1 text-center font-mono tracking-widest"
                                placeholder="Enter 6-digit code"
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                maxLength={6}
                                autoFocus
                            />
                            <button type="button" className="btn btn-primary" disabled={otpInput.length !== 6 || isConfirming} onClick={verifyCode}>
                                {isConfirming ? <span className="loading loading-spinner loading-xs" /> : "Verify"}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setShowModal(false)} />
                </div>
            )}
        </div>
    );
};