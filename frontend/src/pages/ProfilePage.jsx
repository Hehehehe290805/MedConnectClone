import { useState, useEffect } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  MapPinIcon, UserIcon, CalendarIcon, GlobeIcon, ArrowLeftIcon, StarIcon, XIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import ReviewsSection from "../components/ReviewsSection.jsx";
import LinkifiedText from "../components/LinkifiedText.jsx";
import { axiosInstance } from "../lib/axios.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";


const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  const [doctorSpecialties, setDoctorSpecialties] = useState([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  const isReviewable = ["doctor", "institute"].includes(authUser?.role);
  const { data: reviewSummary } = useQuery({
    queryKey: ["providerReviews", authUser?._id],
    queryFn: () => axiosInstance.get(`/booking/reviews/${authUser._id}`).then(r => r.data?.data),
    enabled: Boolean(authUser?._id && isReviewable),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (authUser?.role === "doctor" && authUser?._id) {
      axiosInstance.get(`/specialties/doctor/${authUser._id}`)
        .then(res => setDoctorSpecialties(res.data.data?.specialties || []))
        .catch(() => setDoctorSpecialties([]));
    }
  }, [authUser?._id, authUser?.role]);


  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    return dayjs(dateString).tz(PH_TZ).format("MMMM D, YYYY");
  };

  const capitalize = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatAddress = (addr) => {
    if (!addr) return "Not provided";
    const parts = [addr.barangay, addr.city, addr.province].filter(Boolean);
    return parts.length ? parts.join(", ") : "Not provided";
  };

  return (
    <div className="min-h-screen bg-base-100 p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 🔙 BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-primary font-semibold hover:underline mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Home
        </button>
        
        {/* HEADER CARD - Profile Picture & Name */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body items-center text-center p-8">
            <div className="avatar">
              <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {authUser?.profilePic ? (
                  <img
                    src={authUser.profilePic.url} 
                    alt={`${authUser.firstName} ${authUser.lastName}`}
                  />
                ) : (
                  <div className="bg-base-300 flex items-center justify-center">
                    <UserIcon className="w-16 h-16 text-base-content opacity-40" />
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold mt-4">
              {authUser?.role === "institute"
                ? (authUser?.instituteName || "Institute")
                : authUser?.role === "department"
                  ? `${authUser?.technologistFirstName || ""} ${authUser?.technologistLastName || ""}`.trim() || "Department"
                  : authUser?.role === "pharmacy"
                    ? `${authUser?.pharmacistFirstName || ""} ${authUser?.pharmacistLastName || ""}`.trim() || "Pharmacy"
                    : `${authUser?.firstName || "First"} ${authUser?.lastName || "Last"}`}
            </h1>
            <div className="badge badge-primary badge-lg mt-2">
              {capitalize(authUser?.role || "User")}
            </div>
            {isReviewable && reviewSummary?.reviewCount > 0 && (
              <button
                onClick={() => setShowReviewsModal(true)}
                className="flex items-center gap-1 mt-2 opacity-70 hover:opacity-100 transition-opacity"
              >
                <StarIcon className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium">{reviewSummary.averageRating?.toFixed(1)}</span>
                <span className="text-xs opacity-60">({reviewSummary.reviewCount} review{reviewSummary.reviewCount !== 1 ? "s" : ""})</span>
              </button>
            )}
            {isReviewable && (
              <button
                onClick={() => setShowReviewsModal(true)}
                className="btn btn-ghost btn-sm mt-2 gap-2"
              >
                <StarIcon className="size-4" />Check Reviews
              </button>
            )}
          </div>
        </div>

        {/* ROLE-SPECIFIC INFORMATION CARD */}
        {authUser?.role === "institute" ? (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Institute Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Institute Name</p>
                    <p className="font-semibold">{authUser?.instituteName || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Type</p>
                    <span className="badge badge-primary capitalize">{authUser?.instituteType || "—"}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Contact Person</p>
                    <p className="font-semibold">{[authUser?.contactFirstName, authUser?.contactLastName].filter(Boolean).join(" ") || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Licensing Agency</p>
                    <p className="font-semibold">{authUser?.licensingAgency || "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Location</p>
                    <p className="font-semibold">{formatAddress(authUser?.address)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : authUser?.role === "department" ? (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Technologist Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Date of Birth</p>
                    <p className="font-semibold">{formatDate(authUser?.birthDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Sex</p>
                    <p className="font-semibold">{capitalize(authUser?.sex) || "Not specified"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Institute</p>
                    <p className="font-semibold">{authUser?.rootInstitute?.instituteName || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Location</p>
                    <p className="font-semibold">{formatAddress(authUser?.address)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : authUser?.role === "pharmacy" ? (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Pharmacist Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Date of Birth</p>
                    <p className="font-semibold">{formatDate(authUser?.birthDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Sex</p>
                    <p className="font-semibold">{capitalize(authUser?.sex) || "Not specified"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Location</p>
                    <p className="font-semibold">{formatAddress(authUser?.address)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Patient / Doctor — original personal info */
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Date of Birth</p>
                    <p className="font-semibold">{formatDate(authUser?.birthDate)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Sex</p>
                    <p className="font-semibold">{capitalize(authUser?.sex) || "Not specified"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Joined</p>
                    <p className="font-semibold">{formatDate(authUser?.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Location</p>
                    <p className="font-semibold">{formatAddress(authUser?.address)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SPECIALTIES — doctors only */}
        {authUser?.role === "doctor" && doctorSpecialties.length > 0 && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">
                <StarIcon className="w-6 h-6" />Specialties
              </h2>
              <div className="flex flex-wrap gap-2">
                {doctorSpecialties.map(s => (
                  <span key={s._id} className={`badge badge-lg ${s.type === "subspecialty" ? "badge-secondary" : "badge-primary"}`}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BIO CARD */}
        {authUser?.bio && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-2">About Me</h2>
              <p className="text-base leading-relaxed"><LinkifiedText text={authUser.bio} /></p>
            </div>
          </div>
        )}

        {/* LANGUAGES CARD */}
        {authUser?.languages && authUser.languages.length > 0 && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">
                <GlobeIcon className="w-6 h-6" />
                Languages
              </h2>
              <div className="flex flex-wrap gap-2">
                {authUser.languages.map((language, index) => (
                  <div key={index} className="badge badge-lg badge-outline">
                    {language}
                  </div>
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
              <h3 className="font-semibold">Reviews</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowReviewsModal(false)}>
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto">
              <ReviewsSection providerId={authUser._id} isOwner={authUser?.role === "doctor"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
