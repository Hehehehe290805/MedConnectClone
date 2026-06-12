import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios.js";
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";


// Confirmation modal — admin must type the item name to confirm destructive actions
const ConfirmModal = ({ title, message, confirmLabel = "Confirm", onConfirm, onClose, danger = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm opacity-70">{message}</p>
            <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <button className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
            </div>
        </div>
    </div>
);

// Inline editable row for list items
const EditableRow = ({ name, onSave, onDelete }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!value.trim() || value.trim() === name) { setEditing(false); return; }
        setSaving(true);
        try {
            await onSave(value.trim());
            setEditing(false);
        } catch (err) {
            setValue(name);
            toast.error(err?.response?.data?.message || "Save failed.");
        }
        finally { setSaving(false); }
    };

    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-base-100 border border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.12)] hover:bg-base-200 group">
            {editing ? (
                <>
                    <input
                        className="input input-xs input-bordered flex-1"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(name); setEditing(false); } }}
                        autoFocus
                        disabled={saving}
                    />
                    <button className="btn btn-xs btn-success" onClick={handleSave} disabled={saving}><CheckIcon className="size-3" /></button>
                    <button className="btn btn-xs btn-ghost" onClick={() => { setValue(name); setEditing(false); }}><XIcon className="size-3" /></button>
                </>
            ) : (
                <>
                    <span className="flex-1 text-sm">{name}</span>
                    <button className="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100" onClick={() => setEditing(true)}><PencilIcon className="size-3" /></button>
                    <button className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100" onClick={onDelete}><Trash2Icon className="size-3" /></button>
                </>
            )}
        </div>
    );
};

// Add form for creating a new item with double-confirm
const AddForm = ({ placeholder, onAdd, loading }) => {
    const [value, setValue] = useState("");
    const [confirm, setConfirm] = useState(false);

    const handleSubmit = () => {
        if (!value.trim()) return;
        if (!confirm) { setConfirm(true); return; }
        onAdd(value.trim());
        setValue("");
        setConfirm(false);
    };

    return (
        <div className="flex items-center gap-2">
            <input
                className="input input-sm input-bordered flex-1"
                placeholder={placeholder}
                value={value}
                onChange={e => { setValue(e.target.value); setConfirm(false); }}
            />
            <button
                className={`btn btn-sm ${confirm ? "btn-warning" : "btn-primary"}`}
                disabled={!value.trim() || loading}
                onClick={handleSubmit}
            >
                {confirm ? "Confirm?" : <><PlusIcon className="size-3" />Add</>}
            </button>
            {confirm && (
                <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(false)}><XIcon className="size-3" /></button>
            )}
        </div>
    );
};

const TABS = ["Specialties", "Subspecialties", "Department Types", "Services"];

const AdminSpecialtiesPage = () => {
    const [activeTab, setActiveTab] = useState("Specialties");
    const [data, setData] = useState({ specialties: [], subspecialties: [], departmentTypes: [], services: [] });
    const [loading, setLoading] = useState(true);
    const [mutating, setMutating] = useState(false);

    // For subspecialties/services — parent selector
    const [selectedSpecialty, setSelectedSpecialty] = useState("");
    const [selectedDeptType, setSelectedDeptType] = useState("");

    const [deleteTarget, setDeleteTarget] = useState(null); // { type, id, name }

    const fetch = async () => {
        try {
            const res = await axiosInstance.get("/admin/specialty-tree");
            if (res.data.success) setData(res.data.data);
        } catch {
            toast.error("Failed to load data.");
        } finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, []);

    // ── create ──────────────────────────────────────────────────────────────

    const createSpecialty = async (name) => {
        setMutating(true);
        try {
            const res = await axiosInstance.post("/admin/specialties", { name });
            setData(d => ({ ...d, specialties: [...d.specialties, res.data.data.specialty].sort((a, b) => a.name.localeCompare(b.name)) }));
            toast.success(`"${name}" added.`);
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
        finally { setMutating(false); }
    };

    const createSubspecialty = async (name) => {
        if (!selectedSpecialty) { toast.error("Select a parent specialty first."); return; }
        setMutating(true);
        try {
            const res = await axiosInstance.post("/admin/subspecialties", { name, rootSpecialtyId: selectedSpecialty });
            setData(d => ({ ...d, subspecialties: [...d.subspecialties, res.data.data.subspecialty] }));
            toast.success(`"${name}" added.`);
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
        finally { setMutating(false); }
    };

    const createDepartmentType = async (name) => {
        setMutating(true);
        try {
            const res = await axiosInstance.post("/admin/department-types", { name });
            setData(d => ({ ...d, departmentTypes: [...d.departmentTypes, res.data.data.departmentType].sort((a, b) => a.name.localeCompare(b.name)) }));
            toast.success(`"${name}" added.`);
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
        finally { setMutating(false); }
    };

    const createService = async (name) => {
        if (!selectedDeptType) { toast.error("Select a parent department type first."); return; }
        setMutating(true);
        try {
            const res = await axiosInstance.post("/admin/services", { name, rootDepartmentTypeId: selectedDeptType });
            setData(d => ({ ...d, services: [...d.services, res.data.data.service] }));
            toast.success(`"${name}" added.`);
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
        finally { setMutating(false); }
    };

    // ── edit ────────────────────────────────────────────────────────────────

    const edit = async (type, id, name) => {
        const url = {
            specialty: `/admin/specialties/${id}`,
            subspecialty: `/admin/subspecialties/${id}`,
            departmentType: `/admin/department-types/${id}`,
            service: `/admin/services/${id}`,
        }[type];
        const res = await axiosInstance.patch(url, { name });
        const key = { specialty: "specialties", subspecialty: "subspecialties", departmentType: "departmentTypes", service: "services" }[type];
        const resKey = { specialty: "specialty", subspecialty: "subspecialty", departmentType: "departmentType", service: "service" }[type];
        setData(d => ({ ...d, [key]: d[key].map(x => x._id === id ? res.data.data[resKey] : x) }));
        toast.success("Updated.");
    };

    // ── delete ───────────────────────────────────────────────────────────────

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const { type, id } = deleteTarget;
        const url = {
            specialty: `/admin/specialties/${id}`,
            subspecialty: `/admin/subspecialties/${id}`,
            departmentType: `/admin/department-types/${id}`,
            service: `/admin/services/${id}`,
        }[type];
        const key = { specialty: "specialties", subspecialty: "subspecialties", departmentType: "departmentTypes", service: "services" }[type];
        try {
            await axiosInstance.delete(url);
            setData(d => ({ ...d, [key]: d[key].filter(x => x._id !== id) }));
            toast.success("Deleted.");
        } catch (err) { toast.error(err?.response?.data?.message || "Delete failed."); }
        finally { setDeleteTarget(null); }
    };

    // ── render helpers ───────────────────────────────────────────────────────

    const renderSpecialties = () => (
        <div className="space-y-3">
            <AddForm placeholder="New specialty name..." onAdd={createSpecialty} loading={mutating} />
            <div className="space-y-2">
            {data.specialties.map(s => (
                <EditableRow
                    key={s._id}
                    name={s.name}
                    onSave={name => edit("specialty", s._id, name)}
                    onDelete={() => setDeleteTarget({ type: "specialty", id: s._id, name: s.name })}
                />
            ))}
            </div>
        </div>
    );

    const renderSubspecialties = () => {
        const filtered = selectedSpecialty
            ? data.subspecialties.filter(s => s.rootSpecialty?.toString() === selectedSpecialty)
            : data.subspecialties;
        return (
            <div className="space-y-3">
                <div>
                    <label className="label label-text text-xs">Filter by Specialty</label>
                    <select className="select select-bordered select-sm w-full max-w-xs" value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)}>
                        <option value="">All specialties</option>
                        {data.specialties.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <p className="text-xs opacity-50 mb-1">Parent specialty for new item:</p>
                    <select className="select select-bordered select-sm w-full max-w-xs mb-2" value={selectedSpecialty} onChange={e => setSelectedSpecialty(e.target.value)}>
                        <option value="">Select specialty...</option>
                        {data.specialties.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                    <AddForm placeholder="New subspecialty name..." onAdd={createSubspecialty} loading={mutating} />
                </div>
                <div className="space-y-2">
                    {filtered.length === 0 && <p className="text-sm opacity-50">No subspecialties found.</p>}
                    {filtered.map(s => (
                        <EditableRow
                            key={s._id}
                            name={s.name}
                            onSave={name => edit("subspecialty", s._id, name)}
                            onDelete={() => setDeleteTarget({ type: "subspecialty", id: s._id, name: s.name })}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const renderDepartmentTypes = () => (
        <div className="space-y-3">
            <AddForm placeholder="New department type name..." onAdd={createDepartmentType} loading={mutating} />
            <div className="space-y-2">
            {data.departmentTypes.map(d => (
                <EditableRow
                    key={d._id}
                    name={d.name}
                    onSave={name => edit("departmentType", d._id, name)}
                    onDelete={() => setDeleteTarget({ type: "departmentType", id: d._id, name: d.name })}
                />
            ))}
            </div>
        </div>
    );

    const renderServices = () => {
        const filtered = selectedDeptType
            ? data.services.filter(s => s.rootDepartmentType?.toString() === selectedDeptType)
            : data.services;
        return (
            <div className="space-y-3">
                <div>
                    <label className="label label-text text-xs">Filter by Department Type</label>
                    <select className="select select-bordered select-sm w-full max-w-xs" value={selectedDeptType} onChange={e => setSelectedDeptType(e.target.value)}>
                        <option value="">All department types</option>
                        {data.departmentTypes.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <p className="text-xs opacity-50 mb-1">Parent department type for new item:</p>
                    <select className="select select-bordered select-sm w-full max-w-xs mb-2" value={selectedDeptType} onChange={e => setSelectedDeptType(e.target.value)}>
                        <option value="">Select department type...</option>
                        {data.departmentTypes.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                    <AddForm placeholder="New service name..." onAdd={createService} loading={mutating} />
                </div>
                <div className="space-y-2">
                    {filtered.length === 0 && <p className="text-sm opacity-50">No services found.</p>}
                    {filtered.map(s => (
                        <EditableRow
                            key={s._id}
                            name={s.name}
                            onSave={name => edit("service", s._id, name)}
                            onDelete={() => setDeleteTarget({ type: "service", id: s._id, name: s.name })}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const tabContent = {
        "Specialties": renderSpecialties,
        "Subspecialties": renderSubspecialties,
        "Department Types": renderDepartmentTypes,
        "Services": renderServices,
    };

    const counts = {
        "Specialties": data.specialties.length,
        "Subspecialties": data.subspecialties.length,
        "Department Types": data.departmentTypes.length,
        "Services": data.services.length,
    };

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Specialties & Services</h1>
                <p className="text-sm opacity-50">View, add, edit, or remove specialties, subspecialties, department types, and services. Changes take effect immediately — no approval queue.</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`btn btn-sm gap-1 ${activeTab === tab ? "btn-primary" : "btn-ghost border border-base-300"}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                        <span className={`badge badge-xs ${activeTab === tab ? "badge-primary-content" : "badge-ghost"}`}>{counts[tab]}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="card bg-base-100 border-2 border-base-300 rounded-xl p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
                {loading ? (
                    <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
                ) : (
                    tabContent[activeTab]?.()
                )}
            </div>

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <ConfirmModal
                    title={`Delete "${deleteTarget.name}"?`}
                    message="This will also remove all associated claims and linked records. This cannot be undone."
                    confirmLabel="Delete"
                    danger
                    onConfirm={confirmDelete}
                    onClose={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
};

export default AdminSpecialtiesPage;
