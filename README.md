# MedConnect

A Philippine telehealth platform connecting patients with licensed healthcare providers — doctors, pharmacies, clinics, and hospitals — through a unified booking, communication, payment, and file-sharing system.

> Student project — MedConnect is a student project output for the course — Software Engineering 2.

---

## What It Does

MedConnect lets patients find and book appointments with doctors or diagnostic departments, pay a deposit online, then complete the visit (in-person or virtual). Pharmacies can list medicines and fulfill orders from patients. Institutes (clinics/hospitals) manage diagnostic department sub-accounts. All provider credentials are reviewed and approved by a platform admin before they can serve patients. Every monetary amount is in Philippine Pesos (PHP).

---

## Platform Roles

### Patient
- Runs an optional 3-step **Expert System** (`/consultation`) to identify symptoms across 13 body systems → Jaccard similarity match against 71 diseases → specialty confidence map used to rank doctors.
- **Searches** for doctors, institutes, or departments. A bipartite ranker surfaces the top 3 symptom-matched doctors.
- **Books** appointments via a date picker; pays a 50% deposit through a Demo Payment screen.
- For virtual appointments: pays the 50% balance after the appointment ends.
- Views appointment files, joins video calls via Stream, messages the doctor in chat.
- Can browse the pharmacy catalogue, add to cart, and checkout for delivery or pickup.

### Doctor
- Onboarded with PRC license; status is `pending` until an admin approves.
- Claims specialties/subspecialties from 52 PRC-recognized entries; claims are verified by admin.
- Sets a weekly schedule and a single consultation price.
- Accepts or rejects incoming bookings; manages an in-person queue with walk-in and emergency slots.
- Conducts virtual consultations via Stream video; messages patients via Stream chat.

### Pharmacy
- Onboarded with FDA license and pharmacist PRC license.
- Manages a product catalogue (OTC and prescription-only items).
- Reviews prescription images before allowing payment on prescription orders.
- Fulfills orders through a shipping/pickup queue; walk-in sales are recorded as manual transactions.

### Institute (Clinic / Hospital)
- Onboarded with a business permit (hospitals also require a construction permit).
- Creates Department sub-accounts (clinics: 1 type; hospitals: multiple).
- Views aggregated transaction history across all its departments.

### Department
- Created by a parent institute; immediately active (no admin approval required).
- Claims services from 149 seeded entries across 36 department types; claims need admin approval.
- Accepts bookings, manages an in-person queue, and shares the appointment popup UI with doctors.

### Admin
- Logs in separately via email + password + admin code.
- Reviews and approves/rejects pending accounts, specialty and service claims, and permit renewals.
- Resolves appointment disputes; manages the specialty and department-type taxonomy.
- Views platform analytics (revenue, appointment volume, top providers, pharmacy fees).

---

## Patient Flow (End to End)

1. **Sign up** → verify email OTP → complete onboarding → access dashboard immediately.
2. Optionally run the **Expert System** to identify symptoms and get specialty recommendations.
3. **Search** for a doctor or department; symptom-matched results are ranked at the top.
4. **Book** an appointment — choose a date, confirm type (in-person/virtual), pay 50% deposit.
5. Doctor or department **accepts** the booking.
6. A cron job transitions the appointment to `ongoing` at the scheduled start time.
7. After the visit:
   - In-person: patient marks `completed`; deposit was the full payment.
   - Virtual: patient pays the remaining 50% balance → `fully_paid`.
8. Patient leaves one review; either party may file a dispute for admin resolution.

---

## Appointment Status Machine

```
pending_payment → deposit_paid → accepted → ongoing
  → completed                  (in-person)
  → awaiting_balance → fully_paid  (virtual)

rejected  (auto-deleted 24 h by cron)
cancelled
disputed → resolved
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas |
| File storage | AWS S3 (public bucket for profile images; private bucket for licenses, permits, appointment files) |
| Chat & Video | Stream Chat + Stream Video SDK |
| Email | Brevo (Sendinblue) SDK |
| AI chatbot | Groq API (`llama-3.1-8b-instant`) |
| Frontend | React + Vite, TailwindCSS, DaisyUI |
| Server state | TanStack Query |
| Client state | Zustand |
| Maps | Leaflet + Nominatim |
| Date/time | dayjs (UTC + Asia/Manila) |

---

## Local Setup

### Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster
- AWS S3 bucket (public) + bucket (private), or a single bucket with two prefixes
- Stream account (Chat + Video)
- Brevo account
- Groq API key (free tier at console.groq.com)

### 1. Clone and install

```bash
git clone https://github.com/Hehehehe290805/MedConnect.git
cd MedConnect

# Install everything (backend deps + frontend deps + frontend build)
npm run build
```

Or install separately for development:

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Create `backend/.env`:

```env
# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/medconnect

# Auth
JWT_SECRET_KEY=your_jwt_secret

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=your-bucket-name
AWS_REGION=your-region

# Stream Chat + Video
STREAM_API_KEY=
STREAM_API_SECRET=

# Encryption (for license numbers at rest)
ENCRYPTION_KEY=32-char-hex-key

# Admin
ADMIN_CODE=your_initial_admin_code

# Groq (AI chatbot)
GROQ_API_KEY=

# Optional — demo GCash info
MOCK_GCASH_NUMBER=0917-000-0000
MOCK_GCASH_NAME=MedConnect Platform

# Server
PORT=3000
```

### 3. First-time setup after starting the server

There are no seed scripts. A fresh database has empty specialty and service lists. Follow this order:

**a) Create the first admin account**


1. Open the app and sign up normally (any email).
2. On the onboarding page, choose the **Admin** role.
3. Fill out and submit — your account becomes an admin with the `pending` status.
4. Open MongoDBAtlas and manually alter the account status to `onBoarded` status.

Create additional admins by approving them with the first admin account created.

**b) Populate the taxonomy**

Log in as admin and go to `/admin/specialties`. From there you can create:
- Specialties and subspecialties (doctors claim from these)
- Department types and services (departments claim from these)

There is no bulk-import tool — entries are added one by one through the admin UI. The 52 specialties and 149 services described in the docs must be entered here before any provider can claim them.

### 4. Run in development

```bash
# Terminal 1 — backend (http://localhost:3000)
cd backend
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

### 5. Run in production

```bash
# From repo root — builds frontend then starts backend
npm run build
npm start
```

The Express server serves the built frontend as static files in production.

---

## Architecture

MedConnect is a standard MERN stack application with a clear separation between the API server and the React SPA.

```
Browser (React SPA)
      │  HTTP/JSON via axios (cookie auth)
      ▼
Express API Server  ──►  MongoDB Atlas
      │
      ├── AWS S3          (file storage)
      ├── Stream          (chat + video)
      ├── Brevo           (email)
      └── Groq            (AI chatbot)
```

**Request pipeline (backend)**

Every authenticated request flows through: `protectRoute` middleware (validates JWT cookie, attaches `req.user`) → route → `express-validator` validator → controller → `sendSuccess` / `sendError` response helper. Controllers are always wrapped in `asyncHandler` so unhandled promise rejections are caught and forwarded to the error middleware rather than crashing the server.

**User model — discriminator pattern**

All six user roles share a single MongoDB collection (`users`) via Mongoose discriminators. `User` is the base schema; `Patient`, `Doctor`, `Pharmacy`, `Institute`, and `Department` extend it with role-specific fields. This means one `protectRoute` implementation covers every role. `Admin` is a separate model in its own `admins` collection because its login path and credentials (email + password + admin code) are fundamentally different from regular users.

**Frontend state**

Server state (anything fetched from the API) is managed by TanStack Query — it handles caching, background refetching, and the 30-second polling intervals used by appointment dashboards. Client-only state (current call ID, forgot-password wizard step, signup flow, colour theme) lives in lightweight Zustand stores. There is no Redux.

**Background jobs**

`cronJobs.js` runs five scheduled tasks entirely server-side:

| Schedule | Job |
|---|---|
| Every 30 s | Transition `accepted → ongoing` at appointment start time |
| Every 5 min | Transition `ongoing → awaiting_balance` or `fully_paid`; delete rejected appointments after 24 h |
| Daily 6 AM (Manila) | Build appointment queues for all providers with accepted bookings that day |
| Daily midnight | Hard-delete accounts soft-deleted more than 30 days ago; clean up their S3 files |
| Daily 1 AM | Check licence expiry dates; move providers to `needsRenewal` (60 days before) or `suspended` (expired) |

---

## Database

MongoDB Atlas. All timestamps are stored in UTC; the application layer converts to `Asia/Manila` (UTC+8) using dayjs.

**Main collections**

| Collection | What it stores |
|---|---|
| `users` | All patient, doctor, pharmacy, institute, and department accounts (discriminator pattern) |
| `admins` | Admin accounts (separate model, separate collection) |
| `appointments` | Full appointment record including status, amounts, deposit/balance refs, rating, and review |
| `transactions` | Individual payment records linked to an appointment (deposit or balance) |
| `appointmentfiles` | Metadata for files uploaded to an appointment (S3 key, MIME type, uploader role) |
| `appointmentqueues` | Daily in-person queue per provider — slot positions, types, and statuses |
| `notifications` | In-app notification records; TTL index on read notifications |
| `verificationcodes` | OTP codes for signup, email/password change, 2FA, permit renewal; TTL index on `expiresAt` |
| `specialties` | 52 PRC-recognised medical specialties |
| `subspecialties` | 197 subspecialties; compound unique on `{name, rootSpecialty}` |
| `doctorspecialties` | Doctor ↔ specialty/subspecialty claim records with approval status |
| `departmenttypes` | 36 diagnostic/lab/therapy department types |
| `services` | 149 bookable services; compound unique on `{name, rootDepartmentType}` |
| `institutedepartmentservices` | Department ↔ service claim records with duration and approval status |
| `schedules` | Provider weekly availability (days of week, start/end hour) |
| `pricing` | Consultation price per provider |
| `reports` | Appointment dispute records and admin resolutions |
| `appreports` | User-submitted bug/UX/feature reports |
| `permitrenewals` | Staged licence/permit renewal requests pending admin review |
| `accountregistries` | Unified registry for both email addresses and phone numbers — compound unique index on `{type, value}` enforces global uniqueness across all roles and admins |
| `pharmacyproducts` | Pharmacy catalogue items (name, price, stock, OTC flag, image) |
| `pharmacyorders` | Patient pharmacy orders including delivery method and prescription review status |
| `pharmacymanualtransactions` | Walk-in/manual pharmacy sales |
| `departmentmanualtransactions` | Walk-in/manual department sales |

---

## External APIs & Services

| Service | Used for |
|---|---|
| **MongoDB Atlas** | Primary database (cloud-hosted MongoDB) |
| **AWS S3** | Two storage paths: `public/profilepics/` (direct URL) and `private/` (licenses, permits, prescriptions, appointment files — served via 15-min signed URLs) |
| **Stream Chat** | Real-time messaging between patients and doctors. One persistent channel per doctor-patient pair regardless of how many appointments they share. |
| **Stream Video** | Virtual consultation video calls at `/call/:id`. The frontend fetches the Stream API key and token from the backend at call time — never hard-coded. |
| **Brevo (Sendinblue)** | Transactional email for OTPs (signup, 2FA, password/email change) and appointment lifecycle notifications. Per-user opt-out supported for notification emails; security codes always send regardless. |
| **Groq API** | Powers the in-app AI assistant (`llama-3.1-8b-instant`). Scoped strictly to MedConnect feature help — refuses medical diagnosis questions. Free tier; rate-limited to 20 messages/hour per user server-side. |
| **Leaflet + OpenStreetMap** | Interactive map in `MapPinModal` for providers to pin their exact address coordinates during onboarding. Runs entirely in the browser; no API key required. |
| **Nominatim (OpenStreetMap)** | Reverse geocoding — converts a map pin (lat/lng) to a human-readable address. Free public API; no key required. |
| **PSGC API (`psgc.cloud`)** | Cascading Philippine Standard Geographic Code address dropdowns (Province → City/Municipality → Barangay) in all onboarding forms. Public API; no key required. |
| **MyMemory Translation API** | Per-message translation in the chat interface (Tagalog/Cebuano/English). Free public endpoint proxied through `POST /api/chat/translate`; results cached client-side per message. |

---

## Security

**Authentication**
- JWT stored in an `httpOnly`, `sameSite: strict`, `secure` (production) cookie — inaccessible to JavaScript, preventing XSS token theft.
- 1-day TTL on tokens. No refresh tokens; re-login is required after expiry.
- Admin login requires a third factor (admin code) on top of email + password.

**Passwords & secrets**
- All passwords hashed with bcrypt (salt rounds: 10). Admin codes are also bcrypt-hashed.
- Admin code uniqueness enforced via a separate HMAC-SHA256 key field rather than comparing bcrypt hashes, which cannot be compared for equality.
- Licence numbers (doctor, pharmacist, technologist) encrypted at rest using AES-256 via a server-side `ENCRYPTION_KEY`.

**Brute-force protection**
- Five consecutive wrong password attempts lock the account (`loginLockedAt` set). The 6th and subsequent attempts are rejected with HTTP 429.
- A one-time reset code is automatically emailed on lockout. The counter clears on successful login or completed password reset.

**Two-factor authentication**
- Optional per-user toggle. When enabled, a 6-digit OTP is sent via Brevo after the primary credentials are accepted.
- OTP can be delivered to either the verified email or the verified phone number; the user can switch channels mid-flow.
- Admin 2FA is gated — the admin code must be verified first; the `payload.adminVerified` flag in the verification record prevents OTP re-use across sessions.

**Input sanitization**
- `sanitize.middleware.js` runs on every request body: strips HTML tags from all string values and drops any key prefixed with `$` (NoSQL injection prevention).
- React escapes all rendered strings by default; no `dangerouslySetInnerHTML` is used anywhere except where explicitly safe.

**File access**
- Private S3 files (licences, permits, prescriptions, appointment files) are never served via public URLs. Every download goes through a 15-minute signed URL generated server-side; only the file owner or an admin can request one.
- Old S3 files are deleted on profile update, licence renewal approval/rejection, account rejection, and the nightly soft-delete sweep to prevent orphaned storage.

**Phone OTP**
- SMS delivery is mocked for demo purposes — the generated code is returned in the API response body with a visible warning banner. No real SMS is sent and no SMS provider is configured.

**Payments**
- All payments are simulated through a Demo Payment screen. No real money is transferred and no payment gateway is integrated.

---

## AI Chatbot

MedConnect includes a floating in-app assistant available to all authenticated users on every page.

**Scope**

The chatbot is strictly limited to MedConnect platform help. Its system prompt explicitly instructs the model to:
- Answer only questions about how MedConnect works — booking, payments, appointments, pharmacy orders, queue behaviour, settings, and account management.
- Refuse to provide medical diagnoses, treatment recommendations, or specific medical advice.
- Redirect symptom questions to the Expert System (`/consultation`) and doctor search questions to `/search`.
- Refuse off-topic questions entirely.

This scope is enforced through the system prompt sent on every request — the model itself (Llama 3.1 8B via Groq) has no awareness of any MedConnect-specific context beyond what the prompt provides.

**Rate limiting**

Limited to 20 messages per user per hour, enforced server-side using an in-memory Map (`rateLimiter.js`). The limit resets on a rolling window. When reached, the API returns HTTP 429 and the UI shows a modal explaining the cooldown. This prevents abuse of the free Groq tier.

**Model parameters**

| Parameter | Value |
|---|---|
| Model | `llama-3.1-8b-instant` (Groq) |
| Max tokens | 300 |
| Temperature | 0.4 |
| Request timeout | 12 seconds |
| Message history sent | Last 8 exchanges |

Keeping temperature low (0.4) reduces hallucination and keeps responses factual. The 300-token cap keeps answers concise and prevents the model from generating lengthy unverified content.

**Role-aware quick prompts**

On opening the chatbot panel, users see 6 quick-prompt chips tailored to their role (patient, doctor, pharmacy, institute, department, or admin). After the assistant replies, the chips reappear so users can easily continue with a follow-up question without typing.

**What it does not do**

- Does not access the database or any user data.
- Does not take any actions (cannot book appointments, send messages, or change settings).
- Does not answer questions about specific diagnoses, medications, or treatment plans.
- Does not use any persistent memory between sessions.


## Running Tests

```bash
cd backend
npm test
```

Uses Mocha + Chai. All 42 tests cover auth utilities, chatbot rate limiting, and API response helpers.

---

## Project Structure

```
MedConnect/
├── backend/
│   └── src/
│       ├── controllers/   # Business logic (23 controllers)
│       ├── routes/        # Express routers (21 route files)
│       ├── models/        # Mongoose models (27 models)
│       ├── middleware/     # Auth, sanitization, error handling
│       ├── services/       # cronJobs, email, notifications, S3
│       ├── utils/          # asyncHandler, response helpers, crypto, validation
│       └── validators/     # express-validator rule sets
├── frontend/
│   └── src/
│       ├── pages/         # 65 page and popup components
│       ├── components/    # 39 reusable components
│       ├── hooks/         # useAuthUser, useLogin, useLogout, useSignUp
│       ├── store/         # Zustand stores (call, forgotPassword, signUp, theme)
│       ├── lib/           # api.js, axios.js, utils.js, webpConverter.js
│       └── data/          # diseaseSymptoms.json, termAliases.json, medicalTerms.js (not in git)
```
