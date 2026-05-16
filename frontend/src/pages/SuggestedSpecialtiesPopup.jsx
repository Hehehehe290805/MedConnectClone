import React from "react";

const SuggestedSpecialtiesPopup = ({ item, onClose }) => {
    if (!item) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6 w-96">
                <h3 className="text-lg font-bold mb-2">{item.name}</h3>
                <p className="mb-2">Type: {item.type}</p>
                <p className="mb-2">Doctor: {item.doctorName}</p>
                <p className="mb-2 text-sm text-gray-500">Status: {item.status || "Pending"}</p>
                <button className="btn btn-sm btn-primary" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
};

export default SuggestedSpecialtiesPopup;
