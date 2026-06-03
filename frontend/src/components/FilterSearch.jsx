import { useState, useRef, useEffect } from "react";
import { FilterIcon, XIcon, ChevronDownIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { LANGUAGES } from "../constants/index.js";

const fetchSpecialties = () => axiosInstance.get("/specialties").then(r => r.data?.items || []);
const fetchSubspecialties = (specialtyId) =>
    axiosInstance.get(`/specialties/${specialtyId}/subspecialties`).then(r => r.data?.items || []);
const fetchDeptTypes = () => axiosInstance.get("/services/department-types").then(r => r.data?.items || []);
const fetchServices = (deptTypeId) =>
    axiosInstance.get(`/services/${deptTypeId}/services`).then(r => r.data?.items || []);

const FilterSearch = ({ mode = "doctor", onFilterChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // ── Doctor filters ─────────────────────────────────────────────────────
    const [sex, setSex] = useState("");
    const [specialtyId, setSpecialtyId] = useState("");
    const [subspecialtyId, setSubspecialtyId] = useState("");
    const [selectedLanguages, setSelectedLanguages] = useState([]);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

    // ── Institute filters ──────────────────────────────────────────────────
    const [instituteType, setInstituteType] = useState("");
    const [departmentTypeId, setDepartmentTypeId] = useState("");
    const [serviceId, setServiceId] = useState("");

    // Specialty data (doctor mode)
    const { data: specialties = [] } = useQuery({
        queryKey: ["specialties-search"],
        queryFn: fetchSpecialties,
        enabled: mode === "doctor",
        staleTime: 5 * 60 * 1000,
    });

    const { data: subspecialties = [] } = useQuery({
        queryKey: ["subspecialties-search", specialtyId],
        queryFn: () => fetchSubspecialties(specialtyId),
        enabled: mode === "doctor" && Boolean(specialtyId),
    });

    // Department type data (institute mode)
    const { data: deptTypes = [] } = useQuery({
        queryKey: ["dept-types-search"],
        queryFn: fetchDeptTypes,
        enabled: mode === "institute",
        staleTime: 5 * 60 * 1000,
    });

    const { data: services = [] } = useQuery({
        queryKey: ["services-search", departmentTypeId],
        queryFn: () => fetchServices(departmentTypeId),
        enabled: mode === "institute" && Boolean(departmentTypeId),
    });

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Notify parent
    useEffect(() => {
        if (mode === "doctor") {
            onFilterChange({ sex, specialtyId, subspecialtyId, languages: selectedLanguages, minPrice, maxPrice });
        } else {
            onFilterChange({ type: instituteType, departmentTypeId, serviceId, minPrice, maxPrice });
        }
    }, [mode, sex, specialtyId, subspecialtyId, selectedLanguages, minPrice, maxPrice, instituteType, departmentTypeId, serviceId]);

    const clearAll = () => {
        setSex(""); setSpecialtyId(""); setSubspecialtyId(""); setSelectedLanguages([]);
        setMinPrice(""); setMaxPrice("");
        setInstituteType(""); setDepartmentTypeId(""); setServiceId("");
    };

    const toggleLanguage = (lang) =>
        setSelectedLanguages((prev) =>
            prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
        );

    const activeCount = mode === "doctor"
        ? (sex ? 1 : 0) + (specialtyId ? 1 : 0) + (subspecialtyId ? 1 : 0) + selectedLanguages.length + (minPrice || maxPrice ? 1 : 0)
        : (instituteType ? 1 : 0) + (departmentTypeId ? 1 : 0) + (serviceId ? 1 : 0) + (minPrice || maxPrice ? 1 : 0);

    return (
        <div className="relative" ref={dropdownRef}>
            <button className="btn btn-outline gap-2" onClick={() => setIsOpen(!isOpen)}>
                <FilterIcon className="w-5 h-5" />
                Filters
                {activeCount > 0 && <div className="badge badge-primary badge-sm">{activeCount}</div>}
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-base-200 rounded-lg shadow-xl z-50 max-h-[600px] overflow-y-auto">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg">Filters</h3>
                            <div className="flex gap-2">
                                <button className="btn btn-ghost btn-xs" disabled={activeCount === 0} onClick={clearAll}>
                                    Clear All
                                </button>
                                <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setIsOpen(false)}>
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* ── DOCTOR FILTERS ─────────────────────────────── */}
                        {mode === "doctor" && (
                            <>
                                {/* Sex */}
                                <div>
                                    <p className="font-semibold mb-2 text-sm">Sex</p>
                                    <div className="flex gap-2">
                                        {["", "male", "female"].map((v) => (
                                            <button
                                                key={v}
                                                className={`btn btn-xs flex-1 ${sex === v ? "btn-primary" : "btn-ghost"}`}
                                                onClick={() => setSex(v)}
                                            >
                                                {v === "" ? "Any" : v.charAt(0).toUpperCase() + v.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="divider my-1" />

                                {/* Specialty */}
                                <div>
                                    <p className="font-semibold mb-2 text-sm">Specialty</p>
                                    <select
                                        className="select select-bordered select-sm w-full"
                                        value={specialtyId}
                                        onChange={(e) => { setSpecialtyId(e.target.value); setSubspecialtyId(""); }}
                                    >
                                        <option value="">Any specialty</option>
                                        {specialties.map((s) => (
                                            <option key={s._id} value={s._id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subspecialty */}
                                {specialtyId && (
                                    <div>
                                        <p className="font-semibold mb-2 text-sm">Subspecialty</p>
                                        <select
                                            className="select select-bordered select-sm w-full"
                                            value={subspecialtyId}
                                            onChange={(e) => setSubspecialtyId(e.target.value)}
                                        >
                                            <option value="">Any subspecialty</option>
                                            {subspecialties.map((s) => (
                                                <option key={s._id} value={s._id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="divider my-1" />

                                {/* Languages */}
                                <div>
                                    <p className="font-semibold mb-2 text-sm">Languages</p>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                        {LANGUAGES.map((lang) => (
                                            <label key={lang} className="flex items-center gap-2 cursor-pointer text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-primary checkbox-xs"
                                                    checked={selectedLanguages.includes(lang)}
                                                    onChange={() => toggleLanguage(lang)}
                                                />
                                                {lang}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── INSTITUTE FILTERS ──────────────────────────── */}
                        {mode === "institute" && (
                            <>
                                {/* Type */}
                                <div>
                                    <p className="font-semibold mb-2 text-sm">Type</p>
                                    <div className="flex gap-2">
                                        {["", "clinic", "hospital"].map((v) => (
                                            <button
                                                key={v}
                                                className={`btn btn-xs flex-1 ${instituteType === v ? "btn-primary" : "btn-ghost"}`}
                                                onClick={() => setInstituteType(v)}
                                            >
                                                {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="divider my-1" />

                                {/* Department Type */}
                                <div>
                                    <p className="font-semibold mb-2 text-sm">Department Type</p>
                                    <select
                                        className="select select-bordered select-sm w-full"
                                        value={departmentTypeId}
                                        onChange={(e) => { setDepartmentTypeId(e.target.value); setServiceId(""); }}
                                    >
                                        <option value="">Any department</option>
                                        {deptTypes.map((d) => (
                                            <option key={d._id} value={d._id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Service */}
                                {departmentTypeId && (
                                    <div>
                                        <p className="font-semibold mb-2 text-sm">Service</p>
                                        <select
                                            className="select select-bordered select-sm w-full"
                                            value={serviceId}
                                            onChange={(e) => setServiceId(e.target.value)}
                                        >
                                            <option value="">Any service</option>
                                            {services.map((s) => (
                                                <option key={s._id} value={s._id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="divider my-1" />

                        {/* Price range (both modes) */}
                        <div>
                            <p className="font-semibold mb-2 text-sm">Price Range (₱)</p>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="input input-bordered input-sm w-full"
                                    min={0}
                                />
                                <span className="text-sm opacity-60">–</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="input input-bordered input-sm w-full"
                                    min={0}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterSearch;
