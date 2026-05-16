import { useEffect, useRef, useState } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import { completeOnboarding, uploadGCashQR } from "../lib/api.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  LoaderIcon,
  MapPinIcon,
  BriefcaseMedicalIcon,
  ShuffleIcon,
} from "lucide-react";
import { LANGUAGES, LOCATIONS } from "../constants/index.js";
import { CameraIcon } from "@heroicons/react/24/outline";

const OnboardingPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [gcashFile, setGcashFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formState, setFormState] = useState({
    role: authUser?.role,
    firstName: authUser?.firstName || "",
    lastName: authUser?.lastName || "",
    birthDate: authUser?.birthDate || "",
    sex: authUser?.sex || "",
    bio: authUser?.bio || "",
    languages: Array.isArray(authUser?.languages)
      ? authUser.languages
      : [],
    location: authUser?.location || "",
    profilePic: authUser?.profilePic || "",
    gcash: {
      qrData: authUser?.gcash?.qrData || "",
      accountName: authUser?.gcash?.accountName || "",
      accountNumber: authUser?.gcash?.accountNumber || "",
      isVerified: authUser?.gcash?.isVerified || false,
    },
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { mutate: onboardingMutation, isPending } = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      toast.success("Profile onboarded successfully");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Onboarding error:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "An unexpected error occurred";
      toast.error(message);
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      onboardingMutation(formState);
      
    } catch (error) {
      console.error("GCash upload error:", error);
      toast.error("Failed to upload GCash QR: " + error.message);
      setIsSubmitting(false);
    }
  };

  const handleRandomAvatar = () => {
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    setFormState({ ...formState, profilePic: randomAvatar });
    toast.success("Random profile picture generated!");
  };

  const handleGcashFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGcashFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState(prev => ({
          ...prev,
          gcash: {
            ...prev.gcash,
            qrData: reader.result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isSubmitDisabled = isPending || isSubmitting;

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="card bg-base-200 w-full max-w-3xl shadow-xl">
        <div className="card-body p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6">
            Complete Your Profile
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PROFILE PIC CONTAINER */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="size-32 rounded-full bg-base-300 overflow-hidden">
                {formState.profilePic ? (
                  <img
                    src={formState.profilePic}
                    alt="Profile Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <CameraIcon className="size-12 text-base-content opacity-40" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="btn btn-primary"
                  disabled={isSubmitDisabled}
                >
                  <ShuffleIcon className="size-4 mr-2" />
                  Generate Random Avatar
                </button>
              </div>
            </div>

            {/* NAME */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">First Name</span>
                </label>
                <input
                  type="text"
                  value={formState.firstName}
                  onChange={(e) =>
                    setFormState({ ...formState, firstName: e.target.value })
                  }
                  className="input input-bordered w-full"
                  placeholder="Your first name"
                  disabled={isSubmitDisabled}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Last Name</span>
                </label>
                <input
                  type="text"
                  value={formState.lastName}
                  onChange={(e) =>
                    setFormState({ ...formState, lastName: e.target.value })
                  }
                  className="input input-bordered w-full"
                  placeholder="Your last name"
                  disabled={isSubmitDisabled}
                />
              </div>
            </div>

            {/* DOB */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Date of Birth</span>
              </label>
              <input
                type="date"
                value={formState.birthDate}
                onChange={(e) =>
                  setFormState({ ...formState, birthDate: e.target.value })
                }
                className="input input-bordered w-full"
                disabled={isSubmitDisabled}
              />
            </div>

            {/* SEX */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Sex</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formState.sex}
                onChange={(e) =>
                  setFormState({ ...formState, sex: e.target.value })
                }
                required
                disabled={isSubmitDisabled}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* BIO */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Bio</span>
              </label>
              <textarea
                value={formState.bio}
                onChange={(e) =>
                  setFormState({ ...formState, bio: e.target.value })
                }
                className="textarea textarea-bordered h-24"
                placeholder="Tell us about yourself"
                disabled={isSubmitDisabled}
              />
            </div>

            <div className="form-control relative" ref={dropdownRef}>
              <label className="label">
                <span className="label-text">Languages</span>
              </label>
              <div
                tabIndex={0}
                className="select select-bordered w-full cursor-pointer"
                onClick={() => !isSubmitDisabled && setIsLangOpen(!isLangOpen)}
              >
                {formState.languages.length > 0
                  ? formState.languages.join(", ")
                  : "Select your languages"}
              </div>

              {isLangOpen && (
                <div className="absolute mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                  {LANGUAGES.map((lang) => (
                    <label
                      key={lang}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formState.languages.includes(lang)}
                        onChange={() => {
                          if (isSubmitDisabled) return;
                          const updated = formState.languages.includes(lang)
                            ? formState.languages.filter((l) => l !== lang)
                            : [...formState.languages, lang];
                          setFormState({
                            ...formState,
                            languages: updated,
                          });
                        }}
                        className="checkbox checkbox-sm"
                        disabled={isSubmitDisabled}
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              )}

              <small className="text-gray-500 mt-1">
                Click to select multiple languages
              </small>
            </div>

            {/* LOCATION */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Location</span>
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content opacity-70 pointer-events-none" />
                  <select
                    value={formState.location}
                    onChange={(e) =>
                      setFormState({ ...formState, location: e.target.value })
                    }
                    className="select select-bordered w-full pl-10"
                    disabled={isSubmitDisabled}
                   >
                   <option value="">Select Location</option>
                    {LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                     {location}
                    </option>
                    ))}
                    </select>
                </div>
              </div>

            {/* GCASH SECTION */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">GCash Payment Details (Optional)</h3>

              {/* GCASH QR CODE IMAGE */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">GCash QR Code</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGcashFileChange}
                    className="file-input file-input-bordered w-full"
                    disabled={isSubmitDisabled}
                  />
                </div>
                {formState.gcash.qrData && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-2">QR Code Preview:</p>
                    <img
                      src={formState.gcash.qrData}
                      alt="GCash QR Code"
                      className="w-32 h-32 object-contain border rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* GCASH ACCOUNT NAME */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">GCash Account Name</span>
                </label>
                <input
                  type="text"
                  value={formState.gcash.accountName}
                  onChange={(e) =>
                    setFormState(prev => ({
                      ...prev,
                      gcash: {
                        ...prev.gcash,
                        accountName: e.target.value
                      }
                    }))
                  }
                  className="input input-bordered w-full"
                  placeholder="John Doe"
                  disabled={isSubmitDisabled}
                />
              </div>

              {/* GCASH PHONE NUMBER */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">GCash Phone Number</span>
                </label>
                <div className="relative">
                  <span className="absolute top-1/2 transform -translate-y-1/2 left-3 text-base-content opacity-70">+63</span>
                  <input
                    type="tel"
                    value={formState.gcash.accountNumber}
                    onChange={(e) =>
                      setFormState(prev => ({
                        ...prev,
                        gcash: {
                          ...prev.gcash,
                          accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10)
                        }
                      }))
                    }
                    className="input input-bordered w-full pl-12"
                    placeholder="9123456789"
                    disabled={isSubmitDisabled}
                  />
                </div>
                <small className="text-gray-500 mt-1">Enter your 10-digit mobile number without +63</small>
              </div>

              {gcashFile && (!formState.gcash.accountName || !formState.gcash.accountNumber) && (
                <div className="alert alert-warning mt-2">
                  <span>Please fill in both account name and phone number to upload GCash QR.</span>
                </div>
              )}
            </div>



            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              {/* BUTTON 1 — Upload GCash QR */}
              <button
                type="button"
                onClick={async () => {
                  if (!gcashFile) {
                    toast.error("Please select a GCash QR file first.");
                    return;
                  }
                  if (!formState.gcash.accountName || !formState.gcash.accountNumber) {
                    toast.error("Please fill in GCash account name and number.");
                    return;
                  }

                  try {
                    setIsSubmitting(true);
                    const formData = new FormData();
                    formData.append("file", gcashFile);
                    formData.append("accountName", formState.gcash.accountName);
                    formData.append(
                      "accountNumber",
                      formState.gcash.accountNumber.replace(/\D/g, "")
                    );

                    const gcashResponse = await uploadGCashQR(formData);
                    setFormState((prev) => ({
                      ...prev,
                      gcash: {
                        ...prev.gcash,
                        ...gcashResponse.gcash,
                        isConfirmed: true, // Add confirmation flag
                      },
                    }));
                    toast.success("GCash confirmed successfully!");
                  } catch (error) {
                    console.error("GCash upload error:", error);
                    toast.error("Failed to upload GCash QR.");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting}
                className="btn btn-outline w-full sm:w-1/2"
              >
                {!isSubmitting ? (
                  <>
                    <LoaderIcon className="size-4 mr-2" />
                    Confirm GCash QR
                  </>
                ) : (
                  <>
                    <LoaderIcon className="animate-spin size-4 mr-2" />
                    Uploading...
                  </>
                )}
              </button>

              {/* BUTTON 2 — Complete Onboarding */}
              <button
                className="btn btn-primary w-full sm:w-1/2"
                disabled={!formState.gcash.isConfirmed || isSubmitDisabled} // Disabled until GCash is confirmed
                type="submit"
              >
                {!isSubmitDisabled ? (
                  <>
                    <BriefcaseMedicalIcon className="size-5 mr-2" />
                    Complete Onboarding
                  </>
                ) : (
                  <>
                    <LoaderIcon className="animate-spin size-5 mr-2" />
                    Onboarding...
                  </>
                )}
              </button>
            </div>

            {/* Status Message */}
            {formState.gcash.isConfirmed ? (
              <div className="alert alert-success mt-4">
                <div className="flex items-center gap-2">
                  <span>GCash confirmed! You can now complete onboarding.</span>
                </div>
              </div>
            ) : (
              <div className="alert alert-warning mt-4">
                <div className="flex items-center gap-2">
                  <span>Please confirm your GCash QR to enable onboarding</span>
                </div>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;