import React, { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const ViewAllSpecialtiesPopup = ({ onClose }) => {
    const [claimType, setClaimType] = useState("specialty");
    const [rootSpecialty, setRootSpecialty] = useState("");
    const [specialties, setSpecialties] = useState([]);
    const [subspecialties, setSubspecialties] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSpecialties();
    }, []);

    useEffect(() => {
        if (claimType === "subspecialty" && rootSpecialty) {
            fetchSubspecialties(rootSpecialty);
        } else {
            setSubspecialties([]);
        }
    }, [claimType, rootSpecialty]);

    const fetchSpecialties = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get("/specialties-and-services/specialties");
            setSpecialties(res.data.items || []);
        } catch (err) {
            console.error("Error fetching specialties:", err);
            toast.error("Failed to load specialties");
        } finally {
            setLoading(false);
        }
    };

    const fetchSubspecialties = async (specialtyId) => {
        try {
            setLoading(true);
            const res = await axiosInstance.get(`/specialties-and-services/subspecialties/${specialtyId}`);
            setSubspecialties(res.data.items || []);
        } catch (err) {
            console.error("Error fetching subspecialties:", err);
            toast.error("Failed to load subspecialties");
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!selectedItem) return toast.error("Please select an item to claim.");

        try {
            await axiosInstance.post("/specialties-and-services/claim", {
                targetId: selectedItem._id,
                type: claimType,
            });

            toast.success(`Successfully claimed ${claimType}!`);
            onClose();
        } catch (err) {
            console.error("Error claiming item:", err);
            toast.error(err.response?.data?.message || "Failed to claim item.");
        }
    };

    const itemsToDisplay = claimType === "specialty" ? specialties : subspecialties;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6 w-[500px] max-h-[80vh] flex flex-col">
                <h3 className="text-lg font-bold mb-4">View All {claimType === "specialty" ? "Specialties" : "Subspecialties"}</h3>

                {/* Claim Type Dropdown */}
                <div className="mb-4">
                    <label className="block mb-1 font-semibold">Claim Type</label>
                    <select
                        className="select select-bordered w-full"
                        value={claimType}
                        onChange={(e) => {
                            setClaimType(e.target.value);
                            setSelectedItem(null);
                            setRootSpecialty("");
                        }}
                    >
                        <option value="specialty">Specialty</option>
                        <option value="subspecialty">Subspecialty</option>
                    </select>
                </div>

                {/* Root Specialty Dropdown (only for subspecialty) */}
                {claimType === "subspecialty" && (
                    <div className="mb-4">
                        <label className="block mb-1 font-semibold">Root Specialty</label>
                        <select
                            className="select select-bordered w-full"
                            value={rootSpecialty}
                            onChange={(e) => {
                                setRootSpecialty(e.target.value);
                                setSelectedItem(null);
                            }}
                        >
                            <option value="">Select Root Specialty</option>
                            {specialties.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto border rounded p-2 mb-4">
                    {loading ? (
                        <p className="text-center text-gray-500">Loading...</p>
                    ) : itemsToDisplay.length === 0 ? (
                        <p className="text-center text-gray-500">No items available.</p>
                    ) : (
                        itemsToDisplay.map(item => (
                            <div
                                key={item._id}
                                className={`p-2 rounded mb-1 cursor-pointer ${selectedItem?._id === item._id ? "bg-blue-200" : "hover:bg-gray-100"}`}
                                onClick={() => setSelectedItem(item)}
                            >
                                {item.name}
                            </div>
                        ))
                    )}
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-2">
                    <button className="btn btn-sm btn-primary" onClick={handleClaim}>Claim</button>
                    <button className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default ViewAllSpecialtiesPopup;
