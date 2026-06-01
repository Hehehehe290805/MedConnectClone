import { useState } from "react";
import { Link } from "react-router";
import { BuildingIcon, UsersIcon, ClockIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";

const HomePageInstitute = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";

    return (
        <div className="p-8 space-y-6">
            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30 text-warning-content">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your account is pending approval</p>
                        <p className="text-sm opacity-70">
                            Our team is reviewing your information. While you wait, you can set up your department sub-accounts.{" "}
                            <Link to="/setup-departments" className="underline font-medium">
                                Set up Department Sub-Accounts →
                            </Link>
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold">Welcome, {authUser?.instituteName || "Institute"}</h1>
                <p className="mt-1 text-gray-600 capitalize">{authUser?.instituteType} Dashboard</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card bg-base-100 shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <BuildingIcon className="size-5 text-primary" />
                        <h3 className="font-bold text-lg">Institute Info</h3>
                    </div>
                    <p className="text-sm opacity-70">Type: <span className="capitalize font-medium">{authUser?.instituteType}</span></p>
                    <p className="text-sm opacity-70">Contact: {authUser?.contactFirstName} {authUser?.contactLastName}</p>
                    <p className="text-sm opacity-70">Agency: {authUser?.licensingAgency}</p>
                </div>

                <div className="card bg-base-100 shadow-sm border p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <UsersIcon className="size-5 text-primary" />
                        <h3 className="font-bold text-lg">Department Sub-Accounts</h3>
                    </div>
                    <p className="text-sm opacity-70 mb-3">
                        {authUser?.departmentAccounts?.length || 0} department(s) set up
                    </p>
                    <Link to="/setup-departments" className="btn btn-primary btn-sm">
                        Manage Departments
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HomePageInstitute;