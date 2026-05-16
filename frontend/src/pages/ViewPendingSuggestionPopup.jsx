import React, { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const ViewPendingSuggestionPopup = ({ suggestion, onClose, onSuggestionApproved }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [rootSpecialtyName, setRootSpecialtyName] = useState("");

    // Fetch root specialty name if subspecialty
    useEffect(() => {
        const fetchRootSpecialtyName = async () => {
            if (suggestion.type === "subspecialty" && suggestion._id) {
                try {
                    const res = await axiosInstance.get(`/specialties-and-services/subspecialty-root/${suggestion._id}`);

                    setRootSpecialtyName(res.data.name || "Unknown");
                } catch (err) {
                    console.error("Failed to fetch root specialty:", err);
                    setRootSpecialtyName("Unknown");
                }
            }
        };

        fetchRootSpecialtyName();
    }, [suggestion]);

    if (!suggestion) return null;

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(false);

            const res = await axiosInstance.patch(`/admin/approve`, { id: suggestion._id });


            if (res.data.message) {
                setSuccess(true);
                setTimeout(() => {
                    if (onSuggestionApproved) onSuggestionApproved(suggestion._id);
                    onClose();
                }, 1500);
            }
        } catch (err) {
            console.error("Error approving suggestion:", err);
            setError(err.response?.data?.message || "Failed to approve suggestion");
        } finally {
            setLoading(false);
        }
    };

    const getSuggestionType = () => {
        switch (suggestion.type) {
            case "specialty": return "Medical Specialty";
            case "subspecialty": return "Subspecialty";
            case "service": return "Service";
            default: return suggestion.type;
        }
    };

    const renderSuggestionDetails = () => (
        <div className="space-y-3">
            <div>
                <strong>Name:</strong>
                <p className="text-lg font-semibold mt-1">{suggestion.name}</p>
            </div>

            <div>
                <strong>Type:</strong>
                <p className="mt-1">
                    <span className="badge badge-primary">{getSuggestionType()}</span>
                </p>
            </div>

            {suggestion.type === "subspecialty" && (
                <div>
                    <strong>Root Specialty:</strong>
                    <p className="mt-1">{rootSpecialtyName}</p>
                </div>
            )}

            {suggestion.suggestedBy && (
                <div>
                    <strong>Suggested By:</strong>
                    <p className="mt-1">
                        {suggestion.suggestedBy.firstName} {suggestion.suggestedBy.lastName}
                        {suggestion.suggestedBy.email && (
                            <span className="text-sm opacity-70 block">{suggestion.suggestedBy.email}</span>
                        )}
                    </p>
                </div>
            )}

            {suggestion.createdAt && (
                <div>
                    <strong>Submitted:</strong>
                    <p className="mt-1">
                        {new Date(suggestion.createdAt).toLocaleDateString()} at{" "}
                        {new Date(suggestion.createdAt).toLocaleTimeString()}
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Suggestion Details</h2>

                {success && (
                    <div className="alert alert-success mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Suggestion approved successfully!</span>
                    </div>
                )}

                {error && (
                    <div className="alert alert-error mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                {!success && renderSuggestionDetails()}

                <div className="flex gap-2 mt-6">
                    {!success ? (
                        <>
                            <button className="btn btn-success flex-1" onClick={handleApprove} disabled={loading}>
                                {loading ? <span className="loading loading-spinner loading-sm"></span> : "Approve"}
                            </button>
                            <button className="btn btn-outline flex-1" onClick={onClose} disabled={loading}>Close</button>
                        </>
                    ) : (
                        <button className="btn btn-success flex-1" disabled>
                            <span className="loading loading-spinner loading-sm"></span>
                            Closing...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewPendingSuggestionPopup;
