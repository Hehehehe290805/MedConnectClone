import React, { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const ViewPendingClaimPopup = ({ claim, onClose, onClaimApproved }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [licenseNumber, setLicenseNumber] = useState(null);
    const [licenseLoading, setLicenseLoading] = useState(false);

    if (!claim) return null;

    // Fetch license number when component mounts or claim changes
    useEffect(() => {
        const fetchLicenseNumber = async () => {
            if (claim.doctorId) {
                try {
                    setLicenseLoading(true);
                    const userId = claim.doctorId._id || claim.doctorId;


                    // Use the new admin license endpoint
                    const res = await axiosInstance.get(`/admin/license/${userId}`);



                    if (res.data.licenseNumber) {
                        setLicenseNumber(res.data.licenseNumber);
                    } else {
                        setLicenseNumber("License number not provided");
                    }
                } catch (err) {
                    console.error("Error fetching license number:", err);

                    // Check if there's a specific error message
                    if (err.response?.data?.message) {
                        setLicenseNumber(`Error: ${err.response.data.message}`);
                    } else {
                        setLicenseNumber("Unable to fetch license");
                    }
                } finally {
                    setLicenseLoading(false);
                }
            }
        };

        fetchLicenseNumber();
    }, [claim]);

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(false);

            const res = await axiosInstance.patch("/admin/approve-claim", { claimId: claim._id });


            if (res.data.success) {
                setSuccess(true);
                setTimeout(() => {
                    if (onClaimApproved) {
                        onClaimApproved(claim._id);
                    }
                    onClose();
                }, 1500);
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
            return {
                name: `${claim.doctorId.firstName} ${claim.doctorId.lastName}`,
                email: claim.doctorId.email,
                type: "Doctor",
                hasLicense: true
            };
        } else if (claim.instituteId) {
            return {
                name: claim.instituteId.facilityName,
                email: claim.instituteId.email,
                type: "Institute",
                hasLicense: false
            };
        }
        return { name: "Unknown User", email: "", type: "Unknown", hasLicense: false };
    };

    const getItemInfo = () => {
        if (claim.specialtyId) {
            return {
                name: claim.specialtyId.name,
                type: "Specialty"
            };
        } else if (claim.subspecialtyId) {
            return {
                name: claim.subspecialtyId.name,
                type: "Subspecialty"
            };
        } else if (claim.serviceId) {
            return {
                name: claim.serviceId.name,
                type: "Service"
            };
        }
        return { name: "Unknown Item", type: "Unknown" };
    };

    const userInfo = getUserInfo();
    const itemInfo = getItemInfo();

    const renderLicenseInfo = () => {
        if (!userInfo.hasLicense) return null;

        const isLicenseValid = licenseNumber &&
            !licenseNumber.includes("not provided") &&
            !licenseNumber.includes("Unable to fetch") &&
            !licenseNumber.includes("Error:");

        return (
            <div>
                <strong>License Number:</strong>
                <div className="mt-1">
                    {licenseLoading ? (
                        <div className="flex items-center gap-2">
                            <span className="loading loading-spinner loading-xs"></span>
                            <span className="text-sm text-gray-500">Fetching license...</span>
                        </div>
                    ) : (
                        <p className={`font-mono ${isLicenseValid ? "text-success font-semibold" : "text-warning"}`}>
                            {licenseNumber || "No license number found"}
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const renderClaimDetails = () => {
        return (
            <>
                <div className="space-y-4">
                    {/* Claim Information */}
                    <div>
                        <strong>Claim Type:</strong>
                        <p className="mt-1">
                            <span className="badge badge-primary">{getClaimType()}</span>
                        </p>
                    </div>

                    {/* Item Information */}
                    <div>
                        <strong>{itemInfo.type}:</strong>
                        <p className="text-lg font-semibold mt-1">{itemInfo.name}</p>
                    </div>

                    {/* User Information */}
                    <div>
                        <strong>Claimed By:</strong>
                        <div className="mt-1">
                            <p className="font-semibold">{userInfo.name}</p>
                            <p className="text-sm opacity-70">{userInfo.type}</p>
                            {userInfo.email && (
                                <p className="text-sm opacity-70">{userInfo.email}</p>
                            )}
                        </div>
                    </div>

                    {/* License Information - Only for doctors */}
                    {renderLicenseInfo()}

                    {/* Additional Details */}
                    {claim.claimType === "subspecialty" && claim.rootSpecialty && (
                        <div>
                            <strong>Root Specialty:</strong>
                            <p className="mt-1">
                                {claim.rootSpecialty.name || claim.rootSpecialty}
                            </p>
                        </div>
                    )}

                    {claim.createdAt && (
                        <div>
                            <strong>Submitted:</strong>
                            <p className="mt-1">
                                {new Date(claim.createdAt).toLocaleDateString()} at {" "}
                                {new Date(claim.createdAt).toLocaleTimeString()}
                            </p>
                        </div>
                    )}

                    {/* Evidence/Supporting Documents (if any) */}
                    {claim.evidence && (
                        <div>
                            <strong>Supporting Evidence:</strong>
                            <p className="mt-1">{claim.evidence}</p>
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Claim Details</h2>

                {success && (
                    <div className="alert alert-success mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Claim approved successfully!</span>
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

                {!success && renderClaimDetails()}

                <div className="flex gap-2 mt-6">
                    {!success ? (
                        <>
                            <button
                                className="btn btn-success flex-1"
                                onClick={handleApprove}
                                disabled={loading || licenseLoading}
                            >
                                {loading ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    "Approve"
                                )}
                            </button>
                            <button
                                className="btn btn-outline flex-1"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Close
                            </button>
                        </>
                    ) : (
                        <button
                            className="btn btn-success flex-1"
                            disabled
                        >
                            <span className="loading loading-spinner loading-sm"></span>
                            Closing...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewPendingClaimPopup;