import React, { useState } from "react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const ViewPendingReportPopup = ({ report, onClose, onReportResolved }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [outcome, setOutcome] = useState("");
    const [adminNote, setAdminNote] = useState("");

    if (!report) return null;

    const handleResolve = async () => {
        if (!outcome || !adminNote.trim()) {
            setError("Please select an outcome and provide an admin note");
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSuccess(false);

            const res = await axiosInstance.patch("/admin/resolve", {
                complaintId: report._id,
                outcome,
                adminNote
            });


            if (res.data.success) {
                toast.success("Report resolved.");
                onReportResolved?.(report._id);
                onClose();
            }
        } catch (err) {
            console.error("Error resolving report:", err);
            console.error("Full error response:", err.response?.data);
            setError(err.response?.data?.message || "Failed to resolve report");
        } finally {
            setLoading(false);
        }
    };

    const getReportedUserInfo = () => {
        if (report.filedAgainst) {
            if (report.filedAgainst.facilityName) {
                return {
                    name: report.filedAgainst.facilityName,
                    type: "Institute",
                    email: report.filedAgainst.email
                };
            } else {
                return {
                    name: `${report.filedAgainst.firstName} ${report.filedAgainst.lastName}`,
                    type: "Individual",
                    email: report.filedAgainst.email
                };
            }
        }
        return { name: "Unknown User", type: "Unknown", email: "" };
    };

    const getReporterInfo = () => {
        if (report.filedBy) {
            if (report.filedBy.facilityName) {
                return {
                    name: report.filedBy.facilityName,
                    type: "Institute",
                    email: report.filedBy.email
                };
            } else {
                return {
                    name: `${report.filedBy.firstName} ${report.filedBy.lastName}`,
                    type: "Individual",
                    email: report.filedBy.email
                };
            }
        }
        return { name: "Unknown User", type: "Unknown", email: "" };
    };

    const reportedUser = getReportedUserInfo();
    const reporter = getReporterInfo();

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Report Details</h2>

                {error && <p className="text-error text-sm mb-3">{error}</p>}

                {!success && (
                    <div className="space-y-4">
                        {/* Report Information */}
                        <div>
                            <strong>Report ID:</strong>
                            <p className="mt-1 font-mono">{report._id}</p>
                        </div>

                        {/* Reporter Information */}
                        <div>
                            <strong>Filed By:</strong>
                            <div className="mt-1">
                                <p className="font-semibold">{reporter.name}</p>
                                <p className="text-sm opacity-70">{reporter.type}</p>
                                {reporter.email && (
                                    <p className="text-sm opacity-70">{reporter.email}</p>
                                )}
                            </div>
                        </div>

                        {/* Reported User Information */}
                        <div>
                            <strong>Reported Against:</strong>
                            <div className="mt-1">
                                <p className="font-semibold">{reportedUser.name}</p>
                                <p className="text-sm opacity-70">{reportedUser.type}</p>
                                {reportedUser.email && (
                                    <p className="text-sm opacity-70">{reportedUser.email}</p>
                                )}
                            </div>
                        </div>

                        {/* Complaint Reason */}
                        <div>
                            <strong>Complaint:</strong>
                            <p className="mt-1 p-3 bg-base-200 rounded">{report.reason}</p>
                        </div>

                        {/* Appointment Information */}
                        {report.appointmentId && (
                            <div>
                                <strong>Appointment:</strong>
                                <p className="mt-1 text-sm">
                                    ID: {report.appointmentId._id}
                                </p>
                            </div>
                        )}

                        {/* Date Information */}
                        {report.createdAt && (
                            <div>
                                <strong>Filed On:</strong>
                                <p className="mt-1">{formatDate(report.createdAt)}</p>
                            </div>
                        )}

                        {/* Resolution Form */}
                        <div className="border-t pt-4">
                            <h3 className="font-bold mb-3">Resolve Report</h3>

                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text font-semibold">Outcome</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={outcome}
                                    onChange={(e) => setOutcome(e.target.value)}
                                >
                                    <option value="">Select outcome</option>
                                    <option value="patient_right">Patient is Right</option>
                                    <option value="doctor_right">Doctor is Right</option>
                                    <option value="split">Split Responsibility</option>
                                </select>
                            </div>

                            <div className="form-control mb-3">
                                <label className="label">
                                    <span className="label-text font-semibold">Admin Note</span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered"
                                    placeholder="Enter resolution details..."
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 mt-6">
                    {!success ? (
                        <>
                            <button
                                className="btn btn-success flex-1"
                                onClick={handleResolve}
                                disabled={loading || !outcome || !adminNote.trim()}
                            >
                                {loading ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    "Resolve"
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

export default ViewPendingReportPopup;