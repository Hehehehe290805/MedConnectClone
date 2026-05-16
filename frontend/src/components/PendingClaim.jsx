import { useState } from "react";
import { axiosInstance } from "../lib/axios";

const PendingClaim = ({ claim, onClaimApproved, onViewDetails }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await axiosInstance.patch("/admin/approve-claim", {
                claimId: claim._id,
            });

            if (res.data.success) {
                if (onClaimApproved) {
                    onClaimApproved(claim._id);
                }
            }
        } catch (err) {
            console.error("Error approving claim:", err);
            setError(err.response?.data?.message || "Failed to approve claim");
        } finally {
            setLoading(false);
        }
    };

    const getClaimType = () => {
        switch (claim.claimType) {
            case "specialty":
                return "Specialty Claim";
            case "subspecialty":
                return "Subspecialty Claim";
            case "service":
                return "Service Claim";
            default:
                return "Claim";
        }
    };

    const getUserInfo = () => {
        if (claim.doctorId) {
            return `${claim.doctorId.firstName} ${claim.doctorId.lastName}`;
        } else if (claim.instituteId) {
            return claim.instituteId.facilityName;
        }
        return "Unknown User";
    };

    const getItemInfo = () => {
        if (claim.specialtyId) {
            return claim.specialtyId.name;
        } else if (claim.subspecialtyId) {
            return claim.subspecialtyId.name;
        } else if (claim.serviceId) {
            return claim.serviceId.name;
        }
        return "Unknown Item";
    };

    return (
        <div className="card bg-base-200 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => onViewDetails(claim)}>
                        <h3 className="font-semibold text-lg">{getItemInfo()}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="badge badge-primary">{getClaimType()}</span>
                            <span className="badge badge-outline">By: {getUserInfo()}</span>
                        </div>
                        {claim.claimType === "subspecialty" && claim.rootSpecialty && (
                            <p className="text-sm opacity-70 mt-1">
                                Root Specialty: {claim.rootSpecialty.name || claim.rootSpecialty}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                        <button
                            className="btn btn-info btn-sm"
                            onClick={() => onViewDetails(claim)}
                        >
                            View
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

export default PendingClaim;