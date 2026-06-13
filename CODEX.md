# MedConnect - Codex Working Guide

This file is a Codex-specific branch of `CLAUDE.md`. Treat `CLAUDE.md` as the global source of truth, then use this file for the pharmacy branch work, recent cross-role changes, known behaviors, and user-specific implementation preferences.

Last updated by Codex: 2026-06-12.

## Non-Negotiable Rules

- Never read `.env` files or secret files directly.
- Do not run git commands. The developer handles commits, branches, staging, pushes, stashes, merges, and PRs manually.
- Always read `CLAUDE.md`, this `CODEX.md`, and the affected files before editing.
- Follow existing project patterns instead of inventing new ones.
- Existing files must be read before editing.
- For pharmacy work, prefer new pharmacy-specific files. Touch existing files only for routing, imports, shared UI integration, model registration, or unavoidable cross-feature wiring.
- Use S3 upload patterns exactly as the codebase does them. Image fields must use `{ url, key }`.
- Do not hard-code profile photos. Profile fallback icons are okay, but real profile images must come from stored `profilePic`.
- Backend changes mean the backend server must be restarted before testing.
- If a request touches stabilized auth/onboarding/settings credential flows from `CLAUDE.md`, confirm the exact change before editing.

## Codebase Standards To Preserve

- Backend structure: route -> controller -> validator.
- Backend responses: `sendSuccess` and `sendError`.
- Backend controllers: wrap async work with `asyncHandler`.
- Auth: use `req.user._id`, not `req.user.id`.
- Admin uses the separate `Admin` model, not the `User` discriminator.
- Frontend server state: TanStack Query.
- Frontend API calls: `axiosInstance` and helper functions in `frontend/src/lib/api.js` when possible.
- Client state: existing Zustand stores only.
- Date/time: `dayjs` with `utc` and `timezone`, scoped to `Asia/Manila`.
- Comments: minimal, only for non-obvious logic.
- UI: use the existing MedConnect blue/gray theme, visible card separation, subtle but clear shadows, and consistent title styling.

## Current Branch Scope

The pharmacy branch became broader than pharmacy only. It now includes:

- Full pharmacy ordering and pharmacist dashboard work.
- Patient-facing pharmacy catalogue/cart/checkout/payment flow.
- Admin analytics and platform-fee reporting.
- UI consistency work across admin, user, doctor, and pharmacy.
- Profile update fixes, notification styling, online/offline status presentation.
- Appointment rebooking/no-show logic and transaction history updates.
- Stream video call initialization hardening.

Future Codex sessions must assume these areas are connected and inspect affected files before changing any one of them.

## Pharmacy Features Implemented

### Pharmacist Side

- `HomePagePharmacy.jsx` is the pharmacy dashboard.
- Pharmacist sidebar tabs include Home, Catalogue, Transactions, and Settings.
- Home dashboard contains:
  - paid order list
  - shipping and pickup queue
  - completed orders
  - order history
  - prescription review button/card
  - rejected prescription request viewer
- Prescription review:
  - prescription-required orders are held before payment
  - pharmacist reviews uploaded prescription image
  - pharmacist can approve or reject
  - rejection includes reason dropdown and optional notes
  - rejected requests are not mixed into pending prescription reviews
- Order lifecycle:
  - paid -> ready for shipping / ready for pickup
  - ready -> out for delivery / pickup in progress
  - mock completion after roughly 10 minutes
  - completed tab/history shows completed records
- Transactions:
  - manual walk-in transactions can be added
  - manual transaction customer is effectively walk-in customer
  - manual item selector should use catalogue products
  - transaction history is clickable and should show details
  - history should show completed orders only where requested
  - histories should sort newest/latest first unless the specific workflow needs earliest upcoming first
- Income/transaction dashboard:
  - transaction tab and all-income tab
  - cards use visible shadows and 3-column layout where appropriate
  - daily income graph exists and should remain readable

### Pharmacist Catalogue

- Pharmacists can add, edit, delete catalogue products.
- Product fields:
  - image
  - medicine name
  - amount
  - unit, such as grams or pills
  - stock
  - price
  - OTC / prescription type
- Product names must be unique.
- Product cards open a detail modal with all product details.
- Delete action is available from the pharmacist product detail modal.
- Product image upload follows the shared S3 upload path and `{ url, key }` image model.
- Catalogue cards need visible borders/shadows so they do not blend into the page.
- Stock/type display should be visually prominent, but labels should stay smaller.
- Type styles:
  - OTC and Prescription should be visually distinct.
  - Prefer colored text or restrained pill/card styling over loud badges.

### Patient Pharmacy Side

- Patient pharmacy page has:
  - `Pharmacy` title
  - search bar
  - sort/filter beside search
  - cart button at top right
  - product cards below
- Product cards:
  - consistent card size
  - visible shadow/border
  - centered product name
  - no redundant pharmacy/provider text on catalogue cards
  - type shown as OTC or Prescription with matching styling
- Product click opens a receipt-like product detail modal:
  - blue header
  - product information
  - no redundant repeated medicine name inside if already in header
  - clear type field with full label
  - add-to-cart quantity controls
- Add-to-cart should open the product detail/quantity popup rather than immediately adding a single item.
- Cart:
  - persists across logout/page leave when possible
  - users can choose which cart items to checkout
  - horizontal row layout preferred over a long vertical detail list
  - quantity controls and remove action on the right
  - type displayed as OTC/Prescription, not "No prescription required"
  - show total, not just unit price
  - floating checkout bar should have visible shadow and should not slide sideways on click
- Checkout:
  - customer information/address is shown
  - address can still be edited by clicking the address section
  - selected items and details are listed
  - delivery or pickup option
  - delivery fee is 15% of product subtotal
  - platform fee follows existing platform-fee calculation where applicable
  - prescription products require upload and review before payment
  - payment uses the shared `SimulatedPaymentCard` style
  - payment popup lists items, details, price, fees, and total
  - T&C text must be clickable and open as a popup, not navigate away from payment
- Patient pharmacy order payment creates user notifications similar to appointment payments.

## Pharmacy Backend/Data

Pharmacy-specific backend modules were added:

- `backend/src/models/PharmacyProduct.js`
- `backend/src/models/PharmacyOrder.js`
- `backend/src/models/PharmacyManualTransaction.js`
- `backend/src/controllers/pharmacyProduct.controller.js`
- `backend/src/controllers/pharmacyOrder.controller.js`
- `backend/src/routes/pharmacyOrder.route.js`
- `backend/src/validators/pharmacyProduct.validator.js`
- `backend/src/validators/pharmacyOrder.validator.js`

Important pharmacy financial rules:

- Pharmacy delivery fee is separate from product subtotal.
- Pharmacy platform fee/admin cut belongs to MedConnect.
- Admin analytics should include pharmacy platform fee and delivery fee where those are platform-owned sales.
- Pharmacy transaction histories and admin analytics must not double count paid orders.

## S3 And Image Upload Rules

All uploads must go through existing upload infrastructure.

Backend:

- `POST /api/upload`
- `FOLDER_MAP` in `upload.controller.js`
- Public images, such as profile pictures and product images, should have both `url` and `key`.
- Private files, such as licenses, permits, prescriptions, and appointment files, should use `key` only and signed URLs.
- S3 cleanup must be non-fatal with `try/catch` around `deleteFromS3`.

Frontend:

- Use `ImageUploadField` and `uploadPendingImages(form, fieldNames)` where the pattern already exists.
- Do not store raw files in server state.
- Product and prescription image uploads must follow the same S3 pattern as existing profile/permit/license uploads.

Known fixed issue:

- Pharmacy profile image and bio update were broken. The fix followed the working profile update paths used by patient/doctor/admin and ensured pharmacy `bio` and `profilePic` are allowed and reflected after update.

## Admin Features And Changes

### Admin Sidebar/Home

- Removed unnecessary "view by" option on admin dashboard.
- Analytics was moved into the sidebar below Service Claims/User Management area as requested.
- Service Claims moved above Analytics in admin sidebar.
- Service Claims icon was changed so it is not the same as Analytics.

### Admin Analytics

Analytics is the MedConnect admin sales/revenue view.

It should collect platform-owned income from:

- appointment platform fees
- pharmacy platform fees
- pharmacy delivery fees when considered MedConnect-owned
- other platform-owned sales

Analytics UI is tabbed:

- Overview
- Platform Fee Transactions
- Revenue
- User Analytics

Overview:

- top card says `Total MedConnect Sales`, not platform cut
- remove redundant small "MedConnect sales" wording
- use larger cards in three-column style with visible shadows

Platform Fee Transactions:

- date filters apply here
- no separate "admin cut" wording; the platform fee/delivery fee is the admin/platform income
- transactions should show customer first, then reference id, summary, source, provider, and fees
- rows/cards are clickable and open a receipt-style modal
- receipt modal has a blue reference header and compact width

Revenue:

- date filters apply to this tab
- cards use the same gray background tone as the sidebar where requested

User Analytics:

- appointment breakdown and top provider/doctor cards should have visible card shadows
- card headers should use the same gray shade as the other analytics cards
- remove colored badges around counts/roles unless specifically needed

Known fixed backend bug:

- Admin analytics Mongo aggregation had invalid `$unwind` option name. It was corrected so analytics could load.

## User Management And Online Status

- Online/offline status should reflect actual activity rather than static text.
- Admin user management status column should show online/offline activity in place of the previous generic Active label.
- Remove redundant separate Activity column if Status already represents activity.
- Online users should float to the top of user management for easier scanning.
- Notification count badges should be red for all roles.
- History tab count badges should not show after viewed/read.

## Appointment And Rebooking Features

### Appointment Dashboard/Page Changes

- Doctor dashboard header should say `Hello, [name]`.
- Doctor home should not duplicate a full transaction tab when a transaction sidebar already exists.
- `Today's Queue` remains the universal queue label.
- Queue should show real patient details for online appointments instead of generic "Patient" where possible.
- User and doctor appointment pages have top bars for:
  - today's appointment
  - upcoming appointment
- Doctor appointment sidebar badge shows approval requests count and remains visible while approvals are pending.
- Doctor appointment active badge should use the same refined badge style as other updated badges.
- Before a booked appointment appears on the doctor schedule/calendar, it should be confirmed on the appointment page.
- Patients with a pending virtual appointment balance must pay that balance before booking another appointment.
- Appointment/rebook lists should be sorted:
  - active/upcoming: earliest first
  - history/transactions: newest/latest first

### Virtual Missed Appointment/Rebooking Logic

Virtual appointments use join tracking:

- patient joined
- provider joined

If a virtual appointment is missed:

- patient missed:
  - patient can rebook once within 3 days
  - patient pays a 10% rebooking fee
- provider missed:
  - patient receives 10% mock cashback
  - patient can rebook once within 3 days for free
- both missed:
  - patient can rebook once within 3 days for free
  - no payment exchange for the missed session

Rebooking constraints:

- only virtual appointments use automatic missed/rebook logic
- in-person appointments are out of scope for automatic no-show detection
- rebooking is only once
- rebooking must be within 3 days
- user chooses only the date; system assigns time/queue slot
- rebook request must return to doctor approval requests, not automatically enter the schedule
- past times cannot be booked or received by the doctor as requests
- if rebooked appointment is missed again, it becomes cancelled and there is no second rebook window
- if a rebook request expires before provider approval, it is cancelled

Rebook labels:

- Before successful rebook: `Missed - [Free/Paid/Cashback] Rebook Available`
- After rebook request is sent/successful: `Rebooked`
- Cancelled rebook should include rebook detail outcome such as rejected and cancelled, missed and cancelled, or expired and cancelled

### Rebook Refund/Cashback Rules

MedConnect platform fee rule:

- Patient pays the appointment amount/deposit and the platform fee is recorded for MedConnect.
- Platform fee belongs to MedConnect and must remain untouched.
- Cashback/refunds due to rebooking are doctor/provider responsibility.
- Cashback transactions must keep `platformFee: 0`.
- Do not deduct or reverse platform fees for rebook cashback/refunds.

Specific rejection rules:

- Doctor rejects both-missed free rebook:
  - doctor pays 10% refund/cashback
  - appointment becomes cancelled
- Doctor rejects provider-missed rebook:
  - doctor refunds the deposit/payment amount owed to patient
  - appointment becomes cancelled
  - MedConnect platform fee remains with MedConnect
- Doctor rejects patient-missed paid rebook:
  - doctor returns rebooking fee
  - appointment becomes cancelled

Transaction/receipt behavior:

- Rebook details are added to the original appointment receipt/details.
- Cashback has its own separate receipt because it adds money to the user and subtracts from doctor.
- Rejected paid booking requests create a separate `refund` transaction so both patient and provider can see the financial movement.
- Rejected-booking refunds should display as `Refunded` in transaction history, not only as `Rejected`.
- Cashback receipt states reason and whether it is money received/sent.
- Doctor transaction side must show cashback/refund as a negative amount from doctor earnings.
- User and doctor receive notifications when appointment history is updated by rebook outcome.

Files involved in this area:

- `backend/src/controllers/booking.controller.js`
- `backend/src/services/cronJobs.js`
- `frontend/src/pages/ViewPendingAppointmentPatientPopup.jsx`
- `frontend/src/pages/ViewPendingAppointmentDoctorPopup.jsx`
- `frontend/src/pages/PatientAppointmentsPage.jsx`
- `frontend/src/pages/DoctorAppointmentsPage.jsx`
- `frontend/src/pages/HomePageUser.jsx`
- `frontend/src/pages/HomePageDoctor.jsx`
- `frontend/src/pages/TransactionPage.jsx`
- `frontend/src/components/TransactionList.jsx`
- `frontend/src/components/Sidebar.jsx`

## Stream Chat And Video Call

- Chat remains Stream-powered.
- Video call route is `/call/:id`.
- Call page was hardened because it could spin forever on `Preparing your call`.
- `CallPage.jsx` now:
  - uses `axiosInstance` for `/booking/join-call`
  - uses the Stream API key returned by `/chat/token`, not a separate frontend-only key
  - explicitly connects the Stream video user with the server-generated token
  - prepares the room with `getOrCreate()`
  - joins with retries
  - marks `/booking/join-call` only after the Stream call state reports `CallingState.JOINED`
  - shows a retryable error instead of infinite loading
  - cleans up unfinished call clients
- If call still fails after the UI error screen, inspect browser console and Stream configuration. Do not read env files.
- Chat and video must use the same Stream API key/token pair. `/chat/token` returns both `token` and `apiKey`; frontend Stream clients should use that returned `apiKey` to avoid JWT signature mismatch.
- `VirtualJoinPrompt` must only navigate to `/call/:appointmentId`. It must not call `/booking/join-call`; only `CallPage` can mark attendance after Stream successfully joins.
- Important 2026-06-12 Stream fix: the SDK `join()` promise alone was not enough proof that the user actually entered the usable call UI. Attendance is now marked from inside `CallContent`, after the Stream React state becomes `JOINED`. If a user sees `Call unavailable`, they should not be recorded as joined.
- Existing appointments that were already falsely marked joined before this fix will keep that saved database state. Test this fix with a fresh appointment or manually reset that appointment's joined fields in MongoDB.
- If chat/video still show `AuthErrorTokenSignatureInvalid`, the backend server is likely still running an old build or the Stream API key/secret pair in environment configuration does not match. Restart backend first. If it persists, fix the environment pair without reading `.env` in Codex.

## Transaction History Standards

- All transaction history pages should sort newest/latest first unless explicitly showing upcoming schedules.
- Rows should be clickable when details exist.
- Appointment transaction modals should show:
  - reference
  - counterpart
  - schedule
  - status
  - amount
  - platform fee where relevant
  - net received for providers
  - rebook details if applicable
  - cashback receipt if applicable
  - refund receipt if a paid booking request was rejected
- Pharmacy order transaction modal should show:
  - reference
  - fulfillment
  - status
  - items
  - subtotal
  - delivery fee
  - platform fee
  - total paid

## UI And Theme Preferences

General:

- Keep the MedConnect theme: blue, white, light gray, restrained accents.
- Avoid too many colorful badges.
- When a badge is not required, prefer colored text or a clean bordered pill/card.
- Add visible but tasteful shadows around cards; user repeatedly prefers stronger all-around shadows, not only bottom shadows.
- Use card separation for tables/sections that blend into the background.
- Titles should be consistent across roles, following the stronger "Find a Provider" style.
- Navbar should be full blue, fixed, not see-through.
- Sidebar body should use a visible light-gray background, with active and profile/status areas separated by line/shadow.
- Profile circle in navbar/sidebar should have a border.
- Notification cards need stronger shadows.

Specific UI fixes already requested:

- User appointment badges: use MedConnect blue/refined badge style.
- User search cards: consistent badge treatment and visible shadows.
- User transaction pharmacy order statuses: use wrapped pill style, not awkward colored text bars.
- Doctor specialty cards: add separate shadows.
- Admin specialty/service lists: add card shadows and more prominent divisions.
- Admin add specialty/department/subspecialty/service controls should appear above lists, not below.
- Pharmacy catalogue/cart/checkout cards need visible shadows and section backgrounds.
- Manual transaction modal should have blue header.

## Terms, FAQ, And Documentation Updates

Terms and FAQ were updated for:

- pharmacy prescription/order payment behavior
- virtual missed appointment rebooking
- one-time rebook within three days
- patient missed/provider missed/both missed rules
- rebook rejection/cancellation outcomes
- provider-liable cashback/refunds
- MedConnect platform fee remaining untouched
- queue disclosures

If any payment, refund, rebook, prescription, pharmacy, or queue behavior changes, update:

- `frontend/src/components/TermsOfServiceContent.jsx`
- `frontend/src/pages/SettingsPage.jsx` FAQ
- payment/rebook receipt wording where users see the financial consequence

## Fixed Bugs And Stabilized Fixes From This Work

- Pharmacy profile picture and bio update did not reflect; fixed by matching working profile update paths.
- Pharmacy S3 uploads needed `{ url, key }` image model alignment.
- Pharmacy catalogue card sizes and shadows were inconsistent; improved.
- Cart/checkout/payment UI lacked detail and reused payment inconsistently; moved to shared `SimulatedPaymentCard`.
- Pharmacy order duplicate submissions were guarded so misclicks do not create multiple transactions.
- Rejected prescription requests were separated from pending prescription reviews.
- Terms link in payment opens as popup rather than navigating away.
- Admin analytics failed because aggregation used invalid `$unwind` option; fixed.
- Admin analytics was too cluttered; reorganized into tabs.
- Profile fallback images were corrected so no hard-coded random profile photo is used.
- User/admin/doctor/pharmacy notification badges moved toward red notification convention.
- Doctor transaction modal bug fixed so details popup appears.
- Doctor schedule/appointment request handling was audited after appointment changes.
- Appointment rebooking could appear as already rebooked without doctor seeing request; backend/frontend approval handling was corrected.
- Rebooked missed appointment could incorrectly create another rebook liability; corrected to cancel after one used rebook.
- Call page could spin forever on `Preparing your call`; hardened with timeout, retries, and error state.
- Call page no longer marks a participant as joined before the Stream React call state reaches `JOINED`.
- New appointment booking is blocked while the patient has an unpaid virtual appointment balance.
- Chat/video JWT signature mismatch was addressed by returning the backend Stream API key with the generated token and using that key on the frontend.
- Virtual join prompt no longer marks users as joined before the call room actually opens.
- Last attempted call/chat stabilization:
  - removed the remaining early `/booking/join-call` marker from `CallPage` setup
  - moved attendance marking into `CallContent`
  - preserved the join popup behavior on user/doctor dashboards
  - documented that remaining Stream 401/signature failures indicate stale backend runtime or mismatched Stream credentials, not catalogue/pharmacy logic

## Future-Session Checklist

Before editing:

1. Read `CLAUDE.md`.
2. Read this `CODEX.md`.
3. Do not read `.env`.
4. Inspect affected frontend and backend files.
5. Trace related features before editing, especially appointment, transaction, analytics, pharmacy, and profile changes.
6. If multiple problems are found, list them before fixing unless the user clearly asked for direct implementation.
7. For backend edits, remind the user to restart backend.
8. Run at least frontend build after frontend changes when feasible.
9. Use `node --check` for edited backend JS files when feasible.

## Manual Git Reminder For The Developer

Codex must not run git commands in this project. When the developer is ready to publish:

```powershell
git status -sb
git switch pharmacy
git add CODEX.md backend/src frontend/src
git commit -m "Update pharmacy branch refinements"
git push -u origin pharmacy
```

If `frontend/vite-dev.err` appears as untracked, do not add it. Stop the running Vite process before deleting it manually, or leave it untracked.
