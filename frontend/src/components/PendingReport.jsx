import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const PendingReport = ({ report, onViewDetails }) => {
    const [reportedUser, setReportedUser] = useState(null);
    const [reporterUser, setReporterUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);

                // If already populated, use directly; otherwise fetch by ID
                const getUser = async (user) => {
                    if (!user) return { firstName: "Unknown", lastName: "", facilityName: null };
                    if (typeof user === "object" && user.firstName) return user;

                    const res = await axiosInstance.get(`/users/${user}`);
                    return res.data.data; // adjust if your response shape is different
                };

                const [reported, reporter] = await Promise.all([
                    getUser(report.filedAgainst),
                    getUser(report.filedBy)
                ]);

                setReportedUser(reported);
                setReporterUser(reporter);
            } catch (err) {
                console.error(err);
                setError("Failed to load user info");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [report.filedBy, report.filedAgainst]);

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    if (loading) return <div className="p-2">Loading report...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;

    const reporterName = reporterUser?.facilityName || `${reporterUser?.firstName} ${reporterUser?.lastName}`;
    const reportedName = reportedUser?.facilityName || `${reportedUser?.firstName} ${reportedUser?.lastName}`;

    return (
        <div className="card bg-base-200 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1 cursor-pointer" onClick={() => onViewDetails(report)}>
                        <h3 className="font-semibold text-lg">
                            Report #{report._id?.slice(-6) || "N/A"}
                        </h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="badge badge-warning">{report.status || "Pending"}</span>
                            <span className="badge badge-outline">Reported: {reporterName}</span>
                            <span className="badge badge-outline">Against: {reportedName}</span>
                        </div>
                        <p className="text-sm opacity-70 mt-1 line-clamp-2">{report.reason}</p>
                        {report.createdAt && (
                            <p className="text-xs opacity-50 mt-1">Filed: {formatDate(report.createdAt)}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                        <button className="btn btn-info btn-sm" onClick={() => onViewDetails(report)}>
                            View
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PendingReport;
