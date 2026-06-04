import { BriefcaseMedicalIcon, WrenchIcon, ArrowLeftIcon } from "lucide-react";
import { useNavigate } from "react-router";

const ComingSoonPage = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
            <div className="card bg-base-200 shadow-xl w-full max-w-md text-center p-8">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-primary hover:underline mb-6 mx-auto">
                    <ArrowLeftIcon className="size-4" /> Go Back
                </button>
                <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <WrenchIcon className="size-10 text-primary" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-3">
                    <BriefcaseMedicalIcon className="size-5 text-primary" />
                    <span className="text-primary font-bold font-mono tracking-wider">MedConnect</span>
                </div>
                <h1 className="text-2xl font-bold mb-3">We're Working On This</h1>
                <p className="opacity-70 text-sm leading-relaxed">
                    This section of MedConnect is currently under development. We're working hard to bring you a great experience. Check back soon!
                </p>
            </div>
        </div>
    );
};

export default ComingSoonPage;