import { useState, useRef } from "react";
import { UploadCloudIcon, XIcon, PlusIcon, ArrowLeftIcon } from "lucide-react";
import imageCompression from "browser-image-compression";
import { uploadFile } from "../lib/api";
import toast from "react-hot-toast";
import { LANGUAGES } from "../constants";

// --- STEP PROGRESS BAR ---
export const StepProgress = ({ currentStep, totalSteps }) => (
    <div className="flex items-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${i < currentStep ? "bg-primary" : "bg-base-300"
                    }`}
            />
        ))}
    </div>
);

// --- STEP HEADER ---
export const StepHeader = ({ title, subtitle, role, email, onBack, isFirstStep }) => (
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
                <label className="label py-0"><span className="label-text text-xs">Email</span></label>
                <input
                    type="email"
                    value={email || ""}
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
export const ImageUploadField = ({ label, field, value, onChange, required = false, onUploadingChange }) => {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        setUploading(true);
        if (onUploadingChange) onUploadingChange(true);
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: field === "profilePic" ? 0.5 : 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            });
            const result = await uploadFile(compressed, field);
            // sendSuccess wraps as { success, message, data: { url, key } }
            const { url, key } = result.data;
            if (!url && !key) throw new Error("Upload response missing url/key");
            onChange({ url, key });
            toast.success(`${label} uploaded successfully`);
        } catch (err) {
            toast.error(`Failed to upload ${label}: ${err.message}`);
            console.error(err);
        } finally {
            setUploading(false);
            if (onUploadingChange) onUploadingChange(false);
        }
    };

    const isUploaded = value?.url && value.url !== "";

    return (
        <div className="form-control">
            <label className="label">
                <span className="label-text">
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                </span>
                {isUploaded && (
                    <span className="label-text-alt text-success text-xs">✓ Uploaded</span>
                )}
            </label>
            <div
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${uploading
                        ? "opacity-60 pointer-events-none border-base-300"
                        : isUploaded
                            ? "border-success/50 bg-success/5 cursor-pointer hover:border-success"
                            : "border-base-300 cursor-pointer hover:border-primary hover:bg-primary/5"
                    }`}
                onClick={() => !uploading && inputRef.current?.click()}
            >
                {isUploaded ? (
                    <div className="relative">
                        <img
                            src={value.url}
                            alt={label}
                            className={`mx-auto object-cover rounded-lg ${field === "profilePic" ? "size-24 rounded-full" : "h-32 w-full"
                                }`}
                        />
                        <p className="text-xs opacity-60 mt-2">Click to replace</p>
                    </div>
                ) : (
                    <div className="py-4">
                        {uploading ? (
                            <div className="flex flex-col items-center gap-2">
                                <span className="loading loading-spinner loading-md text-primary" />
                                <p className="text-sm opacity-60">Uploading...</p>
                            </div>
                        ) : (
                            <>
                                <UploadCloudIcon className="size-8 text-base-content/40 mx-auto mb-2" />
                                <p className="text-sm opacity-60">Click to upload or drag and drop</p>
                                <p className="text-xs opacity-40 mt-1">
                                    PNG, JPG up to {field === "profilePic" ? "500KB" : "1MB"}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture={field === "profilePic" ? "user" : undefined}
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
            />
            {required && !isUploaded && !uploading && (
                <p className="text-xs text-error mt-1">Please upload {label}</p>
            )}
        </div>
    );
};

// --- LANGUAGES MULTI-SELECT ---
export const LanguagesField = ({ value = [], onChange, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [otherText, setOtherText] = useState("");
    const dropdownRef = useRef(null);

    const toggleLanguage = (lang) => {
        const updated = value.includes(lang)
            ? value.filter((l) => l !== lang)
            : [...value, lang];
        onChange(updated);
    };

    const addOther = () => {
        const trimmed = otherText.trim();
        if (!trimmed) return;
        if (value.includes(trimmed)) { toast.error("Language already added"); return; }
        onChange([...value, trimmed]);
        setOtherText("");
    };

    // close on outside click
    const handleBlur = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.relatedTarget)) {
            setIsOpen(false);
        }
    };

    return (
        <div className="form-control" ref={dropdownRef} onBlur={handleBlur} tabIndex={-1}>
            <label className="label">
                <span className="label-text">Languages <span className="text-error">*</span></span>
            </label>
            <div
                className={`select select-bordered w-full cursor-pointer flex items-center ${error ? "select-error" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {value.length > 0 ? value.join(", ") : "Select languages"}
            </div>

            {isOpen && (
                <div className="relative z-20">
                    <div className="absolute w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                        {LANGUAGES.map((lang) => (
                            <label key={lang} className="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm checkbox-primary"
                                    checked={value.includes(lang)}
                                    onChange={() => toggleLanguage(lang)}
                                />
                                <span className="text-sm">{lang}</span>
                            </label>
                        ))}
                        <div className="flex items-center gap-2 px-3 py-2 border-t border-base-300">
                            <input
                                type="text"
                                placeholder="Other language..."
                                className="input input-bordered input-xs flex-1"
                                value={otherText}
                                onChange={(e) => setOtherText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOther())}
                            />
                            <button type="button" className="btn btn-primary btn-xs" onClick={addOther}>
                                <PlusIcon className="size-3" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map((lang) => (
                        <span key={lang} className="badge badge-primary badge-outline gap-1">
                            {lang}
                            <button type="button" onClick={() => toggleLanguage(lang)}>
                                <XIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            {error && <p className="text-error text-xs mt-1">{error}</p>}
            <small className="text-xs opacity-50 mt-1">Click to select multiple languages</small>
        </div>
    );
};

// --- ADDRESS FIELDS ---
export const AddressFields = ({ value = {}, onChange, errors = {} }) => {
    const update = (field, val) => onChange({ ...value, [field]: val });

    const Field = ({ label, fieldKey, placeholder, required, type = "text", maxLength }) => (
        <div className="form-control">
            <label className="label py-0">
                <span className="label-text text-xs">
                    {label}{required && <span className="text-error ml-1">*</span>}
                </span>
            </label>
            <input
                type={type}
                className={`input input-bordered w-full input-sm ${errors[fieldKey] ? "input-error" : ""}`}
                placeholder={placeholder}
                value={value[fieldKey] || ""}
                maxLength={maxLength}
                onChange={(e) => update(fieldKey, e.target.value)}
            />
            {errors[fieldKey] && <p className="text-error text-xs mt-0.5">{errors[fieldKey]}</p>}
        </div>
    );

    return (
        <div className="space-y-3">
            <label className="label">
                <span className="label-text font-medium">
                    Address <span className="text-error">*</span>
                </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Building / House No." fieldKey="buildingNumber" placeholder="Unit 4B" />
                <Field label="Street" fieldKey="street" placeholder="Rizal Street" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Barangay" fieldKey="barangay" placeholder="Barangay 1" required />
                <Field label="City" fieldKey="city" placeholder="Manila" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Province" fieldKey="province" placeholder="Metro Manila" required />
                <Field label="Postal Code" fieldKey="postalCode" placeholder="1000" required type="text" maxLength={4} />
            </div>
            {errors.postalCode && <p className="text-error text-xs">{errors.postalCode}</p>}
            {/* FLAG: map pin button — GeoJSON coordinates deferred */}
            <button
                type="button"
                className="btn btn-outline btn-sm gap-2 w-full"
                onClick={() => toast("Map pinning coming soon!")}
            >
                📍 Pin Location on Map
                <span className="badge badge-warning badge-xs">Coming Soon</span>
            </button>
        </div>
    );
};

// --- PHONE NUMBER FIELD ---
export const PhoneField = ({ phoneNumber, phoneType, onNumberChange, onTypeChange, error }) => {
    const handleNumberInput = (e) => {
        // strip everything except digits
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        onNumberChange(digits);
    };

    return (
        <div className="form-control">
            <label className="label">
                <span className="label-text">
                    Phone Number <span className="text-error">*</span>
                </span>
            </label>
            <div className="flex gap-2">
                <select
                    className="select select-bordered w-32 flex-shrink-0"
                    value={phoneType}
                    onChange={(e) => onTypeChange(e.target.value)}
                >
                    <option value="mobile">Mobile</option>
                    <option value="telephone">Telephone</option>
                </select>
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60 font-medium pointer-events-none">
                        +63
                    </span>
                    <input
                        type="tel"
                        className={`input input-bordered w-full pl-12 ${error ? "input-error" : ""}`}
                        placeholder="9171234567"
                        value={phoneNumber}
                        onChange={handleNumberInput}
                        maxLength={10}
                    />
                </div>
            </div>
            {error && <p className="text-error text-xs mt-1">{error}</p>}
            <small className="text-xs opacity-50 mt-1">
                10-digit number without +63 — letters and symbols are removed automatically
            </small>
        </div>
    );
};