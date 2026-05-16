import { ClockIcon } from "lucide-react";

const OnboardingPage = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
            <div className="card bg-base-200 shadow-xl w-full max-w-md text-center p-8">
                <ClockIcon className="mx-auto size-12 text-primary mb-4" />
                <h1 className="text-2xl font-bold mb-2">Your account is pending approval</h1>
                <p className="text-gray-600">
                    Thank you for completing your onboarding. Our team is currently reviewing
                    your information.
                </p>
            </div>
        </div>
    );
};

export default OnboardingPage;
