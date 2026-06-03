import { Link } from "react-router";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

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
                <div className="card-body space-y-4 text-sm leading-relaxed">
                    <section>
                        <h2 className="font-bold text-lg mb-2">1. Acceptance of Terms</h2>
                        <p>By accessing and using MedConnect, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">2. Platform Description</h2>
                        <p>MedConnect is a Philippine telehealth platform connecting patients with licensed medical professionals, pharmacies, and health institutions. The platform facilitates appointment booking, consultations, and health record management.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">3. User Responsibilities</h2>
                        <ul className="list-disc list-inside space-y-1 opacity-80">
                            <li>You must provide accurate and complete information during registration.</li>
                            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                            <li>You must not use the platform for any unlawful or fraudulent purpose.</li>
                            <li>Healthcare providers must hold valid, current licenses issued by the Philippine Regulatory Commission (PRC).</li>
                        </ul>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">4. Appointment & Payment Policy</h2>
                        <p>A 50% deposit is required to confirm appointments. Platform fees (10%) are deducted from provider payments. Deposits are non-refundable once an appointment is accepted, except where a dispute is resolved in the patient's favor by an admin.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">5. Disclaimer of Medical Advice</h2>
                        <p>MedConnect facilitates connections between patients and healthcare providers. The platform's expert system and symptom checker are informational tools only and do not constitute medical diagnosis or advice. Always consult a qualified healthcare professional.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">6. Account Suspension</h2>
                        <p>Accounts may be suspended for providing false information, failing to renew licenses, or violation of platform policies. Disputes are handled by platform administrators.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">7. Modifications</h2>
                        <p>MedConnect reserves the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">8. Contact</h2>
                        <p>For questions about these Terms, please use the Report an Issue feature in Settings.</p>
                    </section>
                </div>
            </div>
        </div>
    </div>
);

export default TermsOfServicePage;
