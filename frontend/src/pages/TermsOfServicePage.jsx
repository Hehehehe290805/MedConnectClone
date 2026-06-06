import { Link } from "react-router";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";
import TermsOfServiceContent from "../components/TermsOfServiceContent";

const TermsOfServicePage = () => (
    <div className="min-h-screen bg-base-100 p-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <Link to="/settings" className="btn btn-ghost btn-sm gap-1">
                    <ArrowLeftIcon className="size-4" />Back to Settings
                </Link>
            </div>

            <div className="flex items-center gap-3">
                <FileTextIcon className="size-8 text-primary" />
                <h1 className="text-3xl font-bold">Terms of Service</h1>
            </div>
            <p className="text-sm opacity-50">Last updated: June 2026</p>

            <div className="card bg-base-200 shadow">
                <div className="card-body">
                    <TermsOfServiceContent />
                </div>
            </div>
        </div>
    </div>
);

export default TermsOfServicePage;
