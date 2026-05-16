import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import SuggestedSpecialtyPopup from "../SuggestedSpecialtyPopup";

const GroupItem = ({ item, onView }) => (
    <div className="card bg-base-200 shadow-sm mb-2 p-4 flex justify-between items-center">
        <span>{item.name || "Item Name"}</span>
        <button className="btn btn-sm btn-info" onClick={() => onView(item)}>
            View
        </button>
    </div>
);

const SuggestedSpecialties = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const openModal = (item) => setSelectedItem(item);
    const closeModal = () => setSelectedItem(null);

    useEffect(() => {
        const fetchSuggestedSpecialties = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get("/specialties-and-services/doctor-specialties");

                // Only take suggested/pending group (group2)
                setItems(res.data.group2 || []);
            } catch (err) {
                console.error("Error fetching suggested specialties:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSuggestedSpecialties();
    }, []);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Suggested Specialties & Subspecialties</h2>
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p>No suggested specialties found.</p>
            ) : (
                <div className="flex flex-col space-y-2">
                    {items.map((item) => (
                        <GroupItem key={item._id || item.id} item={item} onView={openModal} />
                    ))}
                </div>
            )}

            {/* Modal */}
            {selectedItem && <SuggestedSpecialtyPopup item={selectedItem} onClose={closeModal} />}
        </div>
    );
};

export default SuggestedSpecialties;
