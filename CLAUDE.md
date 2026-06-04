# MedConnect — Claude Code Project Guide

## Project Overview
MedConnect is a Philippine telehealth platform (MERN stack) that connects patients with licensed healthcare providers — doctors, pharmacies, clinics, and hospitals — through a unified booking, communication, payment, and file-sharing system. It is designed for the Philippine healthcare context: doctors claim from 52 PRC-recognized specialties, pharmacies hold FDA and pharmacist PRC licenses, institutes hold business permits and operate diagnostic departments as sub-accounts, and all monetary amounts are in Philippine Pesos (PHP).

**End-to-end patient flow:**
1. Patient signs up → verifies email OTP → completes onboarding → immediately `onBoarded`
2. Patient optionally runs the 3-step expert system (`/consultation`): body system → symptoms → duration/age group → Jaccard similarity match against 71 diseases → specialty confidence map stored in `sessionStorage`
3. Patient searches (`/search`) for a doctor or institute; bipartite ranker surfaces top 3 symptom-matched doctors
4. Patient books appointment via `CreateBookingPopup` → pays 50% deposit via Demo Payment screen
5. Doctor/Department accepts → cron transitions `accepted → ongoing` at scheduled start time
6. Post-appointment: in-person → patient marks `completed` (deposit = full payment); virtual → `awaiting_balance → fully_paid` after patient pays balance
7. Patient leaves a review (once, after completion); either party may file a dispute; admin resolves

**Provider onboarding flow (Doctor, Pharmacy, Institute):**
All provider roles submit credentials during onboarding → status set to `pending` → admin reviews and approves/rejects → approved accounts become `onBoarded` and gain full access. Departments skip this: they are created by an already-approved institute and are immediately `onBoarded`.

Student project — actively in development.

## Stack
- **Backend:** Node.js + Express + Mongoose, MongoDB Atlas, AWS S3 (public/private buckets), Stream Chat/Video, Brevo email SDK
- **Frontend:** React + Vite + TailwindCSS + DaisyUI, TanStack Query, Zustand, Leaflet/Nominatim, dayjs, axios

---

## Platform Roles & Feature Standards

### Patient
**Purpose:** The primary consumer of healthcare services on the platform.  
**Onboarding:** Immediately set to `onBoarded` — no admin approval required.

**Current Features:**
- **Expert System** (`/consultation`): 3-step wizard (body system → symptoms → duration/age group). Jaccard similarity against 71 diseases; top 5 matches shown with urgency badges. Generates pre-consultation markdown auto-attached as an `AppointmentFile` at booking time.
- **Search** (`/search`): Multi-filter search (name, specialty, department type, language, location radius). Bipartite ranker surfaces top 3 symptom-matched doctors (`specialtyScore×0.5 + ratingScore×0.3 + proximityScore×0.2`). Multi-term `+` name search supported.
- **Appointment Booking**: `CreateBookingPopup` for doctors — 7-day slot lookahead, pricing fetch from `/api/pricing/appointment-price`. Institute booking path is deprioritized (flag #53).
- **Payment**: 50% deposit via Demo Payment screen. For virtual appointments, 50% balance payment after appointment completes.
- **Appointment Calendar** (`/`): Month grid with status dots; day-click shows detail; list view groups active vs. closed. Opens `ViewPendingAppointmentPatientPopup`.
- **Patient Popup Actions**: Pay deposit, pay balance, cancel, mark complete (in-person only), leave one review (after `completed`/`fully_paid`), file dispute.
- **Chat & Video**: Stream-powered at `/chat/:id` and `/call/:id`. Per-message Tagalog/Cebuano/English translation with cache. Medical term tooltips (70+ terms).
- **Appointment Files**: Upload, list, download (signed URL), delete, PDF export via `AppointmentFilesPanel`.
- **Notifications**: In-app + Brevo email for all appointment lifecycle events.

**Standards:**
- Patient popup never shows provider actions (accept/reject). Only patient-side transitions are callable from `ViewPendingAppointmentPatientPopup`.
- Pre-consultation markdown is generated once at booking — never re-generated or re-attached for the same appointment.
- `specialtyConfidence` in `sessionStorage` is session-only. It is populated by `ConsultationPage` and consumed by `SearchPage`. Do not persist it beyond the browser session.
- Review can only be submitted once per appointment, after status is `completed` or `fully_paid`.

---

### Doctor
**Purpose:** PRC-licensed physician offering virtual and/or in-person consultations.  
**Onboarding:** Submits license number, license image, legal ID → status `pending` → admin approves → `onBoarded`.

**Current Features:**
- **Specialty Claims** (`/specialty`): Claims specialties/subspecialties from PRC-seeded list. Admin must approve before claims become `verified` and searchable. Doctor sees their verified specialties on their own profile.
- **Pricing** (`SetPricePopup`): Single consultation price. Platform takes 10%; live "You receive" calculation shown. Stored in `pricing` collection.
- **Schedule** (`SetSchedulePopup`): Weekly availability (days of week, start/end hour). Stored in `schedules` collection.
- **Appointments Page** (`/appointments`): `DoctorAppointmentsPage` — Active tab (upcoming + ongoing) and History tab (completed/cancelled/rejected/resolved). Each row links to patient profile.
- **Appointment Popup Actions** (`ViewPendingAppointmentDoctorPopup`): Accept, reject (with reason), complete (in-person), file dispute.
- **Home Dashboard** (`/`): Appointment calendar + Transactions tab. Setup cards prompt for pricing and schedule if not yet configured.
- **Chat & Video**: Same Stream path as patient.
- **Appointment Files**: `AppointmentFilesPanel` embedded in the popup.
- **License Renewal**: Via Settings → Licenses & Permits → Renew. Goes through `PermitRenewal` staging; admin approves/rejects; old S3 file deleted on approval.

**Standards:**
- A doctor with no verified specialty claims is still discoverable but won't match specialty-filtered searches. Only `verified` claims count.
- Both pricing AND schedule must be configured before the doctor is bookable. Home page setup cards must remain as a warning state when either is missing.
- Doctor always uses `ViewPendingAppointmentDoctorPopup`. Never render the patient popup for a doctor.
- Any change to the doctor popup must be audited for department impact — both roles share the same popup component.

---

### Pharmacy
**Purpose:** Licensed pharmacy that will offer medicine ordering services (partially implemented).  
**Onboarding:** Submits FDA license and pharmacist PRC license → status `pending` → admin approves → `onBoarded`.

**Current Features:**
- **Home Dashboard** (`/`): Tabbed — **Orders** (placeholder, first tab) | **Manage Catalogue** (placeholder) | **Transactions** (`TransactionList`).
- **Notifications**: Receives approval, rejection, and renewal notifications.
- **Permit Renewal**: FDA license and pharmacist PRC license renewal via `PermitRenewal` flow in Settings.

**Standards:**
- Pharmacy has no appointment or booking involvement at this stage. Its transaction list will populate only when the Orders feature is built.
- The Orders and Manage Catalogue tabs are intentional placeholders — do not replace or remove them without explicit instruction.
- Onboarding requires two private S3 uploads: `fdaLicense` and `pharmacistLicenseImage`. Both must be present before submission.

---

### Institute
**Purpose:** Clinic or hospital that manages diagnostic/lab/therapy departments as sub-accounts.  
**Onboarding:** Submits business permit (+ construction permit for hospitals) → status `pending` → admin approves → `onBoarded`.

**Current Features:**
- **Department Sub-Accounts** (`/setup-departments`): Institute creates Department user accounts stored in `departmentAccounts[]`. Clinics are limited to 1 department type; hospitals can have multiple. `OnboardingDepartment.jsx` shows existing departments as cards and an add-department form.
- **Home Dashboard** (`/`): Tabbed — **Overview** (dept setup prompt or dept count card, institute info cards) | **Transactions** (`TransactionList` with department dropdown to filter by sub-account).
- **Transaction History**: `GET /api/booking/transaction-history` aggregates all sub-account transactions. Optional `?departmentId=` filter.
- **Permit Renewal**: Business/construction permit renewal via `PermitRenewal` flow in Settings.

**Standards:**
- Institute itself does not take appointments — only its Department sub-accounts do. The `instituteId` on an `Appointment` document refers to the department, not the parent institute.
- All departments created by the institute have `rootInstitute` pointing to that institute. Never create a department without a valid `rootInstitute`.
- Clinic type is capped at 1 department type. This is enforced in `DepartmentTypeField.jsx` — do not remove this constraint.
- Transaction dropdown is for filtering only; it does not change the institute's own context or identity.

---

### Department
**Purpose:** Diagnostic/lab/therapy sub-account of an institute that accepts bookings for specific services.  
**Onboarding:** Created by a parent institute via `POST /api/onboarding/department`. Status is set directly to `onBoarded` — no admin approval needed (the parent institute is already approved).

**Current Features:**
- **Service Claims** (`/services`): Claims services from 149 seeded entries across 36 department types. Each claim includes `durationMinutes`. Admin must approve before claims are `verified` and bookable.
- **Appointment Calendar** (`/`): `AppointmentCalendar` with status dots and `ViewPendingAppointmentDoctorPopup` on click.
- **Appointment Popup Actions**: Accept, reject, complete (in-person), dispute — same actions as doctor.
- **Home Dashboard** (`/`): Tabbed — **Appointments** (service setup prompt or verified-services card, dept info, calendar) | **Transactions** (`TransactionList`).
- **Appointment Files**: `AppointmentFilesPanel` embedded in the popup.
- **Technologist License Renewal**: Via Settings → Licenses & Permits → Renew.

**Standards:**
- Department shares `ViewPendingAppointmentDoctorPopup` with the Doctor role. Any popup change affects both — always check both when modifying.
- Department does not have a chat/video sidebar link. Only patients and doctors have the chat feature.
- A department with no verified service claims must show a setup prompt on the home page — not an empty calendar.
- Verified service claims (`institutedepartmentservices` with status `verified`) are required for the department to appear in institute search results.

---

### Admin
**Purpose:** Platform operator who reviews providers, manages content, and resolves disputes.  
**Login:** Separate `POST /api/auth/admin-login` requiring email + password + adminCode. Reached via the "Admin Login →" link on the login page.

**Current Features:**
- **Account Review**: Approve or reject pending accounts individually or in bulk. Rejection requires selecting reason(s) via multi-select modal. Approved/rejected users receive a notification.
- **Home Dashboard** (`/`): Tabbed — All Requests | Pending Accounts | Specialties | Subspecialties | Claims | Renewals | Reports. Each tab has a refresh button.
- **Specialty & Service Management** (`/admin/specialties`): Create, edit, delete specialties, subspecialties, department types, and services. Inline name editing for user-submitted suggestions.
- **Claim Management**: Approve/reject doctor specialty claims and department service claims. Doctor's existing verified specialties are shown in the claim popup before deciding.
- **Permit Renewals**: Approve (deletes old S3 image) or reject (deletes new pending S3 image) renewal requests.
- **Dispute Resolution** (`/admin/reports`): View dispute details, set outcome (`provider_right` / `patient_right` / `split`), add admin note. When outcome is `patient_right`, optional "Issue full refund" checkbox notifies patient of refund amount.
- **User Management** (`/admin/users`): Search/filter all users by role. View account details. Force-delete cleans S3 files and `emailregistry`.
- **App Reports**: View user-submitted bug/UX/feature reports. Advance status (`pending → viewed → resolved`).
- **Notifications**: Receives `notifyAllAdmins` broadcasts for new pending accounts, permit renewals, and disputes.

**Standards:**
- Admin uses the `Admin` model (`admins` collection), not the `User` discriminator. Never conflate the two in queries or middleware.
- Every approve/reject/force-delete action must clean up: S3 private files, `emailregistry` record. Leaving orphaned records is a bug.
- Bulk operations process each user individually and must handle partial failures without aborting the whole batch.
- Dispute resolution is final — there is no undo endpoint. Admin note is required context for the outcome.
- Admin cannot book appointments, use chat, or access any patient/provider feature. The admin UI is entirely separate from the user-facing UI.

---

## Role — Senior Full-Stack Engineer

You are a Senior Full-Stack Engineer on an existing, structured codebase. Understand the system deeply before touching anything.

## Git Rules
Do not run any git commands. No commits, no pushes, no branch creation, no staging, no stashing. File edits only — the developer handles all git operations manually.

### Before Writing Any Code
- Break the problem into clear steps
- Identify edge cases, failure scenarios, and security implications
- Trace all affected areas of the codebase
- If anything is ambiguous — STOP and ask. Do not assume and proceed.

### Code Output Rules
- Existing files: Diffs only (unified diff format, file path at top)
- New files: Complete file with file path at top
- NEVER output full rewrites of existing files unless explicitly asked
- Always read the file before editing it

### When Multiple Issues Are Found
List all identified issues first, then wait for instruction before fixing anything.

---

## Codebase Patterns — Preserve These

| Concern | Rule |
|---|---|
| API responses | Always use `sendSuccess` / `sendError` helpers |
| Async handlers | Wrap controllers in `asyncHandler` |
| Structure | Maintain route → controller → validator separation |
| Auth | `protectRoute` sets `req.user` from JWT. Always use `req.user._id` (ObjectId) — never `req.user.id` (string) |
| Frontend state | Zustand for client state, TanStack Query for server state, axios via `axiosInstance` |
| Comments | Minimal — only for non-obvious logic. No JSDoc |
| Models | Discriminator pattern — `User` is base, roles extend via `User.discriminator()` |
| Image fields | Always `{ url, key }` shape. Public files have both. Private files have `key` only, empty `url` |

### Auth Pattern
- `protectRoute` middleware sets `req.user` from JWT cookie (1-day TTL)
- Use `req.user._id` (ObjectId) — never `req.user.id` (string)
- Admin uses separate `Admin` model (not a discriminator), also set on `req.user` via protectRoute
- Regular `POST /api/auth/login` only checks the `User` collection — admins must use `POST /api/auth/admin-login` (which requires email + password + adminCode)

### API Response Helpers
```js
sendSuccess(res, statusCode, message, data)
sendError(res, statusCode, message, errors?)
```

### File Upload Pattern
- All uploads go through `POST /api/upload` with `field` and `file` in FormData
- `FOLDER_MAP` in `upload.controller.js` maps field names to S3 folders
- Public files: `public/profilepics/...` — have real URL
- Private files: `private/licenses/...`, `private/permits/...`, `private/appointment-files/...` — no public URL, use signed URLs (15-min TTL)
- S3 cleanup is always non-fatal (try/catch around `deleteFromS3`)

### Frontend Image Upload Pattern
- `ImageUploadField` stores `{ file }` locally on selection
- `uploadPendingImages(form, fieldNames)` helper uploads to S3 on form submit
- Profile pics are public, all credentials/permits/appointment files are private

---

## Date/Time
All date/time logic must use `dayjs` with `utc` and `timezone` plugins, scoped to `Asia/Manila` (UTC+8).

---

## Appointment Status Machine
11 statuses with a strict flow:
```
pending_payment → deposit_paid → accepted → ongoing
  → completed            (in-person: deposit covers full payment)
  → awaiting_balance → fully_paid  (virtual: 50% deposit + 50% balance)
Also: rejected (auto-deleted 24h by cron), cancelled, disputed → resolved
```
Cron jobs drive transitions: `accepted → ongoing` every 30s; `ongoing → awaiting_balance/fully_paid` every 5 min.
Before modifying any appointment logic, trace the full status flow. Do not add, skip, or rename statuses without explicit instruction.

---

## Refactoring Rules
Do not refactor unless it directly enables a bug fix, security improvement, or scalability improvement. Prefer minimal, incremental changes.

---

## Models

### Role Hierarchy
```
User (base — users collection)
├── Patient
├── Doctor
├── Pharmacy
├── Institute
└── Department

Admin (separate admins collection — not a discriminator)
```

### Base User Fields (all roles inherit)
`email`, `password` (bcrypt), `role`, `status`, `phoneNumber`, `phoneType`, `profilePic {url,key}`, `approvedBy` (ref Admin), `pendingDeletion`, `deletionRequestedAt`, `resetPasswordCode/Expiry`, `lastPasswordChange`, `twoFactorEnabled`, `loginAttempts`, `loginLockedAt`, `birthDate`, `createdAt`

### Role-Specific Fields
| Role | Key Fields |
|---|---|
| Patient | `firstName`, `lastName`, `sex`, `bio`, `languages[]`, `address` |
| Doctor | `firstName`, `lastName`, `sex`, `bio`, `languages[]`, `address`, `licenseNumber` (encrypted), `licenseExpiration`, `licenseImage {key}`, `legalIDImage {key}`, `specialty[]`, `subSpecialty[]` |
| Pharmacy | `pharmacyName`, `pharmacistFirstName/LastName`, `sex`, `bio`, `address`, `businessPermit {key}`, `fdaLicense {key}`, `pharmacistLicenseNumber` (encrypted), `pharmacistLicenseExpiration`, `pharmacistLicenseImage {key}`, `pharmacistLegalIDImage {key}` |
| Institute | `instituteName`, `instituteType` (clinic/hospital), `contactFirstName/LastName`, `licensingAgency`, `address`, `businessPermit {key}`, `constructionPermit {key}` (hospital only), `departmentAccounts []` (ObjectId refs to Department users) |
| Department | `technologistFirstName/LastName`, `sex`, `bio`, `address`, `departmentId`, `departmentType`, `rootInstitute` (ref User/Institute), `technologistLicenseNumber` (encrypted), `technologistLicenseExpiration`, `technologistLicenseImage {key}`, `technologistLegalIDImage {key}` |
| Admin | `firstName`, `lastName`, `email`, `password`, `adminCode` (bcrypt-hashed), `profilePic`, `status`, `twoFactorEnabled`, `loginAttempts`, `loginLockedAt`, `role: "admin"` (immutable) |

### Status Enum (User + Admin)
`notOnBoarded` → `pending` → `onBoarded` → `needsRenewal` → `pendingRenewal` → `pendingRenewalExpired` → `suspended`
Also: `rejected`

### Other Collections
| Collection | Purpose |
|---|---|
| `specialties` | 52 PRC-recognized specialties (seeded) |
| `subspecialties` | 197 entries; compound unique `{name, rootSpecialty}` |
| `departmenttypes` | 36 diagnostic/lab/therapy types (seeded) |
| `services` | 149 services; compound unique `{name, rootDepartmentType}` |
| `doctorspecialties` | Link: doctor ↔ specialty/subspecialty claim; `status`, `claimType`, `approvedBy` |
| `institutedepartmentservices` | Link: department ↔ service claim; `status`, `durationMinutes` |
| `emailregistry` | Tracks email → model mapping for global uniqueness |
| `verificationcodes` | OTP codes for signup, email change, password change, permit renewal, 2FA; TTL index on `expiresAt` |
| `notifications` | In-app: `recipient`, `type` (enum), `title`, `body`, `isRead`; indexes on `{recipient, isRead}`, `{recipient, createdAt}` |
| `permitrenewals` | Staging: `userId`, `type`, `newImage {key}`, `newLicenseNumber`, `newExpiration`, `status`, `approvedBy`, `rejectionReason` |
| `appointments` | Full appointment record; fields: `doctorId`, `instituteId`, `patientId`, `serviceId`, `virtual`, `start/end`, `amount`, `platformFee`, `depositAmount/balanceAmount`, `depositPaid/balancePaid`, `depositRef/balanceRef`, `status`, `rating`, `review`, `rejectionReason`, `rejectedAt` |
| `transactions` | `appointmentId`, `payerId`, `payeeId`, `amount`, `platformFee`, `netAmount`, `type` (deposit/balance), `referenceNumber` |
| `appointmentfiles` | `appointmentId`, `uploadedBy`, `uploaderRole`, `fileType` (preconsultation/note/image/lab_report/document), `filename`, `s3Key`, `mimeType` |
| `reports` | Appointment disputes: `appointmentId`, `reason`, `filedBy`, `filedAgainst`, `status`, `outcome` (provider_right/patient_right/split), `adminNote`, `resolvedBy` |
| `appreports` | User bug/UX/feature reports: `userId`, `category`, `subject`, `description`, `status` (pending/viewed/resolved) |
| `schedules` | Provider availability: `doctorId` or `instituteId`, `daysOfWeek[]`, `startHour`, `endHour` |
| `pricing` | `providerId`, `serviceId`, `price` |

---

## Route Structure

### `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Create account + send email verify code |
| POST | `/signup/verify` | Verify signup OTP, set JWT cookie |
| POST | `/signup/resend` | Resend signup verify code |
| POST | `/login` | User-only login (checks User collection). Returns `requires2FA` or sets cookie. Tracks `loginAttempts`; on 5th failure sends reset code and locks. |
| POST | `/admin-login` | Admin login (email + password + adminCode). Returns `requires2FA` or sets cookie. |
| POST | `/verify-2fa` | Verify 6-digit 2FA code, set JWT cookie. Admin path confirmed via `payload.adminVerified` |
| PATCH | `/toggle-2fa` | Toggle `twoFactorEnabled` on own account (protectRoute) |
| POST | `/logout` | Clear JWT cookie |
| GET | `/me` | Get current user (returns `twoFactorEnabled`) |
| PATCH | `/update-profile` | Update non-credential profile fields (role-allowlisted) |
| POST | `/update-email/request` | Step 1: verify current email (OTP) |
| POST | `/update-email/verify-current` | Step 2: verify OTP on current email |
| POST | `/update-email/verify-new` | Step 3: verify OTP on new email, apply change |
| POST | `/update-password/request` | Step 1: send password change OTP |
| POST | `/update-password/verify` | Step 2: verify OTP, apply new password |
| POST | `/forgot-password` | Send reset code to email (admin requires adminCode) |
| POST | `/forgot-password/verify` | Verify reset code (check only) |
| POST | `/forgot-password/reset` | Apply new password + clear loginAttempts |
| DELETE | `/delete-me` | Request 30-day soft-delete |

### `/api/onboarding`
`POST /patient`, `/doctor`, `/pharmacy`, `/institute`, `/admin`, `/department`
All set status to `pending` (except department which is set `onBoarded` by institute).

### `/api/upload`
- `POST /` — upload file to S3 (returns `{url, key}`)
- `GET /signed-url?key=...` — generate 15-min signed URL; admin or file-owner only

### `/api/specialties`
`GET /` (all verified), `GET /subspecialties?specialtyId=`, `POST /suggest`, `POST /claim`

### `/api/services`
`GET /department-types`, `GET /?departmentTypeId=`, `POST /suggest`, `POST /claim`, `GET /my-services`

### `/api/admin`
Pending review, bulk ops, suggestion/claim management, specialty/service direct CRUD (13 endpoints), permit renewals, complaints, user management, force-delete.

### `/api/booking`
`POST /book` (accepts `preConsultationMarkdown`), `POST /pay-deposit`, `POST /accept`, `POST /reject`, `POST /cancel`, `POST /complete`, `POST /pay-balance`, `POST /dispute`, `POST /review`, `GET /my-appointments`, `GET /transaction-history` (institute: queries all dept sub-accounts; accepts `?departmentId=`), `GET /reviews/:providerId`

### `/api/chat`
`GET /token` (Stream Chat token), `POST /translate` (MyMemory proxy)

### `/api/doctor-schedule`
`POST /availability`, `GET /get-availability`

### `/api/pricing`
`POST /set-pricing`, `GET /appointment-price`

### `/api/permits`
`POST /renewal/request`, `GET /renewal/my-renewals`

### `/api/search`
`GET /doctors`, `GET /institutes` — Haversine proximity + multi-filter + rating aggregation

### `/api/users`
`GET /doctors`, `GET /institutes`, `GET /:userId`

### `/api/notifications`
`GET /`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`

### `/api/appointment-files`
`POST /:appointmentId` (upload, 5 MB), `GET /:appointmentId` (list), `GET /:appointmentId/signed-url/:fileId`, `DELETE /:appointmentId/:fileId`

### `/api/app-reports`
`POST /` (any authenticated user), `GET /` (admin), `PATCH /:id/status` (admin)

---

## Security Layer

| Layer | Implementation |
|---|---|
| Body sanitization | `sanitize.middleware.js` — strips HTML tags from all string values, drops `$`-prefixed keys (NoSQL injection) |
| XSS render | React escapes all string content by default; `LinkifiedText.jsx` renders bio URLs without `dangerouslySetInnerHTML` |
| Password hashing | bcrypt (salt 10) on User + Admin; adminCode also bcrypt-hashed |
| JWT | 1-day TTL, httpOnly cookie, sameSite strict, secure in production |
| Brute-force | 5 wrong passwords → `loginAttempts` reaches limit → account locked (`loginLockedAt`), reset code emailed automatically. Counter clears on successful login or `resetForgotPassword`. |
| 2FA | `twoFactorEnabled` toggle in Settings. On login: OTP sent via Brevo email, verified at `POST /api/auth/verify-2fa`. Admin 2FA requires password + adminCode first; confirmed via `payload.adminVerified` flag in VerificationCode record. |
| S3 signed URLs | Private files only — 15-min TTL, admin or file-owner only |
| Sensitive fields | `licenseNumber`, `pharmacistLicenseNumber`, `technologistLicenseNumber` AES-encrypted at rest via `encrypt/decrypt` utils |
| S3 cleanup | Old profilePic deleted on `updateMeProfile`; old license/permit on `approveRenewal`; pending new image on `rejectRenewal`; all files on `rejectRole`, `bulkReject`, `adminForceDeleteUser`, 30-day cron sweep |

---

## Frontend Architecture

### Pages by Route
| Route | Component | Roles |
|---|---|---|
| `/` | `HomePageUser` / `HomePageDoctor` / `HomePagePharmacy` / `HomePageInstitute` / `HomePageDepartment` / `HomePageAdmin` | All |
| `/consultation` | `ConsultationPage` | Patient |
| `/search` | `SearchPage` | Patient |
| `/appointments` | ComingSoonPage | Doctor (pending build) |
| `/specialty` | `SpecialtyPage` | Doctor |
| `/setup-departments` | `OnboardingDepartment` | Institute |
| `/services` | ComingSoonPage | Department (pending build) |
| `/transactions` | `TransactionPage` | All except Admin |
| `/notifications` | `NotificationsPage` | All except Admin |
| `/settings` | `SettingsPage` | All |
| `/profile` | `ProfilePage` | All |
| `/profile/:id` | `OtherProfilePage` | All |
| `/chat/:id` | `ChatPage` | Patient, Doctor |
| `/call/:id` | `CallPage` | Patient, Doctor |
| `/admin/users` | `UserManagementPage` | Admin |
| `/admin/specialties` | `AdminSpecialtiesPage` | Admin |
| `/admin/reports` | `AdminReportsPage` | Admin |
| `/login` | `LoginPage` | Public |
| `/signup` | `SignUpPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/onboarding` | `OnboardingPage` | Authenticated, notOnBoarded |
| `/pending` | `Pending` | Admin, pending status |

### Home Pages (per role)

**Patient (`HomePageUser`)** — pending banner; Book Now card (→ /consultation or /search); `AppointmentCalendar` with calendar/list toggle + `ViewPendingAppointmentPatientPopup` on click.

**Doctor (`HomePageDoctor`)** — pending banner; tabbed: **Appointments** (setup warning or success card, pricing card, schedule card, `AppointmentCalendar` + `ViewPendingAppointmentDoctorPopup`) | **Transactions** (`TransactionList`).

**Pharmacy (`HomePagePharmacy`)** — pending banner; tabbed: **Manage Catalogue** (placeholder) | **Transactions** (`TransactionList`).

**Institute (`HomePageInstitute`)** — pending banner; tabbed: **Overview** (sub-account setup prompt or dept count card, institute info cards) | **Transactions** (`TransactionList` with department dropdown filter).

**Department (`HomePageDepartment`)** — pending banner; tabbed: **Appointments** (services setup prompt or verified-services card, dept info cards, `AppointmentCalendar` + `ViewPendingAppointmentDoctorPopup`) | **Transactions** (`TransactionList`).

**Admin (`HomePageAdmin`)** — tabbed: All Requests | Pending Accounts | Specialties | Subspecialties | Claims | Renewals | Reports; bulk approve/reject; inline suggestion name edit; approve-with-items transaction.

### Key Shared Components
| Component | Purpose |
|---|---|
| `AppointmentCalendar.jsx` | Calendar/list toggle; 7-col month grid; month nav; status dots; day-click detail; list view groups active vs closed; counterpart name from populated data |
| `TransactionList.jsx` | Summary stats + table; accepts optional `departmentId` for institute filter |
| `PendingAppointment.jsx` | Appointment card with counterpart name lookup, Message button, View Details |
| `AppointmentFilesPanel.jsx` | Upload (WebP auto-convert), list, download (signed URL), delete, PDF export; props: `appointmentId`, `participantRole`, `readOnly` |
| `LinkifiedText.jsx` | Auto-links URLs and emails in plain text; click shows "Leaving MedConnect" confirmation modal before navigating |
| `Sidebar.jsx` | Role-aware navigation links; disabled when `status === "pending"` |
| `Navbar.jsx` | Notifications badge (polls unread-count every 30s) |
| `Layout.jsx` | Wraps pages with Sidebar + Navbar |
| `MapPinModal.jsx` | Leaflet map for address coordinate pinning |
| `SpecialtyField.jsx` | Specialty + subspecialty search/add with pending local state |
| `DepartmentTypeField.jsx` | Department type search/add; clinic limited to 1 |
| `ReviewsSection.jsx` | Star rating distribution + review list for provider profiles |
| `MedicalChatMessage.jsx` | Stream Chat renderer: medical term tooltips (70+ terms), per-message translation (Tagalog/Cebuano/English), translation cache |

### Popups / Modals
| Component | Purpose |
|---|---|
| `ViewPendingAppointmentPatientPopup.jsx` | Patient detail modal: pay deposit/balance, cancel, complete, review, dispute |
| `ViewPendingAppointmentDoctorPopup.jsx` | Doctor/department detail modal: accept/reject, complete, dispute |
| `SetPricePopup.jsx` | Doctor consultation price form |
| `SetSchedulePopup.jsx` | Doctor/department availability form |

### Login Flow (LoginPage.jsx)
Three steps via component state:
1. `"user"` — email + password. Subtle "Admin Login →" text link at bottom.
2. `"admin"` — email + password + admin code all at once.
3. `"twoFactor"` — 6-digit code entry (both user and admin paths).

### Forgot Password Flow
`ForgotPasswordPage` → role picker modal on mount (User / Admin) → `ForgotPasswordVerifyPage` → `ForgotPasswordResetPage`. Admin path requires adminCode field.

### Settings Page
- **Update Credentials** — email or password, OTP-verified, once-per-month, admin requires adminCode
- **Two-Factor Authentication** — toggle switch → `PATCH /api/auth/toggle-2fa`
- **Licenses & Permits** — status badges, Renew button per item, renewal popup (doctor/pharmacy/institute/department only)
- **Help & Support** — FAQ accordion (8 items), Report an Issue form (POST /api/app-reports)
- **Danger Zone** — Delete Account (30-day soft-delete)

---

## Services & Background Jobs

### notification.service.js
- `notify(recipientId, type, title, body)` — creates `Notification` record + sends Brevo email; always non-fatal
- `notifyAllAdmins(type, title, body)` — broadcasts to all `onBoarded` admins; looks up email in Admin collection

### Notification Types
`role_approved`, `role_rejected`, `suggestion_approved`, `suggestion_rejected`, `claim_approved`, `claim_rejected`, `renewal_approved`, `renewal_rejected`, `license_expiring_soon`, `license_expired`, `appointment_booked`, `appointment_accepted`, `appointment_rejected`, `appointment_cancelled`, `appointment_started`, `appointment_completed`, `payment_received`, `dispute_filed`, `dispute_resolved`, `new_account_pending`, `account_deletion_requested`, `renewal_submitted`, `dispute_admin_alert`

### email.js (Brevo SDK)
`sendVerificationCode(email, code)` — OTP email for auth flows  
`sendNotificationEmail(email, title, body)` — event notification email

### Cron Jobs (cronJobs.js)
| Schedule | Job |
|---|---|
| Every 30s | `accepted → ongoing` transition |
| Every 5 min | `ongoing → awaiting_balance/fully_paid` + delete rejected appointments after 24h |
| Daily midnight | 30-day soft-delete sweep + S3 cleanup |
| Daily 1am | License expiry checker: `onBoarded → needsRenewal` (60 days before), `needsRenewal → suspended` (expired) |

### Expert System (ConsultationPage)
- 3-step symptom wizard: body system → symptoms (8 per system) → duration/age group
- Jaccard similarity against `diseaseSymptoms.json` (71 diseases, 12 body systems)
- Scores normalized to `confidence` (0–1); top 5 matches shown with urgency badges
- Stores `specialtyConfidence` map in `sessionStorage` → used by SearchPage bipartite ranker
- Pre-consultation markdown auto-generated and attached as `AppointmentFile` on booking

### SearchPage Bipartite Ranker
Reads `specialtyConfidence` from sessionStorage; scores doctors as `specialtyScore×0.5 + ratingScore×0.3 + proximityScore×0.2` (proximity: `1/(1 + distanceKm×0.05)`); top 3 shown in "Recommended for Your Symptoms" section with % badge.

### Chat (Stream)
- `ChatPage.jsx` uses Stream Chat SDK
- `MedicalChatMessage.jsx` — custom message renderer
- `POST /api/chat/translate` — proxies to MyMemory free API; auto-detects source; graceful fallback

---

## Environment Variables (do NOT hardcode)
```
MONGO_URI
JWT_SECRET_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_BUCKET_NAME
AWS_REGION
STREAM_API_KEY
STREAM_SECRET
ENCRYPTION_KEY
ADMIN_CODE
```

---

## Recent Changes & Important Notes

### Expert System Data (must commit to git)
- `diseaseSymptoms.json` expanded to **71 diseases** (was 61); added: Leptospirosis, Schistosomiasis, Rheumatic Fever, Pancreatitis, Acute Cholecystitis, Chronic Kidney Disease, Nephrotic Syndrome, Uterine Fibroids, Preeclampsia, Schizophrenia
- **DEPLOYMENT BLOCKER**: `frontend/src/data/diseaseSymptoms.json` and `frontend/src/data/termAliases.json` are untracked in git. Run `git add` on both before deploying. The app imports these at build time — missing files = expert system crash.

### Login Page — 4 Steps
`LoginPage.jsx` now has 4 steps:
- `"user"` — email + password (default)
- `"admin"` — email + password + admin code (reached via subtle "Admin Login →" link)
- `"twoFactor"` — 6-digit code (both user and admin paths)
- `"locked"` — brute-force lockout recovery: email + 6-digit reset code + new password; calls `POST /api/auth/forgot-password/reset`; transitions back to `"user"` on success. Triggered automatically when login/adminLogin return HTTP 429.

### ForgotPasswordResetPage
On success: clears Zustand store → `toast.success` → `navigate("/login")`. Already implemented correctly.

### Session 2026-06-04 — Email Notification Toggle
Added per-user opt-out for notification emails. Verification/security codes (OTP, 2FA, signup, password/email change) are always sent regardless of this setting.

**Backend:**
- `User.js` (base schema): `emailNotificationsEnabled: Boolean, default true` — inherited by all role discriminators
- `Admin.js`: same field added
- `notification.service.js`: `resolveEmail` replaced with `resolveEmailAndPrefs`; `notify()` skips `sendNotificationEmail` when recipient has opted out — in-app `Notification` record is always created
- `auth.controller.js`: `emailNotificationsEnabled` added to `getMe` base fields; new `toggleEmailNotifications` controller (mirrors `toggle2FA`)
- `auth.route.js`: `PATCH /api/auth/toggle-email-notifications` (protectRoute)

**Frontend:**
- `api.js`: `toggleEmailNotifications()` added
- `SettingsPage.jsx`: "Email Notifications" card with toggle between 2FA and Help & Support; description clarifies security codes are unaffected

### Session 2026-06-03 Part 4 — Final Sweep
- **#48**: Removed redundant "Details" accordion button from HomePageAdmin accounts tab; "Review" handles everything
- **#23**: `AppointmentFilesPanel` now embedded in both `ViewPendingAppointmentPatientPopup` and `ViewPendingAppointmentDoctorPopup` (after the main actions, before dispute)
- **#16**: `TermsOfServicePage.jsx` and `PrivacyPolicyPage.jsx` created; registered at `/terms-of-service` and `/privacy-policy`; Settings links updated to use `<Link>` instead of `<a>`
- **#41**: Cron's midnight sweep now hard-deletes rejected accounts older than 30 days (S3 + EmailRegistry cleanup included)
- **#8**: MockGCashPage rebranded from GCash-styled to a clear "Demo Payment" / "Simulated Payment" screen; warns users no real funds are transferred
- **SetPricePopup**: Added "Platform takes 10% per transaction" disclaimer with live "You receive" calculation

### Session 2026-06-03 Part 3 — More Fixes
**Doctor appointments page** (#54/#23): New `DoctorAppointmentsPage.jsx` at `/appointments` — Active tab (upcoming + ongoing) and History tab (completed/cancelled/rejected/resolved). Each row shows patient name with profile link. Clicking opens `ViewPendingAppointmentDoctorPopup`.

**Clinic dept management** (#64): `OnboardingDepartment.jsx` now shows a card view for clinics with existing departments instead of re-entering the form. Hospitals show existing department cards + "Add Department" button.

**License expiry cron** (#65): Added idempotent daily guard — checks Notification collection before sending. Also now sends daily reminders to existing `needsRenewal` users (not just on initial transition).

**`approvedBy` refs** (#67): Audited — all models already use `ref: "Admin"` correctly. No changes needed.

**Patient/doctor profile links in appointment popups**: Both `ViewPendingAppointmentPatientPopup` and `ViewPendingAppointmentDoctorPopup` now have profile links in the header.

### Session 2026-06-03 Part 2 — Continued Fixes
**Backend:**
- `search.controller.js`: multi-term `+` name search now supported for both doctors and institutes; doctor search also matches by specialty/subspecialty name; institute search also matches by dept type name and service name
- `resolveComplaint`: added `issueRefund` option — when `outcome === "patient_right"` and `issueRefund: true`, notifies patient with refund amount
- Refund amount = sum of paid amounts (deposit + balance if applicable)

**Frontend fixes:**
- `FilterSearch`: all data paths fixed (`r.data?.data?.items` → `r.data.items`); dept types endpoint fixed to `/services/department-types`
- `CreateBookingPopup`: completely rebuilt — removed broken service-fetch that crashed on null serviceId; now fetches from correct pricing endpoint; slots from correct public calendar endpoint; 7-day lookahead; proper empty-state text
- `ProfilePage` (#38): doctors now see their verified specialties on own profile (via `GET /specialties/doctor/:id`)
- `ViewPendingAppointmentPatientPopup` (#31): added "Doctor Profile" link in header
- `SearchPage` (#55): multi-term `+` syntax supported in buildParams; updated placeholder text; hint text added below search bar
- `AdminReportsPage` + `HomePageAdmin`: dispute resolve modal now shows "Issue full refund to patient" checkbox when outcome is "patient_right"
- Remaining `window.confirm` removed from `PendingClaim`, `PendingUser`, `PendingSuggestion`; all wrong endpoints in those files fixed
- `ViewPendingReportPopup`: alert bars → toasts

### Session 2026-06-03 — Bulk Fix Session
**Backend fixes:**
- `verifyPasswordUpdate` now uses `.save()` to trigger pre-save hash hook (was using `findByIdAndUpdate` — passwords stored as plaintext)
- `requestPasswordUpdate`/`requestEmailUpdate`: added `!freshUser.password` guard; admin code check now uses freshly-fetched admin doc
- `s3.js`: fixed env var from `AWS_S3_BUCKET` → `AWS_BUCKET_NAME` (affected all S3 operations including signed URLs and force-delete cleanup)
- `getMe` for institute: added `constructionPermit`, `constructionPermitExpiration`, `businessPermit` to returned fields
- `profileFieldsByRole`: added `institute` and `department` entries so bio editing works for those roles
- `rejectRole`: now accepts `rejectionReason` param and includes it in the notification message
- `DoctorSpecialty` model: added `"rejected"` to status enum (was missing, causing `rejectClaim` to fail silently)

**Frontend fixes:**
- `SpecialtyPage`: fixed wrong endpoint `/specialties-and-services/doctor-specialties` → `/specialties/doctor-specialties`
- `ViewAllSpecialtiesPopup` + `SuggestPopup`: fixed all endpoints (were calling `/specialties-and-services/*` which doesn't exist; claims were never being created)
- `App.jsx`: admin added to `/notifications` route allowedRoles
- `Navbar.jsx`: notification badge `badge-error` → `badge-info`; unread count query now enabled for all roles including admin

**Admin UI overhaul:**
- All `window.confirm`/`window.alert` replaced with DaisyUI modals in `HomePageAdmin`, `ViewPendingUserPopup`, `ViewPendingClaimPopup`, `UserManagementPage`
- Specialty type chip: `badge-xs` → `badge-sm rounded-md`
- All tab count badges → `badge-info` (was yellow/red)
- Refresh button on each active admin tab
- `ViewPendingClaimPopup`: added doctor's verified specialties section; replaced alert bars with toasts; reject opens confirm modal
- `ViewPendingUserPopup`: replaced success/error alert bars with toasts; reject opens reason-selection modal with multi-select checkboxes
- `UserManagementPage`: force-delete button moved to AccountDetailsPopup; pending-deletion rows pinned to top with red text; no more browser dialogs
- `AdminReportsPage`: badge colors → `badge-info`; report cards clickable → full detail scrollable popup
- `HomePageAdmin`: `window.confirm` → ConfirmModal component

**UX changes:**
- Home pages: removed "Patient/Doctor/Pharmacy/Department/Institute Dashboard" subtitle
- Patient sidebar: Pharmacy now before Transactions
- Price input: `type="number"` → `type="text"` with numeric regex (no spinner arrows)
- "Start Consultation" → "Start Pre-Consultation"
- ConsultationPage urgency banner: red alert bar → inline red text + icon
- Pharmacy dashboard: Orders tab added (first tab, content placeholder)
- Settings: Edit Profile modal (bio for all eligible roles, languages for patient/doctor)
- Settings: Terms of Service + Privacy Policy links added to Help & Support
- HomePageDoctor: `handlePriceSet`/`handleScheduleSet` now re-fetch from DB after save

---

## Open Flags

### Features — High Priority
| # | Feature | Notes |
|---|---|---|
| 53 | Book appointment — institute path | Doctor booking rebuilt and working. Institute booking: pass `instituteId` + `serviceId` + `start` to `POST /api/booking/book` — needs a separate `CreateInstituteBookingPopup` similar to the doctor one (deprioritized) |

### Features — Medium Priority
| # | Feature | Notes |
|---|---|---|
| 24 | Expert system fuzzy logic | Jaccard + bipartite ranker done. Fuzzy membership scores still pending — needs severity data |
| 23 | AppointmentFilesPanel in DoctorAppointmentsPage list | Panel is now in the detail popups. Consider embedding in the appointments list view too. |

### Low Priority / Post-Development
| # | Flag | Notes |
|---|---|---|
| 7 | Update Render env vars | After development only |
| 11 | Transaction for email update | Needs replica set confirmation on Atlas |
| 18 | Package version sync | After development — audit `package.json` |
| 22 | Dual permit renewal endpoints | Old role-specific endpoints in `permits.controller.js` still write directly to User; remove once new `PermitRenewal` flow confirmed |

---

## Testing Checklist

### Auth
- [ ] Signup → email verify code → login → onboarding redirect
- [ ] Login with wrong password 5× → lockout message + reset code email
- [ ] Locked account shows lockout message on subsequent attempts
- [ ] `resetForgotPassword` → clears lock, allows login
- [ ] 2FA toggle in Settings → next login requires code
- [ ] Admin login via "Admin Login →" link → email + password + adminCode form
- [ ] Admin with 2FA → code sent after adminCode verified → `verify2FA` succeeds
- [ ] Forgot password role picker modal appears on mount
- [ ] Admin forgot-password requires adminCode field
- [ ] Brute-force counter resets on successful login

### Onboarding
- [ ] Patient → `onBoarded` → dashboard
- [ ] Doctor → `pending` → pending banner on dashboard
- [ ] Pharmacy → `pending` → pharmacy dashboard (Manage Catalogue + Transactions tabs)
- [ ] Institute (clinic) → `pending` → institute dashboard with setup link
- [ ] Institute (hospital) → construction permit required
- [ ] Admin → `pending` → `/pending` page
- [ ] Department → `pending` → department dashboard

### Dashboards & Appointments
- [ ] Patient dashboard shows AppointmentCalendar; calendar dots on appointment dates; day click shows detail; list view groups active vs closed
- [ ] Doctor dashboard: Appointments tab + Transactions tab; price/schedule cards
- [ ] Department dashboard: Appointments tab shows calendar; Transactions tab
- [ ] Institute Transactions tab: department dropdown filters correctly
- [ ] Clicking appointment in calendar/list opens correct popup (patient or doctor popup)
- [ ] Doctor popup: accept/reject/complete/dispute actions work
- [ ] Patient popup: pay deposit/balance, cancel, review, dispute work

### Settings
- [ ] 2FA toggle enables/disables
- [ ] Credential update (email/password) — once per month enforced
- [ ] License/permit renewal submission fires `notifyAllAdmins`
- [ ] Delete account → 30-day soft-delete; logging in again cancels deletion

### Admin Dashboard
- [ ] Pending accounts list + approve/reject individually and in bulk
- [ ] Approve with suggestions (transaction) works
- [ ] Suggestions: inline name edit, approve/reject
- [ ] Claims: approve/reject
- [ ] Permit renewals: approve (deletes old S3 file) / reject (deletes new S3 file)
- [ ] Complaints: resolve with outcome + admin note
- [ ] App reports: pending → viewed → resolved
- [ ] User management: filter by role, force-delete (S3 + EmailRegistry cleaned)
- [ ] Specialties & Services: create/edit/delete with cascade

### File Uploads & S3
- [ ] Profile pics → `public/profilepics/`; new upload deletes old S3 file
- [ ] Licenses → `private/licenses/`
- [ ] Permits → `private/permits/`
- [ ] Appointment files → `private/appointment-files/`
- [ ] Signed URL generates correctly for private files
- [ ] Rejected user → all S3 files deleted
- [ ] Renewal approved → old image deleted from S3

### Security
- [ ] HTML tags stripped from bio/review/complaint fields (sanitizer)
- [ ] Bio URLs rendered as clickable links (LinkifiedText)
- [ ] Clicking bio link shows "Leaving MedConnect" confirmation modal
- [ ] `$`-prefixed keys in request body are dropped

---

## Engineering Standards
- DRY and SOLID principles
- Modular, reusable, production-conscious code
- Consistent naming conventions and folder structure
- No new auth patterns, no new global state solutions
- Reproduce → Isolate → Identify root cause → Propose fix. Never patch symptoms.
