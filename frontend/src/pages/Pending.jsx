import { ClockIcon } from "lucide-react";
import { Link } from "react-router";
import useAuthUser from "../hooks/useAuthUser";

const PendingPage = () => {
    const { authUser } = useAuthUser();
    const isInstitute = authUser?.role === "institute";

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
            <div className="card bg-base-200 shadow-xl w-full max-w-md text-center p-8">
                <ClockIcon className="mx-auto size-12 text-primary mb-4" />
                <h1 className="text-2xl font-bold mb-2">Your account is pending approval</h1>
                <p className="text-gray-600">
                    Thank you for completing your onboarding. Our team is currently reviewing
                    your information.
                </p>
                {isInstitute && (
                    <div className="mt-6 pt-6 border-t border-base-300">
                        <p className="text-sm opacity-60 mb-2">
                            While you wait, you can optionally set up your department sub-accounts.
                        </p>
                        <Link
                            to="/setup-departments"
                            className="text-primary text-sm font-medium hover:underline"
                        >
                            Set up Department Sub-Accounts →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PendingPage;