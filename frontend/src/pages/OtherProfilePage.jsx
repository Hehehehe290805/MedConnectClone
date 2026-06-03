import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
    MapPinIcon, UserIcon, CalendarIcon, GlobeIcon,
    AlertCircleIcon, ArrowLeftIcon, StarIcon, NavigationIcon, XIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser.js";
import { axiosInstance } from "../lib/axios.js";
import ReviewsSection from "../components/ReviewsSection.jsx";
import LinkifiedText from "../components/LinkifiedText.jsx";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const OtherProfilePage = () => {
    const { id: userId } = useParams();
    const { authUser } = useAuthUser();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [doctorSpecialties, setDoctorSpecialties] = useState([]);
    const [showReviewsModal, setShowReviewsModal] = useState(false);

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
                                    <span key={s._id} className={`badge badge-lg ${s.type === "subspecialty" ? "badge-secondary" : "badge-primary"}`}>
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
                                    <div key={i} className="badge badge-lg badge-outline">{lang}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>

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
