import React, { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import ViewAllSpecialtiesPopup from "./ViewAllSpecialtiesPopup";
import SuggestPopup from "./SuggestPopup"; // import the Suggest popup

// Reusable component for each specialty/subspecialty item
const SpecialtyItem = ({ item }) => (
    <div className="card bg-base-200 shadow-sm mb-2 p-4 flex justify-between items-center">
        <span>{item.name}</span>
    </div>
);

const SpecialtyPage = () => {
    const [verified, setVerified] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showViewPopup, setShowViewPopup] = useState(false);
    const [showSuggestPopup, setShowSuggestPopup] = useState(false); // state for Suggest popup

    useEffect(() => {
        const fetchSpecialties = async () => {
            try {
                const res = await axiosInstance.get("/specialties-and-services/doctor-specialties");


                setVerified(res.data.verified || []);
                setPending(res.data.pending || []);
            } catch (err) {
                console.error("Error fetching specialties:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSpecialties();
    }, []);

    const renderGroup = (title, items) => (
        <section className="border rounded shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">{title}</h2>
            {loading ? (
                <div className="min-h-[100px] flex items-center justify-center text-gray-400">
                    Loading...
                </div>
            ) : items.length === 0 ? (
                <div className="min-h-[100px] flex items-center justify-center text-gray-400">
                    No items in this group.
                </div>
            ) : (
                <div className="flex flex-col">
                    {items.map((item) => (
                        <SpecialtyItem key={item._id} item={item} />
                    ))}
                </div>
            )}
        </section>
    );

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Welcome to MedConnect</h1>
                <p className="mt-2 text-gray-600">Specialties Dashboard</p>
            </div>

            {/* Top Buttons */}
            <div className="flex gap-4">
                <button
                    className="btn btn-primary"
                    onClick={() => setShowSuggestPopup(true)} // open Suggest popup
                >
                    Suggest
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={() => setShowViewPopup(true)}
                >
                    View
                </button>
            </div>

            {/* Groups */}
            {renderGroup("Approved Specialties and Subspecialties", verified)}
            {renderGroup("Pending Claims", pending)}

            {/* Popups */}
            {showViewPopup && (
                <ViewAllSpecialtiesPopup onClose={() => setShowViewPopup(false)} />
            )}
            {showSuggestPopup && (
                <SuggestPopup onClose={() => setShowSuggestPopup(false)} />
            )}
        </div>
    );
};

export default SpecialtyPage;
    