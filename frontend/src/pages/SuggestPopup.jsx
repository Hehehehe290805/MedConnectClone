import React, { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const SuggestPopup = ({ onClose }) => {
    const [type, setType] = useState("specialty"); // specialty or subspecialty
    const [name, setName] = useState("");
    const [rootSpecialty, setRootSpecialty] = useState(""); // only for subspecialty
    const [specialties, setSpecialties] = useState([]); // dropdown for root specialties
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        // Fetch verified specialties for the rootSpecialty dropdown
        const fetchSpecialties = async () => {
            try {
                const res = await axiosInstance.get("/specialties-and-services/specialties");
                setSpecialties(res.data.items || []);
            } catch (err) {
                console.error("Error fetching specialties:", err);
            }
        };

        fetchSpecialties();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const payload = { name, type };
            if (type === "subspecialty") payload.rootSpecialtyId = rootSpecialty;

            const res = await axiosInstance.post("/specialties-and-services/suggest", payload);
            setSuccess(res.data.message);
            setName("");
            setRootSpecialty("");
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Error suggesting item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg">
                <h2 className="text-xl font-bold mb-4">Suggest a New Item</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block font-semibold mb-1">Type</label>
                        <select
                            className="select select-bordered w-full"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                        >
                            <option value="specialty">Specialty</option>
                            <option value="subspecialty">Subspecialty</option>
                        </select>
                    </div>

                    {type === "subspecialty" && (
                        <div>
                            <label className="block font-semibold mb-1">Root Specialty</label>
                            <select
                                className="select select-bordered w-full"
                                value={rootSpecialty}
                                onChange={(e) => setRootSpecialty(e.target.value)}
                            >
                                <option value="">Select Root Specialty</option>
                                {specialties.map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block font-semibold mb-1">Name</label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder={`Enter ${type} name`}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {success && <p className="text-green-500 text-sm">{success}</p>}

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" className="btn btn-outline" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={`btn btn-primary ${loading ? "loading" : ""}`} disabled={loading}>
                            Suggest
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SuggestPopup;
