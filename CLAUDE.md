# MedConnect — Claude Code Project Guide

## Current Phase: Bug Hunting
The project is in active bug hunting and refinement. The developer tests the app and reports issues or changes directly. Implement all requested changes without pushback unless the requirement **conflicts with an existing design decision, breaks a documented protocol, or would functionally break a feature**. In those cases, flag the conflict briefly before proceeding. Do not offer unsolicited refactors, cleanups, or scope expansions.

## Stabilized Areas — Require Programmer Confirmation Before Editing

The following flows have been deliberately built, tested, and fixed. They must **not** be modified without explicit programmer confirmation, even if a change seems minor or related:

| Area | Files | Reason |
|---|---|---|
| Signup flow | `auth.controller.js` (signup, verifySignup, resendSignupCode), `SignUpPage.jsx`, `useSignUp.js` | Fully tested email + phone signup; admin code removed from signup intentionally |
| Login flow | `auth.controller.js` (login, adminLogin), `LoginPage.jsx` | Email/phone mode switching, brute-force lockout, 2FA, locked-account recovery all working |
| Forgot password | `auth.controller.js` (lookupForgotPasswordAccount, forgotPassword, verifyForgotPasswordCode, resetForgotPassword), `ForgotPasswordPage.jsx`, `useForgotPasswordStore.js` | 3-step flow: lookup → choose channel → send code; phone + email channels |
| Onboarding | All `Onboarding*.jsx` pages, `onboarding.controller.js`, `adminConvert.controller.js` | Email verification for phone-signup users; admin code uniqueness via HMAC; phone verification required for admin |
| Phone & email verification | `auth.controller.js` (requestPhoneVerify, confirmPhoneVerify, requestPhoneChange, requestOnboardingEmailVerify, confirmOnboardingEmailVerify), `OnboardingShared.jsx` (PhoneField, EmailVerificationField) | Admin + user phone verify working; onboarding email verify sends real Brevo OTP |
| Settings credentials | `SettingsPage.jsx` credentials modal + phone modal | Email / phone / password change; verify phone button visible for all roles |
| Auth middleware & JWT | `auth.middleware.js`, cookie setup | Do not touch without explicit instruction |

**Rule:** If a bug report or feature request touches any file in the table above, **stop and confirm the exact change with the programmer before writing any code.** State what you plan to modify and why.

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
- **Expert System** (`/consultation`): 3-step wizard (body system → symptoms → duration/age group). **13 body systems** (added Dental & Oral). Step 2 has an "Other…" checkbox that reveals a free-text symptom input. Jaccard similarity against 71 diseases; top 5 matches shown with `badge-sm` urgency badges. Generates pre-consultation markdown auto-attached as an `AppointmentFile` at booking time.
- **Search** (`/search`): Multi-filter search with 3 modes — Doctors, Institutes, Departments. Bipartite ranker surfaces top 3 symptom-matched doctors (`specialtyScore×0.5 + ratingScore×0.3 + proximityScore×0.2`). Multi-term `+` name search supported. Department mode uses `GET /api/search/departments`. Language/specialty/service chips use `badge-sm`.
- **Appointment Booking**: `CreateBookingPopup` for doctors — **date-picker only** (no time slots); auto-picks first available slot for the chosen date; shows slot count for the day + "Your exact time will be assigned based on queue order." note. After booking succeeds, `ViewPendingAppointmentPatientPopup` opens immediately with the new appointment. Institute booking path is deprioritized (flag #53).
- **Payment**: 50% deposit via Demo Payment screen. For virtual appointments, 50% balance payment after appointment completes.
- **Appointment Calendar** (`/`): Month grid with status dots; day-click shows detail; list view shows **active appointments only** (pending_payment, deposit_paid, accepted, ongoing, awaiting_balance, disputed — completed/fully_paid/cancelled/rejected/resolved are hidden). Opens `ViewPendingAppointmentPatientPopup`. List rows have paperclip button to expand `AppointmentFilesPanel` inline.
- **Home Dashboard status banner**: Replaces static "Book Now" card when there is an active appointment. Priority: `awaiting_balance` (pay balance) → `pending_payment` (pay deposit) → `ongoing` in-person (view + message) → `accepted` (view + message doctor) → `deposit_paid` (waiting) → review available. Falls back to Book Now card when no urgent appointment exists.
- **Patient Popup Actions**: Pay deposit, pay balance, **cancel (red outline button)**, mark complete (in-person only), leave one review (after `completed`/`fully_paid`), **file dispute (red outline button)**. Cancel and dispute buttons are `btn-error btn-outline` for visual clarity.
- **Chat & Video**: Stream-powered at `/chat/:id` and `/call/:id`. Chat channel is per doctor-patient pair (same channel regardless of appointment count). Call button in chat enabled when appointment is `ongoing` OR `accepted` within 30 min. Per-message Tagalog/Cebuano/English translation with cache. Medical term tooltips (70+ terms).
- **Appointment Files**: Upload, list, download (signed URL), delete, PDF export via `AppointmentFilesPanel`.
- **Notifications**: In-app + Brevo email for all appointment lifecycle events.
- **Report Account**: "Report Account" button (low-prominence, ghost/error style) on all `OtherProfilePage` views. Opens modal with 7 checkbox reasons + free-text; posts to `POST /api/app-reports` with `category: "other"`.

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
- **Home Dashboard** (`/`): Full pharmacy order management — Order List (paid, awaiting prep), Shipping & Pickup queue, Completed orders, Order History. Prescription review modal (approve/reject with reason). Rejected prescriptions modal.
- **Order lifecycle**: `paid → ready_for_shipping/ready_for_pickup → out_for_delivery/pickup_in_progress → completed`. Mock auto-complete after 10 minutes.
- **Prescription review**: Orders containing prescription-only medicines are held for pharmacist review before payment. Pharmacist can approve or reject with a reason code and free-text notes.
- **Customer-facing**: `CustomerPharmacyPage.jsx` — browse catalogue, add to cart, checkout, choose delivery/pickup.
- **Catalogue management**: `PharmacyCataloguePage.jsx` — CRUD for pharmacy products (name, price, stock, OTC flag, image).
- **Transactions**: `PharmacyIncomePage.jsx` — income tracking.
- **Notifications**: Receives approval, rejection, and renewal notifications.
- **Permit Renewal**: FDA license and pharmacist PRC license renewal via `PermitRenewal` flow in Settings.

**Standards:**
- Pharmacy order flow is implemented and functional. Do not overwrite teammate-built order management logic.
- Prescription items (OTC=false) must go through `prescriptionReviews` queue before customer can pay.
- Mock fulfillment (auto-complete after 10 min) is intentional for demo purposes.

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
- **Home Dashboard** (`/`): Tabbed — **Appointments** (service setup prompt or verified-services card, dept info, **`QueuePanel`** above calendar, `AppointmentCalendar`) | **Transactions** (`TransactionList`).
- **Appointment Files**: `AppointmentFilesPanel` embedded in the popup.
- **Technologist License Renewal**: Via Settings → Licenses & Permits → Renew.

**Standards:**
- Department shares `ViewPendingAppointmentDoctorPopup` with the Doctor role. Any popup change affects both — always check both when modifying.
- Department does not have a chat/video sidebar link. Only patients and doctors have the chat feature.
- A department with no verified service claims must show a setup prompt on the home page — not an empty calendar.
- Verified service claims (`institutedepartmentservices` with status `verified`) are required for the department to appear in search results. Valid statuses: `pending`, `verified`, `rejected`.

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
- **Analytics** (`/admin/analytics`): Date-range filtered dashboard — totalRevenue, platformRevenue, revenueByDay, revenueByDoctor (top 20), appointmentVolume breakdown, topProviders (top 10), cancellationRate, disputeRate. CSV + Excel export.
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
`email`, `password` (bcrypt), `role`, `status`, `signupMethod` (email/phone), `phoneNumber`, `phoneType`, `phoneVerified` (bool, default false), `emailVerified` (bool, default false), `profilePic {url,key}`, `approvedBy` (ref Admin), `pendingDeletion`, `deletionRequestedAt`, `resetPasswordCode/Expiry`, `lastPasswordChange`, `twoFactorEnabled`, `loginAttempts`, `loginLockedAt`, `birthDate`, `lastSeen` (Date, for online status), `emailNotificationsEnabled` (bool, default true), `createdAt`

### Role-Specific Fields
| Role | Key Fields |
|---|---|
| Patient | `firstName`, `lastName`, `sex`, `bio`, `languages[]`, `address` |
| Doctor | `firstName`, `lastName`, `sex`, `bio`, `languages[]`, `address`, `licenseNumber` (encrypted), `licenseExpiration`, `licenseImage {key}`, `legalIDImage {key}`, `specialty[]`, `subSpecialty[]`, `blockedPatients[]` (ObjectId refs), `maxPatientsPerDay` (Number, default null) |
| Pharmacy | `pharmacyName`, `pharmacistFirstName/LastName`, `sex`, `bio`, `address`, `businessPermit {key}`, `fdaLicense {key}`, `pharmacistLicenseNumber` (encrypted), `pharmacistLicenseExpiration`, `pharmacistLicenseImage {key}`, `pharmacistLegalIDImage {key}` |
| Institute | `instituteName`, `instituteType` (clinic/hospital), `contactFirstName/LastName`, `licensingAgency`, `address`, `businessPermit {key}`, `constructionPermit {key}` (hospital only), `departmentAccounts []` (ObjectId refs to Department users) |
| Department | `technologistFirstName/LastName`, `sex`, `bio`, `address`, `departmentId`, `departmentType`, `rootInstitute` (ref User/Institute), `technologistLicenseNumber` (encrypted), `technologistLicenseExpiration`, `technologistLicenseImage {key}`, `technologistLegalIDImage {key}` |
| Admin | `firstName`, `lastName`, `email`, `password`, `adminCode` (bcrypt-hashed), `adminCodeKey` (HMAC-SHA256 of adminCode, unique sparse — enforces uniqueness without exposing plaintext), `profilePic`, `status`, `phoneNumber`, `phoneType`, `phoneVerified` (bool, default false), `twoFactorEnabled`, `loginAttempts`, `loginLockedAt`, `emailNotificationsEnabled` (bool, default true), `role: "admin"` (immutable) |

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
| `phoneregistry` | Tracks phone number → userId mapping for global uniqueness (same pattern as emailregistry) |
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
| `appointmentqueues` | Queue per provider per day; unique `{providerId, date}`; `slots[]` array with position/type/status per appointment |

---

## Route Structure

### `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Create account (email or phone) + send verify OTP. No adminCode — admin conversion happens in onboarding. |
| POST | `/signup/verify` | Verify OTP → always creates plain `User` (email signup) or `User` with phone (phone signup). |
| POST | `/signup/resend` | Resend signup OTP |
| POST | `/login` | Email OR verified-phone login (checks User collection). Returns `requires2FA` or sets cookie. Tracks `loginAttempts`; 5th failure → lock + reset code emailed. |
| POST | `/admin-login` | Admin login (email + password + adminCode). Returns `requires2FA` or sets cookie. |
| POST | `/verify-2fa` | Verify 6-digit 2FA code, set JWT cookie. Admin path confirmed via `payload.adminVerified` |
| POST | `/2fa/switch-channel` | Switch 2FA OTP delivery between email and phone |
| PATCH | `/toggle-2fa` | Toggle `twoFactorEnabled` on own account (protectRoute) |
| PATCH | `/toggle-email-notifications` | Toggle email notification preference (protectRoute) |
| POST | `/logout` | Clear JWT cookie |
| GET | `/me` | Get current user (returns `twoFactorEnabled`, `phoneVerified`, `emailVerified`) |
| PATCH | `/update-profile` | Update non-credential profile fields (role-allowlisted) |
| POST | `/update-email/request` | Step 1: verify current password + send OTP to current email |
| POST | `/update-email/verify-current` | Step 2: verify OTP on current email; sends OTP to new email |
| POST | `/update-email/verify-new` | Step 3: verify OTP on new email, apply change |
| POST | `/update-password/request` | Step 1: verify current password + send OTP to email |
| POST | `/update-password/verify` | Step 2: verify OTP, apply new password |
| POST | `/forgot-password/lookup` | Pre-step: check account exists (email or phone), return available channels. No code sent yet. |
| POST | `/forgot-password` | Step 1: send reset OTP to chosen channel (email or phone) |
| POST | `/forgot-password/verify` | Step 2: verify reset code (check only, does not consume) |
| POST | `/forgot-password/reset` | Step 3: apply new password + clear loginAttempts |
| POST | `/phone/request-verify` | Onboarding/Settings: generate phone OTP (mock SMS). Works for all roles incl. admin. |
| POST | `/phone/confirm-verify` | Confirm phone OTP → sets `phoneVerified: true`. Works for all roles incl. admin. |
| POST | `/phone/request-change` | Settings credentials: validate current password, generate OTP for new phone number |
| POST | `/onboarding/request-email-verify` | Onboarding (phone-signup users): send OTP to provided email via Brevo |
| POST | `/onboarding/confirm-email-verify` | Confirm email OTP → sets `email + emailVerified: true` on User |
| DELETE | `/delete-me` | Request 30-day soft-delete |

### `/api/onboarding`
`POST /patient`, `/doctor`, `/pharmacy`, `/institute`, `/admin`, `/department`
All set status to `pending` (except department which is set `onBoarded` by institute, and patient which is immediately `onBoarded`).
`POST /admin/convert` — converts a base `User` doc to an `Admin` doc using the provided `adminCode` (unique, HMAC-verified). Must be called before `POST /admin`.

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
`GET /token` (Stream Chat token), `POST /translate` (MyMemory proxy), `GET /appointment-attachments` (fetch appointment files for chat context)

### `/api/doctor-schedule`
`POST /availability`, `GET /get-availability`

### `/api/pricing`
`POST /set-pricing`, `GET /appointment-price`

### `/api/permits`
`POST /renewal/request`, `GET /renewal/my-renewals`

### `/api/search`
`GET /doctors`, `GET /institutes`, `GET /departments` — Haversine proximity + multi-filter + rating aggregation. `/departments` is behind `protectRoute`.

### `/api/users`
`GET /doctors`, `GET /institutes`, `GET /:userId`

### `/api/notifications`
`GET /`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`

### `/api/appointment-files`
`POST /:appointmentId` (upload, 5 MB), `GET /:appointmentId` (list), `GET /:appointmentId/signed-url/:fileId`, `DELETE /:appointmentId/:fileId`

### `/api/app-reports`
`POST /` (any authenticated user), `GET /` (admin), `PATCH /:id/status` (admin)

### `/api/chatbot`
`POST /message` — authenticated; body `{ message, history[] }`; rate-limited 20/hr per user; calls Groq API (`llama-3.1-8b-instant`); returns `{ reply }`

### `/api/gcash`
`GET /info` — public (no auth); returns mock platform GCash number + account name. Defaults to env vars `MOCK_GCASH_NUMBER` / `MOCK_GCASH_NAME` if set, else hardcoded demo values.

### `/api/pharmacyorder`
**Products:** `GET /products` (public listing), `GET /products/mine` (pharmacy's own), `POST /products`, `PATCH /products/:productId`, `DELETE /products/:productId`  
**Orders:** `POST /orders/pay-now`, `POST /orders/prescription-review`, `PATCH /orders/:orderId/prescription/approve`, `PATCH /orders/:orderId/prescription/reject`, `PATCH /orders/:orderId/ready`, `PATCH /orders/:orderId/start-fulfillment`, `PATCH /orders/:orderId/pay-approved`, `GET /orders/dashboard`  
**Income:** `GET /income`, `POST /income/manual`

### `/api/admin/analytics`
`GET /` — admin only; query params `?from=YYYY-MM-DD&to=YYYY-MM-DD` (default last 30 days); returns full analytics payload

### `/api/queue`
`POST /build`, `POST /walkin`, `GET /today`, `GET /position?appointmentId=`, `POST /advance`, `POST /no-show`

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
| `/appointments` | `DoctorAppointmentsPage` | Doctor |
| `/specialty` | `SpecialtyPage` | Doctor |
| `/setup-departments` | `OnboardingDepartment` | Institute |
| `/services` | `ServicesPage` | Department |
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
| `/admin/analytics` | `AdminAnalyticsPage` | Admin |
| `/terms-of-service` | `TermsOfServicePage` | Public |
| `/privacy-policy` | `PrivacyPolicyPage` | Public |
| `/login` | `LoginPage` | Public |
| `/signup` | `SignUpPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/onboarding` | `OnboardingPage` | Authenticated, notOnBoarded |
| `/pending` | `Pending` | Admin, pending status |

### Home Pages (per role)

**Patient (`HomePageUser`)** — pending banner; Join Call banner (virtual, 30 min before / ongoing); queue position banner (in-person, polls 60s); **status-aware action banner** (most-urgent appointment action: pay balance → pay deposit → ongoing in-person → confirmed → waiting → review → fallback to Book Now card); `AppointmentCalendar` (active appointments only) with calendar/list toggle + `ViewPendingAppointmentPatientPopup` on click. Appointments polled every 30s.

**Doctor (`HomePageDoctor`)** — pending banner; Join Call banner (virtual, 30 min before / ongoing); tabbed: **Appointments** (setup warning or success card, pricing card, schedule card, max patients card, **`QueuePanel`** (auto-builds on mount; today's queue with walk-in/advance/no-show — no manual build button), `AppointmentCalendar` (active only) + `ViewPendingAppointmentDoctorPopup`) | **Transactions** (`TransactionList`). Appointments polled every 30s.

**Pharmacy (`HomePagePharmacy`)** — pending banner; tabbed: **Orders** (Order List, Shipping & Pickup queue, Completed orders, Prescription review modals) | **Manage Catalogue** (`PharmacyCataloguePage`) | **Transactions** (`TransactionList`).

**Institute (`HomePageInstitute`)** — pending banner; tabbed: **Overview** (sub-account setup prompt or dept count card, institute info cards) | **Transactions** (`TransactionList` with department dropdown filter).

**Department (`HomePageDepartment`)** — pending banner; tabbed: **Appointments** (services setup prompt or verified-services card, dept info cards, `QueuePanel` (auto-builds), `AppointmentCalendar` (active only) + `ViewPendingAppointmentDoctorPopup`) | **Transactions** (`TransactionList`). Appointments polled every 30s.

**Admin (`HomePageAdmin`)** — tabbed: All Requests | Pending Accounts | Specialties | Subspecialties | Claims | Renewals | Reports; bulk approve/reject; inline suggestion name edit; approve-with-items transaction.

### Key Shared Components
| Component | Purpose |
|---|---|
| `AppointmentCalendar.jsx` | Calendar/list toggle; 7-col month grid; month nav; status dots (active statuses only: pending_payment, deposit_paid, accepted, ongoing, awaiting_balance, disputed — completed/cancelled/rejected/resolved hidden); day-click detail; list view shows active only with inline paperclip→`AppointmentFilesPanel` per row; counterpart name from populated data |
| `TransactionList.jsx` | Summary stats + table; accepts optional `departmentId` for institute filter |
| `PendingAppointment.jsx` | Appointment card with counterpart name lookup, Message button, View Details |
| `AppointmentFilesPanel.jsx` | Upload (WebP auto-convert), list, download (signed URL), delete, PDF export; props: `appointmentId`, `participantRole`, `readOnly` |
| `LinkifiedText.jsx` | Auto-links URLs and emails in plain text; click shows "Leaving MedConnect" confirmation modal before navigating |
| `Sidebar.jsx` | Role-aware navigation links; disabled when `status === "pending"` |
| `Navbar.jsx` | Notifications badge (polls unread-count every 30s); "Add Service" button shown for department role on `/services` page (opens `SuggestServicePopup`) |
| `Layout.jsx` | Wraps pages with Sidebar + Navbar + `VirtualJoinPrompt` + `PiPOverlay` (draggable call-in-progress badge, shown when `useCallStore.activeCallId` is set and user is not on `/call/*`) + `ChatbotWidget` |
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
| `SuggestServicePopup.jsx` | Department modal to suggest a new service; posts to `POST /api/services/suggest` |

### Login Flow (LoginPage.jsx)
Four steps via component state:
1. `"user"` — email + password. Subtle "Admin Login →" text link at bottom.
2. `"admin"` — email + password + admin code all at once.
3. `"twoFactor"` — 6-digit code entry (both user and admin paths).
4. `"locked"` — brute-force lockout recovery; email + 6-digit reset code + new password; calls `POST /api/auth/forgot-password/reset`; triggered automatically when login/adminLogin return HTTP 429.

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
`role_approved`, `role_rejected`, `suggestion_approved`, `suggestion_rejected`, `claim_approved`, `claim_rejected`, `renewal_approved`, `renewal_rejected`, `license_expiring_soon`, `license_expired`, `appointment_booked`, `appointment_accepted`, `appointment_rejected`, `appointment_cancelled`, `appointment_started`, `appointment_completed`, `payment_received`, `dispute_filed`, `dispute_resolved`, `new_account_pending`, `account_deletion_requested`, `renewal_submitted`, `dispute_admin_alert`, `queue_position_update` (sent at 10/5/2 slots ahead), `appointment_emergency_bumped` (your slot was pushed back due to an emergency), `appointment_skipped_to_end` (no-show: moved to end of queue), `appointment_skipped_cancelled` (no-show refused: treated as cancellation, no refund)

### email.js (Brevo SDK)
`sendVerificationCode(email, code)` — OTP email for auth flows  
`sendNotificationEmail(email, title, body)` — event notification email

### Cron Jobs (cronJobs.js)
| Schedule | Job |
|---|---|
| Every 30s | `accepted → ongoing` transition |
| Every 5 min | `ongoing → awaiting_balance/fully_paid` + delete rejected appointments after 24h |
| Daily 6am (Manila) | Build appointment queues for all doctors/departments with accepted appointments today |
| Daily midnight | 30-day soft-delete sweep + S3 cleanup |
| Daily 1am | License expiry checker: `onBoarded → needsRenewal` (60 days before), `needsRenewal → suspended` (expired) |

### Expert System (ConsultationPage)
- 3-step symptom wizard: body system → symptoms (8 per system + "Other" free-text) → duration/age group
- **13 body systems**: cardiovascular, respiratory, gastro, neuro, msk, derm, ent, ophthalmology, mental, endo, repro, **dental** (NEW), general
- Jaccard similarity against `diseaseSymptoms.json` (71 diseases); top 5 matches shown with `badge-sm` urgency badges
- Stores `specialtyConfidence` map in `sessionStorage` → used by SearchPage bipartite ranker
- Pre-consultation markdown auto-generated and attached as `AppointmentFile` on booking

### SearchPage Bipartite Ranker
Reads `specialtyConfidence` from sessionStorage; scores doctors as `specialtyScore×0.5 + ratingScore×0.3 + proximityScore×0.2` (proximity: `1/(1 + distanceKm×0.05)`); top 3 shown in "Recommended for Your Symptoms" section with % badge.

### Chat (Stream)
- `ChatPage.jsx` uses Stream Chat SDK
- Channel ID is `[authUser._id, targetUserId].sort().join("-")` — single persistent channel per doctor-patient pair regardless of appointment count
- Call button (`CallButton.jsx`) enabled when appointment is `ongoing` OR `accepted` within 30 minutes of start
- `MedicalChatMessage.jsx` — custom message renderer
- `POST /api/chat/translate` — proxies to MyMemory free API; auto-detects source; graceful fallback

### Video Call (Stream)
- `CallPage.jsx` — auth check: compound call IDs (`userId1-userId2`) verify `authUser._id` is one of the two parts; shows "Access Denied" if not. Single-ID calls from Join Call banners skip this check.
- `useCallStore.js` — Zustand store: `activeCallId`, `setActiveCallId`, `clearActiveCallId`. Set on join, cleared on `CallingState.LEFT`.
- `PiPOverlay` in `Layout.jsx` — draggable floating badge ("Call in progress / Click to return") when `activeCallId` is set and user is not on `/call/*`. Drag to reposition; click to return; ✕ to dismiss.

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
GROQ_API_KEY        ← required for AI chatbot; free key at console.groq.com
MOCK_GCASH_NUMBER   ← optional; defaults to "0917-000-0000" if unset
MOCK_GCASH_NAME     ← optional; defaults to "MedConnect Platform" if unset
```

---

## Recent Changes & Important Notes

### Session 2026-06-09 Part 2 — UI Polish, Booking Overhaul, Report Account, Call PiP, Queue Auto-build, Real-time Polling

**Group A — UI/CSS fixes:**
- `ConsultationPage.jsx`: urgency + "Top match" badges `badge-xs` → `badge-sm`
- `ProviderCard.jsx`: department type, service, language chips `badge-xs` → `badge-sm`
- `ViewPendingAppointmentPatientPopup.jsx`: cancel buttons → `btn-error btn-outline btn-sm`; "File a Dispute" trigger → `btn-error btn-outline btn-sm`
- `DoctorAppointmentsPage.jsx`: removed "N total" subtitle

**Group B — Consultation content:**
- `ConsultationPage.jsx`: added **Dental & Oral** as 13th body system (8 symptoms: toothache, sensitivity, bleeding gums, gum swelling, jaw pain, mouth sores, bad breath, difficulty chewing)
- `ConsultationPage.jsx`: Step 2 "Other…" checkbox reveals free-text input; typed symptoms are added to `selectedSymptoms` via `addSymptomFromSearch`

**Group C — Status-aware dashboard banner:**
- `HomePageUser.jsx`: static "Book Now" card replaced by `renderActionBanner()`. Priority order: `awaiting_balance` → `pending_payment` → `ongoing` in-person → `accepted` → `deposit_paid` → review available → fallback to Book Now. Each state shows relevant action buttons (navigate to payment, open chat, open appointment popup).

**Group D — Booking overhaul:**
- `CreateBookingPopup.jsx`: time slot picker and calendar/list view toggle removed. Date selection auto-picks the first available slot (keeps a valid `start` for the backend). Selected date shows slot count + "queue order" note. Summary shows date/type/price (no time). Confirm enabled once a date is picked.
- `ProviderCard.jsx`: `onBookingCreated` callback now opens `ViewPendingAppointmentPatientPopup` with the new appointment immediately after booking.

**Group E — Calendar active-only:**
- `AppointmentCalendar.jsx`: `ACTIVE_DOT_STATUSES` — removed `completed` and `fully_paid`. `allApptsByDate` merged into `apptsByDate` (same filter). List view shows only active appointments; "Closed" section removed. Day popup shows active only.

**Group F — Patient appointment card:**
- `AppointmentCalendar.jsx`: `ListRow` now has a paperclip button (patient/doctor/department roles) that accordion-expands `AppointmentFilesPanel` inline below the row. `expandedFiles` Set state + `toggleFiles` function in the calendar component.

**Group G — Report Account:**
- `OtherProfilePage.jsx`: "Report Account" button (ghost/xs/error, 50% opacity until hovered) shown on all non-own profiles. Modal: 7 checkbox reasons + free-text textarea (1800 char limit). Posts `POST /api/app-reports` with `category: "other"`, `subject: "Report Account: [name]"` (≤120 chars), bullet-listed reasons + details in `description`.

**Group H — Chat + Call:**
- `CallPage.jsx`: auth check for compound IDs (`userId1-userId2`) — shows "Access Denied" if `authUser._id` not in parts. Single-ID calls (Join Call banners) skip check.
- Single chat log per pair already implemented (channel ID = sorted pair joined with `-`). No changes needed.
- `ChatPage.jsx`: `hasOngoingCall` now also returns true when appointment is `accepted` within 30 min of start (matches Join Call banner logic). Requires `dayjs` (added import). `CallButton` tooltip updated.
- `useCallStore.js` (NEW): Zustand store — `activeCallId`, `setActiveCallId`, `clearActiveCallId`.
- `CallPage.jsx`: calls `setActiveCallId(callId)` after join succeeds; `CallContent` calls `clearActiveCallId()` on `CallingState.LEFT`.
- `Layout.jsx`: `PiPOverlay` component — draggable via mousedown/mousemove; click navigates to `/call/${activeCallId}`; ✕ dismisses. Hidden when on `/call/*` or no active call.

**Group I — Real-time & queue:**
- `QueuePanel.jsx`: auto-builds queue on mount via `useRef` guard (only once per mount, only when `!queue.isActive`). "Build Queue" manual button removed. No-queue state shows spinner + "Building…" text.
- `HomePageUser.jsx`, `HomePageDoctor.jsx`, `HomePageDepartment.jsx`: `fetchAppointments` now called every 30s via `setInterval` with cleanup on unmount.

---

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

### Hannah's Branch (2026-06-07) — Department Search, ServicesPage, Admin fixes

**Backend:**
- `search.controller.js`: Added `searchDepartments` — Haversine proximity + multi-filter ranking for departments
- `search.route.js`: `GET /api/search/departments` (behind `protectRoute`)
- `InstituteDepartmentService.js`: Added `"rejected"` to `status` enum — `rejectClaim` was throwing Mongoose ValidationError silently
- `admin.controller.js`: Fixed `getPendingClaims` to `populate("departmentId", ...)` instead of `populate("instituteId", ...)` so service claims appear in admin panel; fixed `rejectRole` cleanup (`instituteId` → `departmentId`)
- `service.controller.js`: Added `notifyAllAdmins` in `claimService` — admins now receive in-app + email when a department submits a service claim

**Frontend:**
- `ServicesPage.jsx` (NEW): Department services management at `/services` — lists claimed services grouped by status (Approved / Pending / Rejected) with duration badges; calls `GET /api/services/my-services`
- `SuggestServicePopup.jsx` (NEW): Modal for department users to suggest a new service; posts to `POST /api/services/suggest`
- `SearchPage.jsx`: Added department search mode as 3rd tab; updated `buildParams` and result rendering for departments using `GET /api/search/departments`
- `ProviderCard.jsx`: Extended to support `department` provider type — shows services, price range, distance, Google Maps link
- `HomePageAdmin.jsx`: Fixed `ClaimRow` — now shows department technologist name (from `departmentId`) for service claims instead of "Unknown"
- `ViewPendingClaimPopup.jsx`: Department-aware — service claims show department name/email and duration; license number + approved specialties sections are hidden for service claims
- `App.jsx`: Added `/services` route for `department` role pointing to `ServicesPage`
- `Navbar.jsx`: Added "Add Service" button (department-only, visible on `/services` page) that opens `SuggestServicePopup`
- `SignUpPage.jsx`: Added Terms & Privacy Policy scroll gate before allowing signup submission

### Session 2026-06-07 Part 5 — Bayesian rating, files in list, phone cross-login + dual 2FA

**#81 — Bayesian rating in bipartite ranker:** `SearchPage.jsx` — replaced `doc.averageRating / 5` with `(C * m + averageRating * reviewCount) / (C + reviewCount) / 5` where `C = 5` and `m` is the weighted platform mean computed from all doctors in the current result set. Falls back to 3 if no reviews exist.

**#23 — AppointmentFilesPanel in DoctorAppointmentsPage list:** Each row now has a paperclip button. Clicking it expands `AppointmentFilesPanel` inline below the row (accordion style). State tracked per appointment ID via a `Set`. Clicking the card body still opens the detail popup; the paperclip click stops propagation.

**#94 — normalizePhone consolidation:** Already done in Part 4 — `onboarding.controller.js` already imports from `validation.js`. CLAUDE.md was stale.

**#89 — Settings phone verification:** `User.phoneVerified: Boolean (default false)` added to base schema. Backend: `POST /api/auth/phone/request-verify` (protectRoute) — generates 6-digit mock OTP stored in `verificationcodes`, returns `mockCode` in response. `POST /api/auth/phone/confirm-verify` — verifies OTP, sets `phoneVerified = true`, upserts `PhoneRegistry`. Frontend: "Phone Number" card in Settings (non-admin only). Modal: enter mobile number → Send Code → shows mock code with ⚠ demo warning → enter code → verified. `phoneVerified` exposed in `getMe` response.

**#91 — Dual login (email OR phone):** `login` controller now tries `User.findOne({ email })` first, then falls back to `User.findOne({ phoneNumber: normalize(input), phoneVerified: true })`. Login form label changed to "Email or Phone", `type="text"` instead of `type="email"`. `normalizePhone` imported in `auth.controller.js`.

**#92 — 2FA "Try another way":** `POST /api/auth/2fa/switch-channel` — takes `{ email, preferPhone }`. Invalidates existing OTP, generates new one, sends to email (real) or phone (mock, returns `mockCode` in response). Frontend: "Try another way (SMS)" / "Try email instead" link in the 2FA step. Mock code shown with ⚠ warning banner when phone channel active. `switch2FAChannel` API function added to `api.js`.

**#93 — Forgot password via phone:** `forgotPassword` controller now tries email lookup first, then phone lookup (`User.findOne({ phoneNumber: normalize(input), phoneVerified: true })`). Frontend: no UI change needed — users can simply enter their phone number in the existing forgot-password email field (the backend now handles both).

**Tests:** 42/42 pass unchanged.

### Session 2026-06-07 Part 4 — Utility refactors + test cleanup

Teammates extracted shared logic into proper utility modules:
- `backend/src/utils/rateLimiter.js` — exports `makeRateLimiter()`, `RATE_LIMIT`, `WINDOW_MS`. Used by `chatbot.controller.js`. `makeRateLimiter()` returns a function and exposes `._rateLimits` map for test inspection. Includes automatic stale-entry cleanup via `setInterval`.
- `backend/src/utils/validation.js` — exports `normalizePhone(phone)` and `isValidPersonName(value)`. NOTE: `onboarding.controller.js` still has an inline copy of `normalizePhone` — these should be consolidated to import from `validation.js` to avoid drift.

Tests updated to import from proper modules:
- `test/utils.test.js` imports from `../src/utils/validation.js`
- `test/chatbotRateLimit.test.js` imports from `../src/utils/rateLimiter.js`
- `test/response.test.js` imports directly from `../src/utils/response.js`

`GROQ_API_KEY` confirmed added to `backend/.env` — chatbot is functional.

### Session 2026-06-07 Part 3 — Analytics, Chatbot, PSGC, Phone Verification

**Admin analytics (#75):** New `/api/admin/analytics` route (`analytics.route.js` + `analytics.controller.js`). Returns totalRevenue, platformRevenue, revenueByDay, revenueByDoctor (top 20), appointmentVolume breakdown, topProviders (top 10), cancellationRate, disputeRate. Frontend: `AdminAnalyticsPage.jsx` at `/admin/analytics` — date range filter, stat cards, tables, CSV + Excel export (.xlsx as CSV). "Analytics →" link added to HomePageAdmin tab row.

**AI chatbot (#80):** `chatbot.controller.js` calls Groq API via fetch (no npm package — uses `fetch` directly with `llama-3.1-8b-instant` model, 12s timeout, max 300 tokens, temperature 0.4). Rate limit: 20 messages/hour per user (in-memory Map via `rateLimiter.js`, server-side). System prompt constrains to MedConnect feature help only — refuses medical diagnoses, redirects symptom questions to `/consultation`, redirects doctor search to `/search`. `GROQ_API_KEY` env var required; missing → 503. Frontend: `ChatbotWidget.jsx` — floating bottom-right button (fixed, z-50), panel 80–96 chars wide, message history (last 8 sent to API), 6 role-aware quick-prompt chips on open, `/path` links rendered as `<Link>`, rate-limit 429 shows modal message. Added to `Layout.jsx` so it appears on all authenticated pages for all roles.

**PSGC dropdowns (#86):** `PSGCAddressFields.jsx` fetches from `psgc.cloud` public API (no bundled data). Cascading Region → Province → City/Municipality. Integrated into `AddressFields` in `OnboardingShared.jsx` — replaces city/province free-text inputs. Falls back gracefully (shows message) if API unreachable.

**Phone number verification:**
- `PhoneRegistry` model added (same pattern as `EmailRegistry`).
- `normalizePhone()` and `checkAndRegisterPhone()` helpers in `onboarding.controller.js`.
- Phone uniqueness enforced on all 6 onboarding roles.
- `PhoneField` in `OnboardingShared.jsx` now includes mock SMS OTP verification (demo: shows code inline with ⚠ warning). All onboarding forms require phone verified before step completion.
- `phoneVerified` state in each onboarding form; `onVerified` prop wired to PhoneField.

**Queue system (#71/#72/#87):** `AppointmentQueue` model + `queue.controller.js` + `queue.route.js`. Cron at 6AM Manila builds queues. Provider queue management page at `/queue`. Patient sees position banner on HomePageUser (polls 60s).

### Session 2026-06-07 Part 2 — Cross-Login & Dual 2FA

**New feature group: verified phone/email cross-login + dual 2FA channel.** Full spec added as open flags #89–#93.

Key decisions:
- Users who verify their phone in Settings can login with phone OR email (not both simultaneously as separate accounts).
- 2FA codes can be sent to either verified channel; "Try another way" button switches between email and phone.
- Forgot password and change password flows also support either channel.
- Phone verification in Settings uses the same mock SMS OTP design as onboarding.
- PSGC address dropdowns (#86): use `psgc.cloud` public API (free, no auth) instead of bundling — API fetches on component mount, cached per session.

### Session 2026-06-07 — Feature Spec Clarification
All flags #68–#88 were clarified and updated in the Open Flags section. Key decisions recorded:
- #68: SMS OTP is mock (Brevo SMS = paid); `phoneregistry` collection for uniqueness.
- #69: Block deletes all reviews by that patient on that doctor; no admin override.
- #71/#72: Queue uses a new `appointmentqueues` collection — no new appointment statuses. Emergency mid-session reverts current appointment to `accepted`. No-show: skip to end (accepted) or cancelled/no-refund (refused).
- #73: Month-view calendar, 3 months lookahead, switchable.
- #74: Stream presence API for online status.
- #75: All metrics, CSV + Excel (`xlsx` package).
- #76: T&C as inline text + hyperlink only ("By clicking, you agree to our T&C"), no checkbox.
- #80: Groq free tier (Llama 3), 20 msg/hr rate limit, site-content only; add `GROQ_API_KEY`.
- #84: Flagged as partially implemented — not RA 10173 compliant, do not attempt full pass without instruction.
- #85: Name sanitization for personal name fields only (not business names).
- #86: PSGC JSON bundled, Region → Province → City/Municipality only (no barangay dropdown).
- #87: Live queue position on patient dashboard for same-day appointments; polls every 60s.
- Queue position alerts: 10, 5, and 2 slots ahead.
- Walk-in button #79: shows when appointment is `ongoing` OR within 30 min of `accepted` start.
- #78: `maxPatientsPerDay` per day total; no time-block logic (queue handles order).

### Session 2026-06-09 — Auth Stabilisation, Admin Overhaul, Address & Specialty UX

**Signup:**
- Admin code removed from signup. `verifySignup` always creates a plain `User`; admin conversion (`/onboarding/admin/convert`) happens in onboarding. `SignUpPage.jsx`: `isAdminMode` + adminCode field + "Admin Sign Up →" toggle all removed.
- `Admin.adminCode` made optional (set during onboarding, not signup). `adminCodeKey` (HMAC-SHA256 of plaintext, unique sparse index) added to enforce uniqueness without bcrypt. `adminConvert.controller.js` returns readable 400 on duplicate.
- `Admin.phoneVerified` field added.

**Forgot password:**
- New 3-step flow: `POST /forgot-password/lookup` → user chooses channel → `POST /forgot-password` sends OTP. `ForgotPasswordPage.jsx` redesigned with "identify" step, not-found error with return button, "choose channel" step.
- `verifyForgotPasswordCode` and `resetForgotPassword` now fall back to phone lookup so phone-identified users can complete the flow.

**Phone verification:**
- `PhoneField.verifyCode` now calls `confirmPhoneVerify` backend (was purely frontend string compare — `phoneVerified` was never set in DB).
- `requestPhoneVerify` / `confirmPhoneVerify` / `requestPhoneChange` now work for admin accounts (use Admin model when `role === "admin"`).

**Onboarding:**
- Phone-signup users must now verify their email during onboarding via `EmailVerificationField` (new component in `OnboardingShared.jsx`). Sends real Brevo OTP. `step2Complete` gates on `emailVerified`. Routes: `POST /auth/onboarding/request-email-verify` + `POST /auth/onboarding/confirm-email-verify`.
- All 4 role onboarding controllers: `emailVerified: isPhoneSignup ? !!req.body.email` bug fixed → `emailVerified: existing.emailVerified ?? false` (reads what was actually verified before form submit).
- `DoctorSpecialty` claim records now created at onboarding submit (was silently missing — specialties went to `Doctor.specialty[]` array only, never to `doctorspecialties` collection).
- Onboarding draft cache (localStorage) added then removed in same session — images can't be serialized; removed entirely.
- `OnboardingAdmin.jsx`: `phoneVerified` state added; `onVerified` wired to PhoneField; `formComplete` requires phone verified.

**Specialties:**
- `getSpecialties` and `getSubspecialtiesBySpecialty` now return `pending` + `verified` entries. `SpecialtyField` + `SubspecialtyField` show `(pending)` label in dropdown; selected chips use clock icon for both `isNew` and `status === "pending"` entries.

**Address fields (`PSGCAddressFields.jsx`):**
- Region removed. All provinces loaded on mount. All ~1,600 cities loaded on mount (cached). Province selection reorders city dropdown (province-first optgroup) without clearing city. Barangay is a 1-col combobox; suggestions loaded after city selected.
- Field order: Building | Street / Barangay | City / Province | Postal Code.

**Settings:**
- Standalone Phone Number card removed; Verify Phone / Add & Verify Phone button placed next to Update Credentials button (hidden once verified, shown for all roles incl. admin).
- Credentials modal gains "Change Phone Number" mode (current password + new phone + OTP via `POST /auth/phone/request-change`).
- `requestPhoneChange` backend added.

**Login:**
- Phone mode `onBlur` bug fixed — was checking formatted display string length (12 chars with spaces) instead of raw digit count (10).

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

## Queue System Architecture

The queue system (#71/#72/#87) is a new collection and the most complex feature. Understand this fully before touching any queue code.

### `appointmentqueues` Collection
```
{
  doctorId: ObjectId (ref User/Doctor or Department),
  date: Date (day-start, midnight Asia/Manila),
  slots: [
    {
      appointmentId: ObjectId,
      position: Number (1-based),
      type: "booked" | "walkin" | "emergency",
      status: "waiting" | "active" | "done" | "skipped" | "cancelled",
      patientId: ObjectId,
      originalStart: Date,
      currentStart: Date (shifts on emergency bumps),
    }
  ],
  isActive: Boolean,
  createdAt: Date
}
```

### Queue Rules
- Queue is built each morning at day-start (cron) from all `accepted` appointments for that day. Initial order = ascending `start` time.
- Walk-ins (type `walkin`) are appended to the end. Emergencies (type `emergency`) are inserted at position 1 and everyone else shifts down (+1 position). Both are doctor-created only — patients cannot create these.
- The active slot (position 1 with status `active`) corresponds to the `ongoing` appointment in the main appointments collection.
- **Advance to next**: Doctor can only call next when current appointment is `completed`, `awaiting_balance`, or `fully_paid`. Cannot skip manually — skip only triggers via the 5-minute no-show window.
- **No-show / skip**: Doctor manually triggers `POST /api/queue/no-show` (there is no automatic 5-min timer — doctor decides when a patient is a no-show). Doctor chooses outcome:
  - `outcome: "skip"` → patient moved to end of queue (position updates, `appointment.start` adjusted, notifications sent).
  - `outcome: "cancel"` → treated as `cancelled`, no refund. Appointment status → `cancelled`.
- **Emergency bump**: When doctor adds an emergency walk-in mid-session, the currently `ongoing` appointment reverts to `accepted` (current patient notified + all others notified they've been pushed back one slot). Emergency slot becomes `active` / `ongoing`.
- **Position notifications**: Sent at 10, 5, and 2 slots ahead (in-app + email if `emailNotificationsEnabled`). Notification type: `queue_position_update`.
- **Patient dashboard**: If the patient has an appointment today, their dashboard shows their live queue position ("You are #N in queue — N people ahead of you"). Polls every 60s.
- No new appointment statuses are added. Queue state lives entirely in the `appointmentqueues` collection.

### Queue T&C Disclosures (add to TermsOfServicePage)
- Appointment times may shift by ±15 minutes due to queue dynamics.
- Emergency cases may be prioritized and bump existing slots.
- No-show (no activity after 5 minutes) may result in slot loss; accepting the skip moves you to end of queue; refusing is treated as cancellation with no refund.

---

## Open Flags

### Features — High Priority (Open)
| # | Feature | Notes |
|---|---|---|
| 53 | Book appointment — institute path | Doctor booking done. Institute booking: needs `CreateInstituteBookingPopup` (pass `instituteId` + `serviceId` + `start` to `POST /api/booking/book`). Deprioritized. |

### Features — Medium Priority (Open)
| # | Feature | Notes |
|---|---|---|
| 24 | Expert system fuzzy logic | Jaccard + bipartite ranker done. Fuzzy membership scores need severity data — blocked. |

### Completed Flags (reference)
| # | Feature | When Done |
|---|---|---|
| Hannah | Department search (`GET /api/search/departments`) + `ServicesPage` + `SuggestServicePopup` | 2026-06-07 (Hannah) |
| Hannah | Admin `getPendingClaims` departmentId fix + `rejectRole` cleanup fix | 2026-06-07 (Hannah) |
| Hannah | `InstituteDepartmentService` — added `"rejected"` status enum | 2026-06-07 (Hannah) |
| Hannah | `service.controller.js` — `notifyAllAdmins` on service claim submission | 2026-06-07 (Hannah) |
| Hannah | `SignUpPage` — Terms & Privacy Policy scroll gate before submit | 2026-06-07 (Hannah) |
| Hannah | `ProviderCard` + `ViewPendingClaimPopup` — department-aware rendering | 2026-06-07 (Hannah) |
| 68 | Mobile number uniqueness + mock SMS OTP | 2026-06-07 |
| 69 | Doctor block patient | 2026-06-07 |
| 70 | Doctor delete review | 2026-06-07 |
| 71/72/87 | Queue system (incl. walk-ins, emergencies, patient position) | 2026-06-07 |
| 73 | Booking calendar view (3-month, switchable) | 2026-06-07 |
| 74 | Online status (lastSeen heartbeat) | 2026-06-07 |
| 75 | Admin analytics + CSV/Excel export | 2026-06-07 |
| 76 | T&C inline text on all payment buttons | 2026-06-07 |
| 77 | Deposit button copy | 2026-06-07 |
| 78 | Max patients per day (model + enforcement + UI) | 2026-06-07 |
| 79 | Join Call banner | 2026-06-07 |
| 80 | AI chatbot (Groq, floating bottom-right) | 2026-06-07 |
| 82 | Specialties visible on doctor card | 2026-06-07 |
| 83 | Symptom typeahead in ConsultationPage | 2026-06-07 |
| 84 | T&C queue disclosures + RA 10173 notice | 2026-06-07 |
| 85 | Name field sanitization | 2026-06-07 |
| 86 | PSGC address dropdowns (psgc.cloud API) | 2026-06-07 |
| 88 | Fix SpecialtyPage Column anti-pattern | 2026-06-07 |
| 81 | Bayesian rating in bipartite ranker | 2026-06-07 (Part 5) |
| 23 | AppointmentFilesPanel expandable in DoctorAppointmentsPage rows | 2026-06-07 (Part 5) |
| 89 | Settings: Verify phone number (mock SMS OTP, phoneVerified field) | 2026-06-07 (Part 5) |
| 91 | Dual login: email OR verified phone | 2026-06-07 (Part 5) |
| 92 | 2FA: "Try another way" — switch between email and phone | 2026-06-07 (Part 5) |
| 93 | Forgot password: phone lookup fallback | 2026-06-07 (Part 5) |
| 94 | Consolidate normalizePhone utility | 2026-06-07 (Part 5) — already done; CLAUDE.md was stale |

### Low Priority / Post-Development
| # | Flag | Notes |
|---|---|---|
| 7 | Update Render env vars | After development only — add GROQ_API_KEY and all others |
| 11 | Transaction for email update | Needs replica set confirmation on Atlas |
| 18 | Package version sync | After development — audit `package.json` |
| 22 | Dual permit renewal endpoints | Old role-specific endpoints in `permits.controller.js` still write directly to User; remove once new `PermitRenewal` flow confirmed |
| 84 | Data privacy compliance | **Partially done.** T&C + Privacy Policy pages updated. Still missing: consent banner on signup, formal data retention policy, DPA officer contact. Do not attempt full compliance pass without explicit instruction. |
| — | Drop legacy registry collections | Once all teammates have merged the AccountRegistry refactor, drop `emailregistries` and `phoneregistries` from MongoDB Atlas. Migration script: `backend/src/scripts/migrate-registries.js` (already run). |

### Remaining Flags — Cross-Login & Dual 2FA
| # | Feature | Notes |
|---|---|---|
| 90 | Settings: Verify email (for phone-based accounts) | Not currently applicable — all accounts are email-based at signup. Reserved for future phone-first signup. |

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
