import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import PendingClaimPopup from "../components/PendingClaimPopup";

const GroupItem = ({ item, onView }) => (
    <div className="card bg-base-200 shadow-sm mb-2 p-4 flex justify-between items-center">
        <span>{item.name || "Item Name"}</span>
        <button className="btn btn-sm btn-info" onClick={() => onView(item)}>
            View
        </button>
    </div>
);

const SpecialtyClaims = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const openModal = (item) => setSelectedItem(item);
    const closeModal = () => setSelectedItem(null);

    useEffect(() => {
        const fetchSpecialtyClaims = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get("/specialties-and-services/doctor-specialties");

                // Only take pending claims group (group3)
                setItems(res.data.group3 || []);
            } catch (err) {
                console.error("Error fetching pending claims:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSpecialtyClaims();
    }, []);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Pending Claims</h2>
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p>No pending claims found.</p>
            ) : (
                <div className="flex flex-col space-y-2">
                    {items.map((item) => (
                        <GroupItem key={item._id || item.id} item={item} onView={openModal} />
                    ))}
                </div>
            )}

            {/* Modal */}
            {selectedItem && <PendingClaimPopup item={selectedItem} onClose={closeModal} />}
        </div>
    );
};

export default SpecialtyClaims;
