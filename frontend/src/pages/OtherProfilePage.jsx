import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
    MapPinIcon, UserIcon, CalendarIcon, GlobeIcon,
    AlertCircleIcon, ArrowLeftIcon, StarIcon, NavigationIcon, XIcon, FlagIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser.js";
import { axiosInstance } from "../lib/axios.js";
import ReviewsSection from "../components/ReviewsSection.jsx";
import LinkifiedText from "../components/LinkifiedText.jsx";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const REPORT_REASONS = [
    "Fake or misleading profile information",
    "Inappropriate or offensive content",
    "Harassment or abusive behavior",
    "Suspected fraudulent activity",
    "Unlicensed or unqualified provider",
    "Privacy violation",
    "Spam or unsolicited contact",
];

const OtherProfilePage = () => {
    const { id: userId } = useParams();
    const { authUser } = useAuthUser();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [doctorSpecialties, setDoctorSpecialties] = useState([]);
    const [showReviewsModal, setShowReviewsModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReasons, setReportReasons] = useState([]);
    const [reportDetails, setReportDetails] = useState("");
    const [reportLoading, setReportLoading] = useState(false);

    const isOwnProfile = !userId || userId === authUser?._id;
    const targetUserId = isOwnProfile ? authUser?._id : userId;

    useEffect(() => {
        if (isOwnProfile && authUser) { setUser(authUser); setLoading(false); return; }
        if (!targetUserId) return;

        (async () => {
            try {
                setLoading(true); setError(null);
                const res = await axiosInstance.get(`/users/${targetUserId}`);
                setUser(res.data.data);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to fetch profile");
            } finally {
                setLoading(false);
            }
        })();
    }, [targetUserId, isOwnProfile, authUser]);

    const formatDate = (d) => d ? dayjs(d).tz(PH_TZ).format("MMMM D, YYYY") : "Not provided";
    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    const formatAddress = (addr) => {
        if (!addr) return null;
        const parts = [addr.barangay, addr.city, addr.province].filter(Boolean);
        return parts.length ? parts.join(", ") : null;
    };

    const getDisplayName = () => {
        if (!user) return "";
        if (user.role === "institute") return user.instituteName || "Institute";
        if (user.role === "department") return `${user.technologistFirstName || ""} ${user.technologistLastName || ""}`.trim() || "Department";
        if (user.role === "pharmacy") return `${user.pharmacistFirstName || ""} ${user.pharmacistLastName || ""}`.trim() || "Pharmacy";
        return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
    };

    // Fetch verified specialties when the profile is a doctor
    useEffect(() => {
        if (!user || user.role !== "doctor" || !targetUserId) return;
        axiosInstance.get(`/specialties/doctor/${targetUserId}`)
            .then(res => setDoctorSpecialties(res.data.data?.specialties || []))
            .catch(() => setDoctorSpecialties([]));
    }, [user, targetUserId]);

    const showReviews = user && ["doctor", "institute"].includes(user.role);

    const { data: reviewSummary } = useQuery({
        queryKey: ["providerReviews", targetUserId],
        queryFn: () => axiosInstance.get(`/booking/reviews/${targetUserId}`).then(r => r.data?.data),
        enabled: Boolean(targetUserId && showReviews),
        staleTime: 2 * 60 * 1000,
    });

    // Google Maps directions link using provider coordinates or address
    const directionsUrl = (() => {
        const coords = user?.address?.coordinates?.coordinates;
        if (coords?.length === 2) return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
        const addr = [user?.address?.city, user?.address?.province].filter(Boolean).join(", ");
        if (addr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
        return null;
    })();

    const handleReport = async () => {
        if (reportReasons.length === 0 && !reportDetails.trim()) return;
        setReportLoading(true);
        try {
            const reasonText = reportReasons.length > 0
                ? `Reasons selected:\n${reportReasons.map(r => `• ${r}`).join("\n")}`
                : "";
            const description = [reasonText, reportDetails.trim()].filter(Boolean).join("\n\n") || "No details provided.";
            const subject = `Report Account: ${getDisplayName()}`.slice(0, 120);
            await axiosInstance.post("/app-reports", { category: "other", subject, description });
            toast.success("Report submitted. Our team will review it.");
            setShowReportModal(false);
            setReportReasons([]);
            setReportDetails("");
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to submit report.");
        } finally {
            setReportLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg text-primary" />
        </div>
    );

    if (error || !user) return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center">
            <div className="text-center">
                <AlertCircleIcon className="w-16 h-16 text-error mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
                <p className="opacity-60 mb-4">{error || "User not found"}</p>
                <button onClick={() => navigate(-1)} className="btn btn-primary">Go Back</button>
            </div>
        </div>
    );

    const location = formatAddress(user.address);

    return (
        <div className="min-h-screen bg-base-100 p-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {!isOwnProfile && (
                    <button onClick={() => navigate(-1)} className="btn btn-ghost gap-2">
                        <ArrowLeftIcon className="w-5 h-5" />Back
                    </button>
                )}

                {/* Header */}
                <div className="card bg-base-200 shadow-xl">
                    <div className="card-body items-center text-center p-8">
                        <div className="avatar">
                            <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                {user.profilePic?.url ? (
                                    <img src={user.profilePic.url} alt={getDisplayName()} />
                                ) : (
                                    <div className="bg-base-300 flex items-center justify-center h-full">
                                        <UserIcon className="w-16 h-16 text-base-content opacity-40" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mt-4">{getDisplayName()}</h1>
                        <div className="badge badge-primary badge-lg mt-2 capitalize">{user.role || "User"}</div>
                        {directionsUrl && !isOwnProfile && user.role !== "patient" && (
                            <a
                                href={directionsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm gap-2 mt-3"
                            >
                                <NavigationIcon className="w-4 h-4" />
                                Get Directions
                            </a>
                        )}
                        {showReviews && reviewSummary?.reviewCount > 0 && (
                            <button
                                onClick={() => setShowReviewsModal(true)}
                                className="flex items-center gap-1 mt-2 opacity-70 hover:opacity-100 transition-opacity"
                            >
                                <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                <span className="text-sm font-medium">{reviewSummary.averageRating?.toFixed(1)}</span>
                                <span className="text-xs opacity-60">({reviewSummary.reviewCount} review{reviewSummary.reviewCount !== 1 ? "s" : ""})</span>
                            </button>
                        )}
                        {showReviews && (
                            <button
                                onClick={() => setShowReviewsModal(true)}
                                className="btn btn-ghost btn-sm mt-2 gap-2"
                            >
                                <StarIcon className="size-4" />Check Reviews
                            </button>
                        )}
                        {!isOwnProfile && (
                            <button
                                onClick={() => setShowReportModal(true)}
                                className="btn btn-ghost btn-xs gap-1 text-error opacity-50 hover:opacity-100 mt-2 transition-opacity"
                            >
                                <FlagIcon className="size-3" />Report Account
                            </button>
                        )}
                    </div>
                </div>

                {/* Personal / Role info */}
                <div className="card bg-base-200 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-2xl mb-4">
                            {user.role === "institute" ? "Institute Information" : "Information"}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {user.role === "institute" && (
                                <>
                                    <div className="flex items-start gap-3">
                                        <UserIcon className="w-5 h-5 text-primary mt-1 shrink-0" />
                                        <div>
                                            <p className="text-sm opacity-70">Type</p>
                                            <span className={`badge capitalize ${user.instituteType === "hospital" ? "badge-warning" : "badge-info"}`}>{user.instituteType}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <UserIcon className="w-5 h-5 text-primary mt-1 shrink-0" />
                                        <div>
                                            <p className="text-sm opacity-70">Contact Person</p>
                                            <p className="font-semibold">{[user.contactFirstName, user.contactLastName].filter(Boolean).join(" ") || "—"}</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {user.birthDate && (
                                <div className="flex items-start gap-3">
                                    <CalendarIcon className="w-5 h-5 text-primary mt-1 shrink-0" />
                                    <div>
                                        <p className="text-sm opacity-70">Date of Birth</p>
                                        <p className="font-semibold">{formatDate(user.birthDate)}</p>
                                    </div>
                                </div>
                            )}

                            {user.sex && (
                                <div className="flex items-start gap-3">
                                    <UserIcon className="w-5 h-5 text-primary mt-1 shrink-0" />
                                    <div>
                                        <p className="text-sm opacity-70">Sex</p>
                                        <p className="font-semibold">{capitalize(user.sex)}</p>
                                    </div>
                                </div>
                            )}

                            {location && (
                                <div className="flex items-start gap-3 md:col-span-2">
                                    <MapPinIcon className="w-5 h-5 text-primary mt-1 shrink-0" />
                                    <div>
                                        <p className="text-sm opacity-70">Location</p>
                                        <p className="font-semibold">{location}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bio */}
                {user.bio && (
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-2">About</h2>
                            <p className="text-base leading-relaxed"><LinkifiedText text={user.bio} /></p>
                        </div>
                    </div>
                )}

                {/* Specialties — doctors only */}
                {user.role === "doctor" && doctorSpecialties.length > 0 && (
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-4">
                                <StarIcon className="w-6 h-6" />Specialties
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {doctorSpecialties.map((s) => (
                                    <span
                                        key={s._id}
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold shadow-sm ${
                                            s.type === "subspecialty"
                                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                                : "border-blue-200 bg-blue-50 text-blue-700"
                                        }`}
                                    >
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Languages */}
                {user.languages?.length > 0 && (
                    <div className="card bg-base-200 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-2xl mb-4">
                                <GlobeIcon className="w-6 h-6" />Languages
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {user.languages.map((lang, i) => (
                                    <div
                                        key={i}
                                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm"
                                    >
                                        {lang}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Report Account Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReportModal(false)}>
                    <div className="bg-base-100 rounded-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-base-300">
                            <div className="flex items-center gap-2">
                                <FlagIcon className="size-4 text-error" />
                                <h3 className="font-semibold">Report Account</h3>
                            </div>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowReportModal(false)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-4">
                            <p className="text-sm opacity-70">Select all that apply. Our admin team will review this report.</p>
                            <div className="space-y-2">
                                {REPORT_REASONS.map(reason => (
                                    <label
                                        key={reason}
                                        className="flex items-center gap-3 p-3 rounded-lg border border-base-300 cursor-pointer hover:bg-base-200 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm checkbox-error"
                                            checked={reportReasons.includes(reason)}
                                            onChange={() => setReportReasons(prev =>
                                                prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
                                            )}
                                        />
                                        <span className="text-sm">{reason}</span>
                                    </label>
                                ))}
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-1">Additional details</p>
                                <textarea
                                    className="textarea textarea-bordered w-full text-sm resize-none"
                                    rows={3}
                                    placeholder="Provide any additional context…"
                                    value={reportDetails}
                                    onChange={e => setReportDetails(e.target.value)}
                                    maxLength={1800}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-base-300 flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowReportModal(false)}>Cancel</button>
                            <button
                                className="btn btn-error btn-sm gap-1"
                                disabled={reportLoading || (reportReasons.length === 0 && !reportDetails.trim())}
                                onClick={handleReport}
                            >
                                {reportLoading && <span className="loading loading-spinner loading-xs" />}
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reviews Modal */}
            {showReviewsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReviewsModal(false)}>
                    <div className="bg-base-100 rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-base-300">
                            <h3 className="font-semibold">Reviews — {getDisplayName()}</h3>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowReviewsModal(false)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="overflow-y-auto">
                            <ReviewsSection providerId={user._id} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OtherProfilePage;
