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
            <p>A 50% deposit is required to confirm appointments. Platform fees (10%) are collected for MedConnect and deducted from provider-side payouts. Deposits are non-refundable once an appointment is accepted, except where a dispute is resolved in the patient's favor by an admin.</p>
            <ul className="list-disc list-inside space-y-1 opacity-80 mt-2">
                <li>For virtual appointments, the system tracks whether the patient and provider joined the call after the appointment starts.</li>
                <li>If the patient misses the virtual appointment, the same appointment may be rebooked once within three days by paying a rebooking fee equal to 10% of the appointment amount. If the three-day window expires, the appointment is cancelled with no refund.</li>
                <li>If the provider misses the virtual appointment, the patient receives a mock cashback equal to 10% of the appointment amount and may rebook the same appointment once within three days for free. Provider-liable cashback or refunds are shouldered by the provider and do not reverse MedConnect's platform fee.</li>
                <li>If both parties miss the virtual appointment, the same appointment may be rebooked once within three days for free, with no payment exchange recorded for the missed session.</li>
                <li>In-person appointments are recorded manually by the provider and are not covered by automatic virtual no-show detection.</li>
            </ul>
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
            <h2 className="font-bold text-lg mb-2">9. Appointment Queue System</h2>
            <ul className="list-disc list-inside space-y-1 opacity-80">
                <li>Appointment times may shift by up to ±15 minutes due to real-time queue dynamics.</li>
                <li>Emergency cases may be prioritized by the provider, bumping existing queue slots. All affected patients will be notified immediately via in-app notification.</li>
                <li>If you do not respond or engage within 5 minutes of your queue turn, the provider may skip your slot. Accepting the skip moves you to the end of the queue. Refusing the skip is treated as a cancellation — deposits are non-refundable in this case.</li>
                <li>Walk-in patients added by the provider are added to the end of the queue unless classified as an emergency.</li>
            </ul>
        </section>
        <section>
            <h2 className="font-bold text-lg mb-2">10. Contact</h2>
            <p>For questions about these Terms, please use the Report an Issue feature in Settings.</p>
        </section>
    </div>
);

export default TermsOfServiceContent;
