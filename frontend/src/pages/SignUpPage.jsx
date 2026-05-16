import { useState, useEffect } from "react";
import { BriefcaseMedicalIcon } from "lucide-react";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signup } from "../lib/api.js";
import useSignUp from "../hooks/useSignUp.js";

const SignUpPage = () => {
    const [signupData, setSignupData] = useState({
        email: "",
        password: "",
        role: "user",
    });

    //   const queryClient = useQueryClient();
    // const { mutate: signupMutation, isPending, error } = useMutation({
    //     mutationFn: signup,
    //     onSuccess: () => {
    //         queryClient.invalidateQueries({ queryKey: ["authUser"] });
    //     }
    // });
    const { isPending, error, signupMutation } = useSignUp();

    const images = ["/i_0.png", "/i_1.png", "/i_2.png"];
    const texts = [
        "Start your journey to better health with expert care.",
        "Get advice from top medical professionals.",
        "Your trusted partner for reliable medical guidance."
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
        }, 5000); // Change every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const handleSignup = (e) => {
        e.preventDefault();
        signupMutation(signupData);
    };

    return (
        <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="light">
            <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">

                {/* Left section - SIGNUP FORM */}

                <div className="w-full lg:w-1/2 p-4 sm:p-8 flex-col">
                    {/* LOGO */}
                    <div className="mb-4 flex items-center justify-start gap-2">
                        <BriefcaseMedicalIcon className="size-9 text-accent" />
                        <span className="text-accent text-3xl font-bold font-mono tracking-wider"   >
                            MedConnect
                        </span>
                    </div>

                    {/* ERROR MESSAGE IF ANY */}
                    {error && (
                        <div className="alert alert-error mb-4">
                            <span>{error.response.data.message}</span>
                        </div>
                    )}

                    <div className="w-full">
                        <form onSubmit={handleSignup}>
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-semibold">Create an Account</h2>
                                    <p className="text-sm opacity-70">
                                        Live a healthy life today with MedConnect!
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {/* EMAIL */}
                                    <div className="form-control w-full">
                                        <label className="label">
                                            <span className="label-text">Email</span>
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="john@gmail.com"
                                            className="input input-bordered w-full"
                                            value={signupData.email}
                                            onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                    {/* PASSWORD */}
                                    <div className="form-control w-full">
                                        <label className="label">
                                            <span className="label-text">Password</span>
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="********"
                                            className="input input-bordered w-full"
                                            value={signupData.password}
                                            onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                                            required
                                        />
                                        <p className="text-xs opacity-70 mt-1">
                                            Password must be at least 6 characters long
                                        </p>
                                    </div>
                                    {/* ROLE */}
                                    <div className="form-control w-full">
                                        <label className="label">
                                            <span className="label-text">ROLE</span>
                                        </label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={signupData.role}
                                            onChange={(e) => setSignupData({ ...signupData, role: e.target.value })}
                                            required
                                        >
                                            <option value="user">User</option>
                                            <option value="doctor">Doctor</option>
                                            <option value="institute">Institute</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="form-control">
                                        <label className="label cursor-pointer justify-start gap-2">
                                            <input type="checkbox" className="checkbox checkbox-sm" required />
                                            <span className="text-xs leading-tight">
                                                I agree to the{" "}
                                                <span className="text-primary hover:underline">terms of service</span> and{" "}
                                                <span className="text-primary hover:underline">privacy policy</span>
                                            </span>
                                        </label>
                                    </div>

                                    <button className="btn btn-primary w-full text-white" type="submit">
                                        {isPending ? (
                                            <>
                                                <span className="loading loading-spinner loading-xs"></span>
                                                Loading...
                                            </>
                                        ) : (
                                            "Create Account"
                                        )}
                                    </button>
                                    <div className="text-center mt-4">
                                        <p className="text-sm">
                                            Already have an account?{" "}
                                            <Link to="/login" className="text-primary hover:underline">
                                                Sign in
                                            </Link>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right section - SIGNUP FORM */}
                <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
                    <div className="max-w-md p-8">
                        {/* Illustration */}
                        <div className="relative aspect-square max-w-sm mx-auto">
                            <img src={images[currentIndex]} alt="Language connection illustration" className="w-full h-full" />
                        </div>
                        <div className="text-center space-y-3 mt-6">
                            <h2 className="text-xl font-semibold">Connect with licensed professionals</h2>
                            <p className="opacity-70">
                                {texts[currentIndex]}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;