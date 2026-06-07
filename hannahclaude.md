# Hannah's Branch — Change Tracker

Branch: `hannah` | Started from: `main` | Date: 2026-06-07

This file tracks all changes made (or to be made) on this branch.

---

## Already Done (in working tree, not yet committed)

### Backend

| File | Change |
|---|---|
| `backend/src/controllers/search.controller.js` | Added `searchDepartments` controller — proximity + multi-filter + Haversine ranking for department search |
| `backend/src/routes/search.route.js` | Added `GET /api/search/departments` route behind `protectRoute` |
| `backend/src/models/InstituteDepartmentService.js` | Added `"rejected"` to `status` enum — `rejectClaim` was throwing Mongoose ValidationError |
| `backend/src/controllers/admin.controller.js` | Fixed `getPendingClaims`: `populate("instituteId", ...)` → `populate("departmentId", ...)` so service claims appear in admin panel; fixed `rejectRole` cleanup: `{ instituteId: userId }` → `{ departmentId: userId }` |
| `backend/src/controllers/service.controller.js` | Added `notifyAllAdmins` call in `claimService` — admins now receive in-app + email notification when a department submits a service claim |

### Frontend

| File | Change |
|---|---|
| `frontend/src/pages/ServicesPage.jsx` | **NEW** — Department services management page (`/services`); lists claimed services grouped by status (Approved / Pending / Rejected) with duration badges |
| `frontend/src/pages/HomePageAdmin.jsx` | Fixed `ClaimRow`: now shows department technologist name (from `departmentId`) for service claims instead of always showing "Unknown" |
| `frontend/src/pages/ViewPendingClaimPopup.jsx` | Made popup department-aware: service claims show department name/email and duration; license number + approved specialties sections are hidden for service claims |
| `frontend/src/components/SuggestServicePopup.jsx` | **NEW** — Modal for department users to suggest a new service; posts to `POST /api/services/suggest` |
| `frontend/src/App.jsx` | Added `/services` route for `department` role pointing to `ServicesPage` |
| `frontend/src/components/Navbar.jsx` | Added "Add Service" button (department-only, visible on `/services` page) that opens `SuggestServicePopup` |
| `frontend/src/components/ProviderCard.jsx` | Extended card to support `department` provider type — shows services, price range, distance, Google Maps link |
| `frontend/src/pages/SearchPage.jsx` | Added department search mode (3rd tab); updated `buildParams` and result rendering for departments |
| `frontend/src/pages/SignUpPage.jsx` | Added Terms & Privacy Policy scroll gate before allowing signup submission |

---

## To Do — Open Items

### High Priority (from CLAUDE.md flags)

| # | Task | File(s) to touch | Notes |
|---|---|---|---|
| 88 | **Fix: Doctor cannot see own verified specialties on `/specialty` page** | `frontend/src/pages/SpecialtyPage.jsx`, `GET /api/specialties/doctor-specialties` | Bug — already-approved claims not showing in the management view (distinct from ProfilePage fix #38 which is done) |
| 53 | **Institute booking popup** | `frontend/src/components/CreateInstituteBookingPopup.jsx` (new), `POST /api/booking/book` | Pass `instituteId` + `serviceId` + `start`; mirror `CreateBookingPopup` for doctor path |
| — | **Department search on SearchPage** | `frontend/src/pages/SearchPage.jsx` | Wire up the new `GET /api/search/departments` endpoint to the 3rd tab; display department `ProviderCard` results |

### Medium Priority

| # | Task | Notes |
|---|---|---|
| 81 | Bayesian rating in bipartite ranker | Replace `doc.averageRating / 5` in `SearchPage.jsx` with `(C×m + Σratings)/(C+n)`; needs `reviewCount` from search API |
| 82 | Specialties more visible on doctor card | Larger chips on `ProviderCard`, shown by default |
| 83 | Expert system checkbox-style symptom input | Typeahead checkbox list in `ConsultationPage` symptom step |

### Still Needs Review / Verification

| Item | What to check |
|---|---|
| `ServicesPage.jsx` | Confirm it calls `GET /api/services/my-services` and handles empty state correctly |
| `SuggestServicePopup.jsx` | Confirm it posts to `/api/services/suggest` and shows success/error toasts (not `alert()`) |
| `ProviderCard.jsx` — department path | Confirm price range, distance, and "Get Directions" render without crashing when fields are undefined |
| `SearchPage.jsx` — department tab | Confirm `buildParams` passes the right query params to `/api/search/departments` |
| `search.route.js` | Confirm `GET /departments` is registered and `protectRoute` is applied |

---

## Notes

- All monetary amounts are PHP — no currency conversion logic needed.
- Department search uses the same Haversine + multi-filter pattern as doctor/institute search.
- `ServicesPage` is the department equivalent of `SpecialtyPage` for doctors.
- Do not modify the appointment status machine without explicit discussion.
- No git commands — all git operations are done manually by the developer.
