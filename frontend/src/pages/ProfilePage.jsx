import { useEffect, useState } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  GlobeIcon,
  CreditCardIcon,
  PhoneIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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

  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  // Fetch QR code when component mounts
  useEffect(() => {
    const fetchQRCode = async () => {
      if (!authUser?._id || !authUser?.gcash?.qrData) return;

      try {
        setQrLoading(true);
        setQrError(false);

        // Tell Axios you want a blob
        const response = await axiosInstance.get(`/gcash-setup/gcash/qr/${authUser._id}`, {
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

    // Cleanup function to revoke object URL
    return () => {
      if (qrImageUrl) {
        URL.revokeObjectURL(qrImageUrl);
      }
    };
  }, [authUser?._id]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Not provided";
    return dayjs(dateString).tz(PH_TZ).format("MMMM D, YYYY");
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
                    src={authUser.profilePic}
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
              {authUser?.firstName || "First"} {authUser?.lastName || "Last"}
            </h1>
            <div className="badge badge-primary badge-lg mt-2">
              {capitalize(authUser?.role || "User")}
            </div>
          </div>
        </div>

        {/* PERSONAL INFORMATION CARD */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date of Birth */}
              <div className="flex items-start gap-3">
                <CalendarIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm opacity-70">Date of Birth</p>
                  <p className="font-semibold">
                    {formatDate(authUser?.birthDate)}
                  </p>
                </div>
              </div>

              {/* Gender */}
              <div className="flex items-start gap-3">
                <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm opacity-70">Gender</p>
                  <p className="font-semibold">
                    {capitalize(authUser?.sex) || "Not specified"}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 md:col-span-2">
                <MapPinIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm opacity-70">Location</p>
                  <p className="font-semibold">
                    {authUser?.location || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BIO CARD */}
        {authUser?.bio && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-2">About Me</h2>
              <p className="text-base leading-relaxed">{authUser.bio}</p>
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

        {/* GCASH PAYMENT INFORMATION CARD */}
        {authUser?.gcash &&
          (authUser.gcash.accountName ||
            authUser.gcash.accountNumber ||
            authUser.gcash.qrData) && (
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-2xl">
                    <CreditCardIcon className="w-6 h-6" />
                    GCash Payment Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Name */}
                  <div className="flex items-start gap-3">
                    <UserIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm opacity-70">Account Name</p>
                      <p className="font-semibold">
                        {authUser.gcash.accountName || "Not provided"}
                      </p>
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="flex items-start gap-3">
                    <PhoneIcon className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-sm opacity-70">Phone Number</p>
                      <p className="font-semibold">
                        {formatPhoneNumber(authUser.gcash.accountNumber)}
                      </p>
                    </div>
                  </div>

                  {/* QR Code */}
                  {authUser.gcash.qrData && (
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
                              <span className="text-sm text-center px-4">
                                Unable to load QR code
                              </span>
                            </div>
                          ) : qrImageUrl ? (
                            <img
                              src={qrImageUrl}
                              alt="GCash QR Code"
                              className="w-48 h-48 object-contain"
                            />
                          ) : (
                            <div className="w-48 h-48 flex items-center justify-center">
                              <span className="loading loading-spinner loading-lg text-primary"></span>
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

export default ProfilePage;
