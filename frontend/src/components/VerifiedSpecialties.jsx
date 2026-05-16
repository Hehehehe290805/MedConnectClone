import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import VerifiedSpecialtiesPopup from "../components/VerifiedSpecialtiesPopup";

const GroupItem = ({ item, onView }) => (
    <div className="card bg-base-200 shadow-sm mb-2 p-4 flex justify-between items-center">
        <span>{item.name || "Item Name"}</span>
        <button className="btn btn-sm btn-info" onClick={() => onView(item)}>
            View
        </button>
    </div>
);

const VerifiedSpecialties = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const openModal = (item) => setSelectedItem(item);
    const closeModal = () => setSelectedItem(null);

    useEffect(() => {
        const fetchVerifiedSpecialties = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get("/specialties-and-services/doctor-specialties");

                // Only take verified group
                setItems(res.data.group1 || []);
            } catch (err) {
                console.error("Error fetching verified specialties:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVerifiedSpecialties();
    }, []);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Verified Specialties & Subspecialties</h2>
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p>No verified specialties found.</p>
            ) : (
                <div className="flex flex-col space-y-2">
                    {items.map((item) => (
                        <GroupItem key={item._id || item.id} item={item} onView={openModal} />
                    ))}
                </div>
            )}

            {/* Modal */}
            {selectedItem && <VerifiedSpecialtiesPopup item={selectedItem} onClose={closeModal} />}
        </div>
    );
};

export default VerifiedSpecialties;
