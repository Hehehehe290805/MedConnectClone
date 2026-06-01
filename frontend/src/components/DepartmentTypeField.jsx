// frontend/src/components/DepartmentTypeField.jsx
import { useState, useEffect, useRef } from "react";
import { XIcon, ClockIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";

async function fetchDepartmentTypes() {
    const res = await axiosInstance.get("/services");
    return res.data?.data?.items || [];
}

export async function suggestDepartmentType(name) {
    const res = await axiosInstance.post("/services/suggest", { name, type: "departmentType" });
    return res.data?.data?.item;
}

export const DepartmentTypeField = ({ value = [], onChange, isClinic = false }) => {
    const [dbTypes, setDbTypes] = useState([]);
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchDepartmentTypes().then(setDbTypes).catch(() => {});
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
    const atLimit = isClinic && value.length >= 1;

    const filtered = dbTypes.filter(
        (s) => !selectedIds.has(s._id) && s.name.toLowerCase().includes(query.toLowerCase())
    );

    const queryTrimmed = query.trim();
    const showAddNew = !atLimit && queryTrimmed &&
        !selectedNames.has(queryTrimmed.toLowerCase()) &&
        !dbTypes.some((s) => s.name.toLowerCase() === queryTrimmed.toLowerCase());

    const selectExisting = (type) => {
        if (atLimit) return;
        onChange([...value, { _id: type._id, name: type.name, status: "verified", isNew: false }]);
        setQuery("");
        setIsOpen(false);
    };

    const addNew = () => {
        if (!queryTrimmed || atLimit) return;
        onChange([...value, { _id: null, name: queryTrimmed, status: "pending", isNew: true }]);
        setQuery("");
        setIsOpen(false);
    };

    const remove = (name) => onChange(value.filter((s) => s.name !== name));

    return (
        <div className="form-control relative" ref={dropdownRef}>
            <label className="label">
                <span className="label-text">
                    Department Types <span className="text-error">*</span>
                    {isClinic && <span className="text-xs opacity-50 ml-2">Clinics can only have one department</span>}
                </span>
            </label>
            <input
                type="text"
                className="input input-bordered w-full"
                placeholder={atLimit ? "Remove current selection to change" : "Search or type a department type..."}
                value={query}
                disabled={atLimit}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onFocus={() => { if (!atLimit) setIsOpen(true); }}
            />
            {isOpen && !atLimit && (filtered.length > 0 || showAddNew) && (
                <div className="absolute z-20 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1 top-full">
                    {filtered.map((s) => (
                        <button key={s._id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-base-200" onClick={() => selectExisting(s)}>
                            {s.name}
                        </button>
                    ))}
                    {showAddNew && (
                        <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 text-primary font-medium border-t border-base-300" onClick={addNew}>
                            + Add "{queryTrimmed}" as new department type
                        </button>
                    )}
                </div>
            )}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {value.map((s) => (
                        <span key={s.name} className={`badge gap-1 py-3 ${s.isNew ? "badge-outline badge-primary" : "badge-primary"}`}>
                            {s.isNew && <ClockIcon className="size-3 opacity-60" />}
                            {s.name}
                            <button type="button" onClick={() => remove(s.name)}><XIcon className="size-3" /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};