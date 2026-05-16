import { useEffect, useRef, useState } from "react";
import useAuthUser from "../hooks/useAuthUser.js";
import { completeOnboarding } from "../lib/api.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
    LoaderIcon,
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
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formState, setFormState] = useState({
        role: authUser?.role,
        firstName: authUser?.firstName || "",
        lastName: authUser?.lastName || "",
        birthDate: authUser?.birthDate || "",
        bio: authUser?.bio || "",
        languages: Array.isArray(authUser?.languages)
            ? authUser.languages
            : [],
        location: authUser?.location || "",
        profilePic: authUser?.profilePic || "",
        adminCode: authUser?.adminCode || "",
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
            console.error("Onboarding error:", error);
            toast.error("Failed to complete onboarding: " + error.message);
            setIsSubmitting(false);
        }
    };

    const handleRandomAvatar = () => {
        const idx = Math.floor(Math.random() * 100) + 1;
        const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

        setFormState({ ...formState, profilePic: randomAvatar });
        toast.success("Random profile picture generated!");
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
                            <select
                                value={formState.location}
                                onChange={(e) =>
                                    setFormState({ ...formState, location: e.target.value })
                                }
                                className="select select-bordered w-full"
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

                        {/* ADMIN CODE */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Admin Code</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formState.adminCode}
                                    onChange={(e) =>
                                        setFormState({ ...formState, adminCode: e.target.value })
                                    }
                                    className="input input-bordered w-full"
                                    placeholder="Admin Code"
                                    disabled={isSubmitDisabled}
                                />
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <button
                            className="btn btn-primary w-full mt-6"
                            disabled={isSubmitDisabled}
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
                    </form>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;