const Section = ({ number, title, children }) => (
    <section>
        <h2 className="font-bold text-base mb-2">{number}. {title}</h2>
        <div className="space-y-1.5 opacity-80">{children}</div>
    </section>
);

const Item = ({ n, children }) => (
    <p>{n} {children}</p>
);

const TermsOfServiceContent = () => (
    <div className="space-y-5 text-sm leading-relaxed">
        <Section number="1" title="Sign Up and Login">
            <Item n="1.1">Users must provide accurate, complete, and up-to-date information when creating an account on MedConnect.</Item>
            <Item n="1.2">Patients, doctors, pharmacists, and administrators are responsible for maintaining the confidentiality of their login credentials.</Item>
            <Item n="1.3">Users must not share their accounts with others or allow unauthorized access to their accounts.</Item>
            <Item n="1.4">MedConnect reserves the right to suspend or terminate accounts found to contain false information, fraudulent credentials, or violations of these Terms and Conditions.</Item>
            <Item n="1.5">Licensed healthcare professionals must provide valid credentials for verification before gaining access to professional services on the platform.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="2" title="Privacy Act and Data Protection">
            <Item n="2.1">MedConnect is committed to protecting user privacy and handling personal information in accordance with applicable data protection laws, including the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).</Item>
            <Item n="2.2">We collect information such as names, email addresses, contact information, dates of birth, healthcare credentials, and other data necessary to provide our services.</Item>
            <Item n="2.3">User information is collected, stored, and processed solely for legitimate healthcare, communication, verification, and platform management purposes.</Item>
            <Item n="2.4">MedConnect implements industry-standard security measures to safeguard personal and medical information from unauthorized access, disclosure, or misuse.</Item>
            <Item n="2.5">Users have the right to access, update, or request the deletion of their personal information, subject to legal and regulatory requirements.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="3" title="All Interactions Between Users and Doctors">
            <Item n="3.1">MedConnect serves as a platform that facilitates communication between patients and licensed healthcare professionals.</Item>
            <Item n="3.2">All consultations, advice, recommendations, and medical opinions provided through the platform remain the responsibility of the healthcare professional.</Item>
            <Item n="3.3">Patients must provide accurate health information to ensure appropriate medical guidance and services.</Item>
            <Item n="3.4">MedConnect does not replace emergency medical services and should not be used during life-threatening medical emergencies.</Item>
            <Item n="3.5">Users are expected to maintain respectful and professional conduct during all interactions on the platform.</Item>
            <Item n="3.6">Any abuse, harassment, discrimination, or inappropriate behavior may result in account suspension or termination.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="4" title="Patients, Institutes, and Services">
            <Item n="4.1">Patients may access healthcare services offered by accredited medical professionals, clinics, hospitals, and healthcare institutions registered on MedConnect.</Item>
            <Item n="4.2">Healthcare institutions are responsible for ensuring the accuracy of information regarding their facilities, schedules, and services.</Item>
            <Item n="4.3">MedConnect does not guarantee the availability, outcome, or quality of services provided by third-party healthcare institutions.</Item>
            <Item n="4.4">Appointment scheduling, service requests, and healthcare transactions are subject to the policies and availability of the participating institution.</Item>
            <Item n="4.5">Patients are responsible for reviewing and understanding any requirements, fees, or policies associated with healthcare services before proceeding.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="5" title="Patients and Pharmacy Services">
            <Item n="5.1">MedConnect may facilitate communication and transactions between patients and partner pharmacies.</Item>
            <Item n="5.2">Prescription medications may only be dispensed upon presentation and verification of a valid prescription issued by a licensed healthcare professional.</Item>
            <Item n="5.3">Patients are responsible for ensuring that prescription information submitted through the platform is accurate and valid.</Item>
            <Item n="5.4">Pharmacies are responsible for the quality, availability, dispensing, and delivery of medications offered through their services.</Item>
            <Item n="5.5">MedConnect is not liable for delays, stock shortages, pricing discrepancies, or issues arising from third-party pharmacy operations.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="6" title="Admin Discretion">
            <Item n="6.1">MedConnect administrators reserve the right to monitor platform activities to maintain security, compliance, and service quality.</Item>
            <Item n="6.2">Administrators may review reports, complaints, or suspected violations of platform policies.</Item>
            <Item n="6.3">MedConnect reserves the right to suspend, restrict, or terminate user accounts that violate these Terms and Conditions or engage in activities that compromise platform integrity.</Item>
            <Item n="6.4">Administrators may remove content, restrict access, or take appropriate actions when necessary to protect users, healthcare professionals, and the platform.</Item>
            <Item n="6.5">Decisions made by platform administrators regarding policy enforcement shall be considered final, subject to applicable laws and regulations.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="7" title="Medical Disclaimer">
            <Item n="7.1">MedConnect is not a substitute for professional medical advice, diagnosis, treatment, or emergency medical care.</Item>
            <Item n="7.2">Users should always consult qualified healthcare professionals regarding medical concerns.</Item>
            <Item n="7.3">Reliance on information obtained through the platform is at the user's own discretion and responsibility.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="8" title="Changes to Terms">
            <Item n="8.1">MedConnect reserves the right to modify these Terms and Conditions at any time.</Item>
            <Item n="8.2">Updated terms will be posted within the platform, and continued use of MedConnect constitutes acceptance of any revisions.</Item>
        </Section>

        <div className="divider my-1" />

        <Section number="9" title="Contact Information">
            <p className="opacity-80">For questions, concerns, or privacy-related requests, users may contact:</p>
            <p className="font-medium">
                Email:{" "}
                <a href="mailto:privacy@medconnect-112605.me" className="text-primary hover:underline">
                    privacy@medconnect-112605.me
                </a>
            </p>
        </Section>

        <div className="bg-base-300/50 rounded-lg p-4 text-xs opacity-70 italic">
            By creating an account and using MedConnect, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.
        </div>
    </div>
);

export default TermsOfServiceContent;