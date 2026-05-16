import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const PendingSuggestion = ({ suggestion, onSuggestionApproved, onViewDetails }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [rootSpecialtyName, setRootSpecialtyName] = useState("");

    useEffect(() => {
        const fetchRootSpecialtyName = async () => {
            // Only fetch if type is subspecialty
            if (suggestion.type === "subspecialty" && suggestion._id) {
                try {
                    const res = await axiosInstance.get(
                        `/specialties-and-services/subspecialty-root/${suggestion._id}`
                    );

                    // Set name if available
                    setRootSpecialtyName(res.data.name || "Unknown");
                } catch (err) {
                    console.error("Failed to fetch root specialty:", err);
                    setRootSpecialtyName("Unknown");
                }
            }
        };

        fetchRootSpecialtyName();
    }, [suggestion]);

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await axiosInstance.patch("/admin/approve", {
                id: suggestion._id,
            });

            if (res.data.message && onSuggestionApproved) {
                onSuggestionApproved(suggestion._id);
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

    return (
        <div className="card bg-base-200 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => onViewDetails(suggestion)}>
                        <h3 className="font-semibold text-lg">{suggestion.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="badge badge-primary">{getSuggestionType()}</span>
                            {suggestion.type === "subspecialty" && rootSpecialtyName && (
                                <span className="badge badge-outline">Under: {rootSpecialtyName}</span>
                            )}
                        </div>
                        {suggestion.suggestedBy && (
                            <p className="text-sm opacity-70 mt-1">
                                Suggested by: {suggestion.suggestedBy.firstName} {suggestion.suggestedBy.lastName}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                        <button
                            className="btn btn-info btn-sm"
                            onClick={() => onViewDetails(suggestion)}
                        >
                            View
                        </button>
                        <button
                            className="btn btn-success btn-sm mt-1"
                            onClick={handleApprove}
                            disabled={loading}
                        >
                            {loading ? "Approving..." : "Approve"}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error mt-2">
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingSuggestion;
