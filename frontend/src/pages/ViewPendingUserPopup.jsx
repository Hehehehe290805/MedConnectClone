import React, { useState } from "react";
import { axiosInstance } from "../lib/axios";

const ViewPendingUserPopup = ({ user, onClose, onUserApproved }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    if (!user) return null;

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(false);


            const res = await axiosInstance.patch(`/admin/approve-role`, { userId: user._id });


            if (res.data.success) {
                setSuccess(true);
                setTimeout(() => {
                    if (onUserApproved) {
                        onUserApproved(user._id);
                    }
                    onClose();
                }, 1500);
            }
        } catch (err) {
            console.error("Error approving user:", err);
            setError(err.response?.data?.message || "Failed to approve user");
        } finally {
            setLoading(false);
        }
    };

    const renderRoleFields = () => {
        switch (user.role) {
            case "doctor":
                return (
                    <>
                        <p><strong>First Name:</strong> {user.firstName}</p>
                        <p><strong>Last Name:</strong> {user.lastName}</p>
                        <p><strong>Birth Date:</strong> {new Date(user.birthDate).toLocaleDateString()}</p>
                        <p><strong>Pending Role:</strong> {user.role}</p>
                        <p><strong>Profession:</strong> {user.profession}</p>
                        <p><strong>License Number:</strong> {user.licenseNumber}</p>
                    </>
                );
            case "institute":
                return (
                    <>
                        <p><strong>Facility Name:</strong> {user.facilityName}</p>
                        <p><strong>Pending Role:</strong> {user.role}</p>
                        <p><strong>Location:</strong> {user.location || "-"}</p>
                    </>
                );
            case "admin":
                return (
                    <>
                        <p><strong>First Name:</strong> {user.firstName}</p>
                        <p><strong>Last Name:</strong> {user.lastName}</p>
                        <p><strong>Pending Role:</strong> {user.role}</p>
                        <p><strong>Admin Code:</strong> {user.adminCode}</p>
                    </>
                );
            default:
                return <p>No details available</p>;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">User Details</h2>

                {success && (
                    <div className="alert alert-success mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>User approved successfully!</span>
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

                {!success && renderRoleFields()}

                <div className="flex gap-2 mt-4">
                    {!success ? (
                        <>
                            <button
                                className="btn btn-success flex-1"
                                onClick={handleApprove}
                                disabled={loading}
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

export default ViewPendingUserPopup;