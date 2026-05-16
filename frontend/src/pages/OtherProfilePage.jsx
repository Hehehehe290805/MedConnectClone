import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  GlobeIcon,
  CreditCardIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from "lucide-react";
import useAuthUser from "../hooks/useAuthUser.js";
import { axiosInstance } from "../lib/axios.js";

const OtherProfilePage = () => {
  const { id: userId } = useParams(); // Get userId from URL (matches ChatPage pattern)
  const { authUser } = useAuthUser(); // Current logged-in user
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const isOwnProfile = !userId || userId === authUser?._id;
  const targetUserId = isOwnProfile ? authUser?._id : userId;

  useEffect(() => {
    const fetchUser = async () => {
      if (isOwnProfile && authUser) {
        setUser(authUser);
        setLoading(false);
        return;
      }

      if (!targetUserId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await axiosInstance.get(`/users/${targetUserId}`);
        setUser(response.data.data);

      } catch (err) {
        console.error("Error fetching user:", err);
        setError(err.response?.data?.message || "Failed to fetch user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [targetUserId, isOwnProfile, authUser]);


  useEffect(() => {
    const fetchQRCode = async () => {
      if (!user?._id || !user?.gcash?.qrData) return;
      if (user.role !== "doctor") return;

      try {
        setQrLoading(true);
        setQrError(false);

        const response = await axiosInstance.get(`/gcash-setup/gcash/qr/${user._id}`, {
          responseType: "blob", 
        });

        const imageUrl = URL.createObjectURL(response.data);
        setQrImageUrl(imageUrl);

      } catch (error) {
        console.error("Error fetching QR code:", error);
        setQrError(true);
      } finally {
        setQrLoading(false);
      }
    };

    fetchQRCode();

    return () => {
      if (qrImageUrl) {
        URL.revokeObjectURL(qrImageUrl);
      }
    };
  }, [user?._id, user?.gcash?.qrData, user?.role]);


  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format phone number
  const formatPhoneNumber = (number) => {
    if (!number) return "Not provided";
    return `+63 ${number}`;
  };

  // Capitalize first letter
  const capitalize = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Get display name based on role
  const getDisplayName = () => {
    if (user?.role === "institute") {
      return user.facilityName || "Institute";
    }
    return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircleIcon className="w-16 h-16 text-error mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">{error || "User not found"}</p>
          <button onClick={() => navigate(-1)} className="btn btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button - Only show if viewing another user's profile */}
        {!isOwnProfile && (
          <button onClick={() => navigate(-1)} className="btn btn-ghost gap-2">
            <ArrowLeftIcon className="w-5 h-5" />
            Back
          </button>
        )}

        {/* HEADER CARD - Profile Picture & Name */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body items-center text-center p-8">
            <div className="avatar">
              <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                {user.profilePic ? (
                  <img
                    src={user.profilePic}
                    alt={getDisplayName()}
                  />
                ) : (
                  <div className="bg-base-300 flex items-center justify-center">
                    <UserIcon className="w-16 h-16 text-base-content opacity-40" />
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-3xl font-bold mt-4">{getDisplayName()}</h1>
            <div className="badge badge-primary badge-lg mt-2">
              {capitalize(user.role || "User")}
            </div>
          </div>
        </div>

        {/* PERSONAL INFORMATION CARD */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date of Birth - Only show if provided */}
              {user.birthDate && (
                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Date of Birth</p>
                    <p className="font-semibold">{formatDate(user.birthDate)}</p>
                  </div>
                </div>
              )}

              {/* Gender - Only show if provided */}
              {user.sex && (
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Gender</p>
                    <p className="font-semibold">{capitalize(user.sex)}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {user.location && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm opacity-70">Location</p>
                    <p className="font-semibold">{user.location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BIO CARD */}
        {user.bio && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-2">About</h2>
              <p className="text-base leading-relaxed">{user.bio}</p>
            </div>
          </div>
        )}

        {/* LANGUAGES CARD */}
        {user.languages && user.languages.length > 0 && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">
                <GlobeIcon className="w-6 h-6" />
                Languages
              </h2>
              <div className="flex flex-wrap gap-2">
                {user.languages.map((language, index) => (
                  <div key={index} className="badge badge-lg badge-outline">
                    {language}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GCASH PAYMENT INFORMATION CARD - Only for doctors, institutes, pharmacists */}
        {["doctor", "institute", "pharmacist"].includes(user.role) &&
          user.gcash &&
          (user.gcash.accountName || user.gcash.accountNumber || user.gcash.qrData) && (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-2xl">
                    <CreditCardIcon className="w-6 h-6" />
                    GCash Payment Information
                  </h2>
                  {!user.gcash.isVerified ? (
                    <div className="badge badge-success gap-2">
                      <CheckCircleIcon className="w-4 h-4" />
                      Verified
                    </div>
                  ) : (
                    <div className="badge badge-success gap-2">
                      <XCircleIcon className="w-4 h-4" />
                      Not Verified
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Name */}
                  {user.gcash.accountName && (
                    <div className="flex items-start gap-3">
                      <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm opacity-70">Account Name</p>
                        <p className="font-semibold">{user.gcash.accountName}</p>
                      </div>
                    </div>
                  )}

                  {/* Phone Number */}
                  {user.gcash.accountNumber && (
                    <div className="flex items-start gap-3">
                      <PhoneIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm opacity-70">Phone Number</p>
                        <p className="font-semibold">
                          {formatPhoneNumber(user.gcash.accountNumber)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* QR Code */}
                  {user.gcash.qrData && (
                    <div className="md:col-span-2">
                      <p className="text-sm opacity-70 mb-3">QR Code</p>
                      <div className="flex justify-center md:justify-start">
                        <div className="border-4 border-base-300 rounded-lg p-2 bg-white inline-block">
                          {qrLoading ? (
                            <div className="w-48 h-48 flex items-center justify-center">
                              <span className="loading loading-spinner loading-lg text-primary"></span>
                            </div>
                          ) : qrError ? (
                            <div className="w-48 h-48 flex flex-col items-center justify-center gap-2 text-error">
                              <AlertCircleIcon className="w-8 h-8" />
                              <span className="text-xs text-center px-4">
                                Unable to load QR code
                              </span>
                            </div>
                          ) : qrImageUrl ? (
                            <img
                              src={qrImageUrl}
                              alt="GCash QR Code"
                              className="w-48 h-48 object-contain"
                              onError={() => setQrError(true)}
                            />
                          ) : (
                            <div className="w-48 h-48 flex items-center justify-center">
                              <span className="text-sm text-center px-4 text-gray-500">
                                No QR code available
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default OtherProfilePage;
