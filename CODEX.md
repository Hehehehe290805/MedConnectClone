# MedConnect - Codex Pharmacy Guide

This file is a Codex-specific branch of `CLAUDE.md`. Use `CLAUDE.md` as the primary project guide, then apply the pharmacy-specific instructions here when working on the pharmacy section.

## Non-Negotiable Rules

- Never read `.env` files or secret files directly.
- Do not run git commands. The developer handles commits, branches, staging, pushes, and stashes manually.
- Read `CLAUDE.md` and the existing code before changing pharmacy behavior.
- Follow the existing codebase for naming, folder layout, response format, state management, validation, and documentation style.
- For pharmacy features, prefer creating new files instead of expanding existing files. Touch existing files only when needed for routing, exports, model registration, or unavoidable integration.
- Always read an existing file before editing it.

## Source Of Truth

Global standards come from `CLAUDE.md`, including:

- Backend structure: route -> controller -> validator.
- Backend responses: `sendSuccess` and `sendError`.
- Async controllers: `asyncHandler`.
- Auth: `protectRoute` sets `req.user`; use `req.user._id`, not `req.user.id`.
- Models: `User` discriminator pattern for patient, doctor, pharmacy, institute, and department. `Admin` is separate.
- Frontend state: Zustand for client state, TanStack Query for server state, `axiosInstance` for API calls.
- Date/time: `dayjs` with `utc` and `timezone`, scoped to `Asia/Manila`.
- Comments: minimal, only for non-obvious logic. No JSDoc.

## Pharmacy Scope

Pharmacy is a licensed provider role intended for medicine ordering services. It is partially implemented.

Current pharmacy behavior:

- Pharmacy onboarding submits credentials and becomes `pending`.
- Admin approval moves pharmacy accounts to `onBoarded`.
- Pharmacy dashboard currently has `Orders`, `Manage Catalogue`, and `Transactions` tabs.
- `Orders` and `Manage Catalogue` are intentional placeholders until the medicine ordering/catalogue feature is built.
- Pharmacy receives approval, rejection, renewal, and relevant notification events.
- Pharmacy permit renewal exists through the Settings renewal flow.

Current pharmacy boundaries:

- Pharmacy has no appointment or booking involvement at this stage.
- Pharmacy must not use doctor or department appointment flows.
- Pharmacy transaction history should populate only once medicine ordering/payment features exist.
- Do not remove or replace placeholder tabs without explicit instruction.

## Pharmacy Data

Pharmacy fields live on the `Pharmacy` discriminator in `backend/src/models/User.js`.

Important fields:

- `pharmacyName`
- `pharmacistFirstName`
- `pharmacistLastName`
- `sex`
- `bio`
- `address`
- `businessPermit { key }`
- `businessPermitExpiration`
- `fdaLicense { key }`
- `fdaLicenseExpiration`
- `pharmacistLicenseNumber`, encrypted at rest
- `pharmacistLicenseExpiration`
- `pharmacistLicenseImage { key }`
- `pharmacistLegalIDImage { key }`

Credential images are private S3 files. Private image fields should have `key` only and an empty or absent public `url`.

## S3 And Image Uploads

All pharmacy image upload work must follow the existing project pattern.

Backend:

- Uploads go through `POST /api/upload`.
- `backend/src/controllers/upload.controller.js` owns `FOLDER_MAP`.
- Pharmacy credential folders:
  - `businessPermit` -> `private/permits`
  - `fdaLicense` -> `private/permits`
  - `pharmacistLicenseImage` -> `private/licenses`
  - `pharmacistLegalIDImage` -> `private/licenses`
- Use signed URLs for private file viewing.
- S3 deletion must be non-fatal: wrap `deleteFromS3` in `try/catch`.
- Approval/rejection/force-delete flows must clean up old or rejected S3 files where applicable.

Frontend:

- Use `ImageUploadField` from `frontend/src/pages/OnboardingShared.jsx`.
- Store selected images locally as `{ file }`.
- Use `uploadPendingImages(form, fieldNames)` on submit.
- Do not upload directly from new UI components unless matching the existing helper pattern.
- Do not store raw files in server state or global stores.

## Existing Pharmacy Files To Check First

Frontend:

- `frontend/src/pages/HomePagePharmacy.jsx`
- `frontend/src/pages/OnboardingPharmacy.jsx`
- `frontend/src/pages/SettingsPage.jsx`
- `frontend/src/pages/ProfilePage.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/lib/api.js`

Backend:

- `backend/src/models/User.js`
- `backend/src/controllers/onboarding.controller.js`
- `backend/src/validators/onboarding.validator.js`
- `backend/src/controllers/upload.controller.js`
- `backend/src/controllers/permits.controller.js`
- `backend/src/validators/permits.validator.js`
- `backend/src/controllers/admin.controller.js`
- `backend/src/services/s3.js`
- `backend/src/services/cronJobs.js`

## Pharmacy Feature Development Rules

When adding pharmacy features:

- Prefer new pharmacy-specific files, such as new controllers, validators, routes, models, pages, components, or hooks.
- Keep appointment, booking, doctor, and department logic untouched unless the user explicitly asks for integration.
- Keep API boundaries role-aware and verify `req.user.role === "pharmacy"` for pharmacy-owned mutations.
- Use validators for request validation.
- Use `sendSuccess` and `sendError` for every backend response.
- Use `asyncHandler` for controllers.
- Use TanStack Query for server reads and mutations on the frontend.
- Use `axiosInstance` through helpers in `frontend/src/lib/api.js` where consistent with existing code.
- Preserve the dashboard tabs unless explicitly changing them as part of the requested pharmacy feature.

## Likely Future Pharmacy Modules

These are expected areas for the proper pharmacy section, but implement only when instructed:

- Medicine catalogue management.
- Medicine image upload and replacement.
- Medicine availability and stock status.
- Patient-facing pharmacy browsing.
- Patient medicine orders.
- Pharmacy order management.
- Pharmacy transactions from orders.
- Order disputes or cancellation rules, if required.

For catalogue and order work, create pharmacy-specific backend modules instead of mixing medicine-order logic into appointment or booking modules.

## Before Implementing Pharmacy Work

1. Read `CLAUDE.md`.
2. Read this `CODEX.md`.
3. Inspect the existing pharmacy, upload, permit, admin cleanup, and relevant UI files.
4. Identify affected integration points.
5. If the user request is ambiguous, stop and ask before editing.
6. If multiple issues are discovered, list them first and wait for instruction before fixing.

## Testing Checklist For Pharmacy Work

- Pharmacy onboarding still submits required private uploads.
- Admin can view pharmacy credentials through signed URL previews.
- Approving pharmacy accounts keeps the correct files.
- Rejecting or force-deleting pharmacy accounts cleans S3 files non-fatally.
- Permit renewal for pharmacist license, business permit, and FDA license still works.
- New image replacement deletes old S3 objects where the existing pattern requires it.
- Pharmacy dashboard still shows Orders, Manage Catalogue, and Transactions unless explicitly changed.
- Pharmacy does not gain appointment or booking access accidentally.
