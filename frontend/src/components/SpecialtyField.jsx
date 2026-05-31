// frontend/src/components/SpecialtyField.jsx
import { useState, useEffect, useRef } from "react";
import { XIcon, ClockIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";

// Fetches verified specialties from DB
async function fetchSpecialties() {
    const res = await axiosInstance.get("/specialties-and-services/specialties");
    return res.data?.data?.items || [];
}

// Fetches verified subspecialties under a specialty
async function fetchSubspecialties(specialtyId) {
    const res = await axiosInstance.get(`/specialties-and-services/subspecialties/${specialtyId}`);
    return res.data?.data?.items || [];
}

// Submits a new specialty suggestion — called on form submit, not on add
export async function suggestSpecialty(name) {
    const res = await axiosInstance.post("/specialties-and-services/suggest", {
        name,
        type: "specialty",
    });
    return res.data?.data?.item;
}

// Submits a new subspecialty suggestion — called on form submit, not on add
export async function suggestSubspecialty(name, rootSpecialtyId) {
    const res = await axiosInstance.post("/specialties-and-services/suggest", {
        name,
        type: "subspecialty",
        rootSpecialtyId,
    });
    return res.data?.data?.item;
}

// SpecialtyField — select or create specialties
// value: [{ _id, name, status, isNew? }]
export const SpecialtyField = ({ value = [], onChange }) => {
    const [dbSpecialties, setDbSpecialties] = useState([]);
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchSpecialties().then(setDbSpecialties).catch(() => { });
    }, []);

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

    const selectedIds = new Set(value.map((s) => s._id).filter(Boolean));
    const selectedNames = new Set(value.map((s) => s.name.toLowerCase()));

    const filtered = dbSpecialties.filter(
        (s) => !selectedIds.has(s._id) && s.name.toLowerCase().includes(query.toLowerCase())
    );

    const queryTrimmed = query.trim();
    const showAddNew = queryTrimmed && !selectedNames.has(queryTrimmed.toLowerCase()) &&
        !dbSpecialties.some((s) => s.name.toLowerCase() === queryTrimmed.toLowerCase());

    const selectExisting = (specialty) => {
        onChange([...value, { _id: specialty._id, name: specialty.name, status: "verified", isNew: false }]);
        setQuery("");
        setIsOpen(false);
    };

    const addNew = () => {
        if (!queryTrimmed) return;
        // store locally, no DB call yet
        onChange([...value, { _id: null, name: queryTrimmed, status: "pending", isNew: true }]);
        setQuery("");
        setIsOpen(false);
    };

    const remove = (name) => onChange(value.filter((s) => s.name !== name));

    return (
        <div className="form-control" ref={dropdownRef}>
            <label className="label">
                <span className="label-text">Specialty <span className="text-error">*</span></span>
            </label>
            <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Search or type a specialty..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && (filtered.length > 0 || showAddNew) && (
                <div className="relative z-20">
                    <div className="absolute w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                        {filtered.map((s) => (
                            <button
                                key={s._id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                                onClick={() => selectExisting(s)}
                            >
                                {s.name}
                            </button>
                        ))}
                        {showAddNew && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 text-primary font-medium border-t border-base-300"
                                onClick={addNew}
                            >
                                + Add "{queryTrimmed}" as new specialty
                            </button>
                        )}
                    </div>
                </div>
            )}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map((s) => (
                        <span
                            key={s.name}
                            className={`badge gap-1 py-3 ${s.isNew ? "badge-outline badge-primary" : "badge-primary"}`}
                        >
                            {s.isNew && <ClockIcon className="size-3 opacity-60" />}
                            {s.name}
                            <button type="button" onClick={() => remove(s.name)}>
                                <XIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

// SubspecialtyField — select or create subspecialties, scoped to selected specialties
// selectedSpecialties: [{ _id, name, status, isNew? }]
// value: [{ _id, name, status, rootSpecialtyId, rootSpecialtyName, isNew? }]
export const SubspecialtyField = ({ value = [], onChange, selectedSpecialties = [] }) => {
    const [dbSubspecialties, setDbSubspecialties] = useState({}); // { specialtyId: [subspecialty] }
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [pendingRootSpecialty, setPendingRootSpecialty] = useState(null); // when typing new, ask which specialty
    const dropdownRef = useRef(null);

    // fetch subspecialties for all verified selected specialties
    useEffect(() => {
        const verifiedSpecialties = selectedSpecialties.filter((s) => !s.isNew && s._id);
        verifiedSpecialties.forEach(async (s) => {
            if (dbSubspecialties[s._id]) return;
            try {
                const items = await fetchSubspecialties(s._id);
                setDbSubspecialties((prev) => ({ ...prev, [s._id]: items }));
            } catch { }
        });
    }, [selectedSpecialties]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setQuery("");
                setPendingRootSpecialty(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (selectedSpecialties.length === 0) return null;

    const selectedNames = new Set(value.map((s) => s.name.toLowerCase()));

    // all available subspecialties across all selected specialties
    const allAvailable = selectedSpecialties.flatMap((spec) => {
        const items = spec._id ? (dbSubspecialties[spec._id] || []) : [];
        return items.map((sub) => ({ ...sub, rootSpecialtyId: spec._id, rootSpecialtyName: spec.name }));
    }).filter((sub) => !selectedNames.has(sub.name.toLowerCase()));

    const filtered = allAvailable.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
    );

    const queryTrimmed = query.trim();
    const showAddNew = queryTrimmed &&
        !selectedNames.has(queryTrimmed.toLowerCase()) &&
        !allAvailable.some((s) => s.name.toLowerCase() === queryTrimmed.toLowerCase());

    const selectExisting = (sub) => {
        onChange([...value, {
            _id: sub._id,
            name: sub.name,
            status: "verified",
            rootSpecialtyId: sub.rootSpecialtyId,
            rootSpecialtyName: sub.rootSpecialtyName,
            isNew: false,
        }]);
        setQuery("");
        setIsOpen(false);
    };

    const confirmNewSubspecialty = (rootSpecialty) => {
        onChange([...value, {
            _id: null,
            name: queryTrimmed,
            status: "pending",
            rootSpecialtyId: rootSpecialty._id, // null if rootSpecialty is also new
            rootSpecialtyName: rootSpecialty.name,
            isNew: true,
        }]);
        setQuery("");
        setIsOpen(false);
        setPendingRootSpecialty(null);
    };

    const remove = (name) => onChange(value.filter((s) => s.name !== name));

    return (
        <div className="form-control" ref={dropdownRef}>
            <label className="label">
                <span className="label-text">Subspecialty <span className="opacity-50 text-xs">(optional)</span></span>
            </label>
            <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Search or type a subspecialty..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setPendingRootSpecialty(null); }}
                onFocus={() => setIsOpen(true)}
            />
            {isOpen && !pendingRootSpecialty && (filtered.length > 0 || showAddNew) && (
                <div className="relative z-20">
                    <div className="absolute w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                        {filtered.map((s) => (
                            <button
                                key={`${s._id}-${s.rootSpecialtyId}`}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                                onClick={() => selectExisting(s)}
                            >
                                <span>{s.name}</span>
                                <span className="text-xs opacity-50 ml-2">under {s.rootSpecialtyName}</span>
                            </button>
                        ))}
                        {showAddNew && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 text-primary font-medium border-t border-base-300"
                                onClick={() => setPendingRootSpecialty("selecting")}
                            >
                                + Add "{queryTrimmed}" as new subspecialty
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Root specialty selector for new subspecialty */}
            {pendingRootSpecialty === "selecting" && (
                <div className="relative z-20">
                    <div className="absolute w-full bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1">
                        <p className="px-3 py-2 text-xs opacity-60 border-b border-base-300">
                            Which specialty does "{queryTrimmed}" fall under?
                        </p>
                        {selectedSpecialties.map((spec) => (
                            <button
                                key={spec.name}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 flex items-center gap-2"
                                onClick={() => confirmNewSubspecialty(spec)}
                            >
                                {spec.isNew && <ClockIcon className="size-3 opacity-50" />}
                                {spec.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map((s) => (
                        <span
                            key={s.name}
                            className={`badge gap-1 py-3 ${s.isNew ? "badge-outline badge-primary" : "badge-primary"}`}
                            title={`under ${s.rootSpecialtyName}`}
                        >
                            {s.isNew && <ClockIcon className="size-3 opacity-60" />}
                            {s.name}
                            <button type="button" onClick={() => remove(s.name)}>
                                <XIcon className="size-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};