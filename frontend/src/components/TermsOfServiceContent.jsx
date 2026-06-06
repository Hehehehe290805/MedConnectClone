const TermsOfServiceContent = () => (
    <div className="space-y-4 text-sm leading-relaxed">
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
            <h2 className="font-bold text-lg mb-2">5. Pharmacy Orders & Prescription Review</h2>
            <p>Pharmacy catalogue items, prices, stock, fulfillment status, and prescription decisions are managed by the pharmacy account. Medicines marked as requiring a prescription must be reviewed and approved by the pharmacy before payment can proceed. Rejected prescription requests may include a reason and pharmacist notes through in-app notifications. By completing pharmacy payment, you confirm that the order details, prescription upload when required, delivery or pickup choice, and total amount are correct.</p>
        </section>
        <section>
            <h2 className="font-bold text-lg mb-2">6. Disclaimer of Medical Advice</h2>
            <p>MedConnect facilitates connections between patients and healthcare providers. The platform's expert system and symptom checker are informational tools only and do not constitute medical diagnosis or advice. Always consult a qualified healthcare professional.</p>
        </section>
        <section>
            <h2 className="font-bold text-lg mb-2">7. Account Suspension</h2>
            <p>Accounts may be suspended for providing false information, failing to renew licenses, or violation of platform policies. Disputes are handled by platform administrators.</p>
        </section>
        <section>
            <h2 className="font-bold text-lg mb-2">8. Modifications</h2>
            <p>MedConnect reserves the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms.</p>
        </section>
        <section>
            <h2 className="font-bold text-lg mb-2">9. Contact</h2>
            <p>For questions about these Terms, please use the Report an Issue feature in Settings.</p>
        </section>
    </div>
);

export default TermsOfServiceContent;
