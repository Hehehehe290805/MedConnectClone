import { Link } from "react-router";
import { ArrowLeftIcon, ShieldIcon } from "lucide-react";

const PrivacyPolicyPage = () => (
    <div className="min-h-screen bg-base-100 p-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <Link to="/settings" className="btn btn-ghost btn-sm gap-1">
                    <ArrowLeftIcon className="size-4" />Back to Settings
                </Link>
            </div>

            <div className="flex items-center gap-3">
                <ShieldIcon className="size-8 text-primary" />
                <h1 className="text-3xl font-bold">Privacy Policy</h1>
            </div>
            <p className="text-sm opacity-50">Last updated: June 2026</p>

            <div className="card bg-base-200 shadow">
                <div className="card-body space-y-4 text-sm leading-relaxed">
                    <section>
                        <h2 className="font-bold text-lg mb-2">1. Information We Collect</h2>
                        <ul className="list-disc list-inside space-y-1 opacity-80">
                            <li><strong>Account data:</strong> Name, email, phone number, date of birth, sex.</li>
                            <li><strong>Professional credentials:</strong> License numbers (AES-encrypted at rest), license images, legal IDs — stored privately on AWS S3.</li>
                            <li><strong>Health data:</strong> Pre-consultation symptoms, appointment files uploaded by you or your provider.</li>
                            <li><strong>Usage data:</strong> Login times, actions taken on the platform.</li>
                        </ul>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">2. How We Use Your Information</h2>
                        <ul className="list-disc list-inside space-y-1 opacity-80">
                            <li>To facilitate appointment booking and telehealth consultations.</li>
                            <li>To verify healthcare provider credentials during account review.</li>
                            <li>To send appointment notifications and platform alerts via email.</li>
                            <li>To improve the expert system and recommendation algorithms.</li>
                        </ul>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">3. Data Security</h2>
                        <p>Credentials and private files are stored with AES encryption and accessible only via time-limited signed URLs (15 minutes). Passwords are hashed using bcrypt. JWT sessions expire after 24 hours.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">4. Data Sharing</h2>
                        <p>We do not sell your personal data. Your information is shared only with the healthcare providers you book with, and with platform administrators for account verification and dispute resolution.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">5. Data Retention</h2>
                        <p>Accounts scheduled for deletion are permanently removed after 30 days. Rejected accounts are removed after 30 days. Files associated with deleted accounts are removed from storage.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">6. Your Rights</h2>
                        <p>You may request account deletion at any time from Settings → Danger Zone. To request data export or correction, use the Report an Issue feature.</p>
                    </section>
                    <section>
                        <h2 className="font-bold text-lg mb-2">7. Philippine Data Privacy Act (RA 10173)</h2>
                        <p>MedConnect is developed in compliance with Republic Act No. 10173 (Data Privacy Act of 2012). As this platform is currently in development, a formal Data Protection Officer (DPO) designation and National Privacy Commission (NPC) registration are pending. Full compliance documentation will be completed prior to public launch.</p>
                        <p className="mt-2 opacity-70">For privacy concerns or requests to exercise your data subject rights (access, correction, erasure, portability), use the Report an Issue feature in Settings.</p>
                    </section>
                </div>
            </div>
        </div>
    </div>
);

export default PrivacyPolicyPage;
