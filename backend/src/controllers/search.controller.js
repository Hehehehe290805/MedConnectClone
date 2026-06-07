import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import User from "../models/User.js";
import DoctorSpecialty from "../models/DoctorSpecialty.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import DepartmentType from "../models/DepartmentType.js";
import Service from "../models/Service.js";
import Pricing from "../models/Pricing.js";
import Appointment from "../models/Appointment.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

dayjs.extend(utc);
dayjs.extend(timezone);

// Haversine distance in km. GeoJSON coords are [lng, lat].
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// Resolves a name term to a set of doctor IDs that match via name or specialty
async function doctorIdsForTerm(term) {
    const regex = new RegExp(term, "i");
    const [byName, specialties, subspecialties] = await Promise.all([
        User.find({ role: "doctor", status: "onBoarded", $or: [{ firstName: regex }, { lastName: regex }] }).select("_id").lean(),
        Specialty.find({ name: regex, status: "verified" }).select("_id").lean(),
        Subspecialty.find({ name: regex, status: "verified" }).select("_id").lean(),
    ]);
    const ids = new Set(byName.map(d => d._id.toString()));
    const specIds = specialties.map(s => s._id);
    const subIds = subspecialties.map(s => s._id);
    if (specIds.length || subIds.length) {
        const filter = { status: "verified", $or: [] };
        if (specIds.length) filter.$or.push({ specialtyId: { $in: specIds } });
        if (subIds.length) filter.$or.push({ subspecialtyId: { $in: subIds } });
        const claims = await DoctorSpecialty.find(filter).select("doctorId").lean();
        claims.forEach(c => ids.add(c.doctorId.toString()));
    }
    return ids;
}

// ── DOCTOR SEARCH ──────────────────────────────────────────────────────────────
// GET /api/search/doctors
// Query: name (string or array), sex, specialtyId, subspecialtyId, language, minPrice, maxPrice
export const searchDoctors = asyncHandler(async (req, res) => {
    const { name, sex, specialtyId, subspecialtyId, language, minPrice, maxPrice } = req.query;

    // User's coordinates for proximity sorting [lng, lat]
    const userCoords = req.user?.address?.coordinates?.coordinates;

    // Parse multi-term names — frontend sends multiple ?name= params for "+"  terms
    const terms = Array.isArray(name)
        ? name.map(t => t.trim()).filter(Boolean)
        : name?.trim() ? [name.trim()] : [];

    // 1. Base query — no name filter; name filtering is done via multi-term intersection below
    const query = { role: "doctor", status: "onBoarded" };
    if (sex) query.sex = sex.toLowerCase();
    if (language) query.languages = language;

    // Exclude doctors who have blocked the requesting patient
    const patientId = req.user?._id;
    if (patientId) {
        query.blockedPatients = { $not: { $elemMatch: { $eq: patientId } } };
    }

    let doctors = await User.find(query)
        .select("firstName lastName sex profilePic address languages bio specialty subSpecialty lastSeen maxPatientsPerDay")
        .populate("specialty", "name")
        .populate("subSpecialty", "name")
        .lean();

    // 2. Multi-term name/specialty matching (AND across terms)
    if (terms.length > 0) {
        const idSets = await Promise.all(terms.map(t => doctorIdsForTerm(t)));
        // Intersect all sets
        const intersection = idSets.reduce((acc, set) => {
            const next = new Set();
            for (const id of acc) { if (set.has(id)) next.add(id); }
            return next;
        });
        doctors = doctors.filter(d => intersection.has(d._id.toString()));
    }

    // 3. Specialty / subspecialty filter via dropdown
    if (specialtyId || subspecialtyId) {
        const claimFilter = { status: "verified" };
        if (specialtyId) claimFilter.specialtyId = new mongoose.Types.ObjectId(specialtyId);
        if (subspecialtyId) claimFilter.subspecialtyId = new mongoose.Types.ObjectId(subspecialtyId);
        const claims = await DoctorSpecialty.find(claimFilter).select("doctorId").lean();
        const matchIds = new Set(claims.map((c) => c.doctorId.toString()));
        doctors = doctors.filter((d) => matchIds.has(d._id.toString()));
    }

    if (!doctors.length) return sendSuccess(res, 200, "Doctors fetched", { doctors: [] });

    const doctorIds = doctors.map((d) => d._id);

    // 3. Pricing map
    const pricings = await Pricing.find({ providerId: { $in: doctorIds } }).lean();
    const priceMap = {};
    for (const p of pricings) priceMap[p.providerId.toString()] = p.price;

    // 4. Price filter
    if (minPrice || maxPrice) {
        doctors = doctors.filter((d) => {
            const price = priceMap[d._id.toString()];
            if (price == null) return false;
            if (minPrice && price < parseFloat(minPrice)) return false;
            if (maxPrice && price > parseFloat(maxPrice)) return false;
            return true;
        });
    }

    if (!doctors.length) return sendSuccess(res, 200, "Doctors fetched", { doctors: [] });

    // 5. Fetch verified specialties for remaining doctors
    const finalIds = doctors.map((d) => d._id);
    const allClaims = await DoctorSpecialty.find({
        doctorId: { $in: finalIds },
        status: "verified",
    })
        .populate("specialtyId", "name")
        .populate("subspecialtyId", "name")
        .lean();

    const specialtyMap = {};
    for (const c of allClaims) {
        const key = c.doctorId.toString();
        if (!specialtyMap[key]) specialtyMap[key] = { specialties: new Set(), subspecialties: new Set() };
        if (c.specialtyId?.name) specialtyMap[key].specialties.add(c.specialtyId.name);
        if (c.subspecialtyId?.name) specialtyMap[key].subspecialties.add(c.subspecialtyId.name);
    }
    // Also merge specialties set during onboarding (stored on User doc, not in DoctorSpecialty)
    for (const d of doctors) {
        const key = d._id.toString();
        if (!specialtyMap[key]) specialtyMap[key] = { specialties: new Set(), subspecialties: new Set() };
        for (const s of (d.specialty || [])) { if (s?.name) specialtyMap[key].specialties.add(s.name); }
        for (const s of (d.subSpecialty || [])) { if (s?.name) specialtyMap[key].subspecialties.add(s.name); }
    }

    // 6. Average ratings from completed appointments
    const ratingAgg = await Appointment.aggregate([
        {
            $match: {
                doctorId: { $in: finalIds.map((id) => new mongoose.Types.ObjectId(id)) },
                rating: { $exists: true, $ne: null },
            },
        },
        { $group: { _id: "$doctorId", avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ]);
    const ratingMap = {};
    for (const r of ratingAgg) ratingMap[r._id.toString()] = { avg: Math.round(r.avgRating * 10) / 10, count: r.reviewCount };

    // 6b. Today's booking count per doctor (for maxPatientsPerDay check)
    const todayStart = dayjs().tz("Asia/Manila").startOf("day").utc().toDate();
    const todayEnd = dayjs().tz("Asia/Manila").endOf("day").utc().toDate();
    const ACTIVE_STATUSES = ["pending_payment", "deposit_paid", "accepted", "ongoing"];
    const todayBookingAgg = await Appointment.aggregate([
        {
            $match: {
                doctorId: { $in: finalIds.map((id) => new mongoose.Types.ObjectId(id)) },
                status: { $in: ACTIVE_STATUSES },
                start: { $gte: todayStart, $lte: todayEnd },
            },
        },
        { $group: { _id: "$doctorId", count: { $sum: 1 } } },
    ]);
    const todayBookingMap = {};
    for (const r of todayBookingAgg) todayBookingMap[r._id.toString()] = r.count;

    // 7. Assemble results with distance
    let results = doctors.map((d) => {
        const id = d._id.toString();
        const coords = d.address?.coordinates?.coordinates;
        let distanceKm = null;
        if (userCoords?.length === 2 && coords?.length === 2) {
            distanceKm = Math.round(haversineKm(userCoords[1], userCoords[0], coords[1], coords[0]) * 10) / 10;
        }
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return {
            _id: d._id,
            firstName: d.firstName,
            lastName: d.lastName,
            sex: d.sex,
            profilePic: d.profilePic,
            bio: d.bio,
            languages: d.languages || [],
            city: d.address?.city || null,
            province: d.address?.province || null,
            coordinates: coords || null,
            price: priceMap[id] ?? null,
            specialties: [...(specialtyMap[id]?.specialties ?? [])],
            subspecialties: [...(specialtyMap[id]?.subspecialties ?? [])],
            averageRating: ratingMap[id]?.avg ?? null,
            reviewCount: ratingMap[id]?.count ?? 0,
            distanceKm,
            isOnline: d.lastSeen ? d.lastSeen >= fiveMinutesAgo : false,
            isFullToday: d.maxPatientsPerDay != null
                ? (todayBookingMap[id] ?? 0) >= d.maxPatientsPerDay
                : false,
            role: "doctor",
        };
    });

    // Sort by distance (nulls last), then alphabetically
    results.sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return a.lastName.localeCompare(b.lastName);
    });

    return sendSuccess(res, 200, "Doctors fetched", { doctors: results, sortedByProximity: Boolean(userCoords) });
});

// ── INSTITUTE SEARCH ───────────────────────────────────────────────────────────
// GET /api/search/institutes
// Query: name (string or array), type (clinic|hospital), departmentTypeId, serviceId, minPrice, maxPrice
export const searchInstitutes = asyncHandler(async (req, res) => {
    const { name, type, departmentTypeId, serviceId, minPrice, maxPrice } = req.query;

    const userCoords = req.user?.address?.coordinates?.coordinates;

    const terms = Array.isArray(name)
        ? name.map(t => t.trim()).filter(Boolean)
        : name?.trim() ? [name.trim()] : [];

    const query = { role: "institute", status: "onBoarded" };
    if (type) query.instituteType = type.toLowerCase();
    if (departmentTypeId) query.departments = new mongoose.Types.ObjectId(departmentTypeId);

    // Multi-term: match institute name OR department type name OR service name
    if (terms.length > 0) {
        const termRegexes = terms.map(t => new RegExp(t, "i"));
        // For each term, get matching institute IDs via name OR dept type OR service
        const termIdSets = await Promise.all(termRegexes.map(async (regex) => {
            const [byName, deptTypes, services] = await Promise.all([
                User.find({ role: "institute", status: "onBoarded", instituteName: regex }).select("_id").lean(),
                DepartmentType.find({ name: regex }).select("_id").lean(),
                Service.find({ name: regex, status: "verified" }).select("_id").lean(),
            ]);
            const ids = new Set(byName.map(i => i._id.toString()));
            // Find institutes that have departments of matching types
            if (deptTypes.length) {
                const deptTypeIds = deptTypes.map(d => d._id);
                const withDeptType = await User.find({
                    role: "institute", status: "onBoarded",
                    departments: { $in: deptTypeIds },
                }).select("_id").lean();
                withDeptType.forEach(i => ids.add(i._id.toString()));
            }
            // Find institutes whose departments offer matching services
            if (services.length) {
                const serviceIds = services.map(s => s._id);
                const claims = await InstituteDepartmentService.find({
                    serviceId: { $in: serviceIds }, status: "verified",
                }).select("departmentId").lean();
                const deptIds = claims.map(c => c.departmentId);
                const depts = await User.find({ _id: { $in: deptIds }, role: "department" }).select("rootInstitute").lean();
                depts.forEach(d => ids.add(d.rootInstitute?.toString()));
            }
            return ids;
        }));
        // Intersect across terms
        const intersection = termIdSets.reduce((acc, set) => {
            const next = new Set();
            for (const id of acc) { if (set.has(id)) next.add(id); }
            return next;
        });
        query._id = { $in: [...intersection] };
    }

    let institutes = await User.find(query)
        .select("instituteName instituteType profilePic address bio departments")
        .populate("departments", "name")
        .lean();

    // Filter by service: find which institutes have department sub-accounts offering that service
    if (serviceId) {
        const deptUsers = await User.find({
            role: "department",
            rootInstitute: { $in: institutes.map((i) => i._id) },
            status: "onBoarded",
        }).select("_id rootInstitute").lean();

        const claims = await InstituteDepartmentService.find({
            departmentId: { $in: deptUsers.map((d) => d._id) },
            serviceId: new mongoose.Types.ObjectId(serviceId),
            status: "verified",
        }).select("departmentId").lean();

        const deptIdToInstituteId = {};
        for (const d of deptUsers) deptIdToInstituteId[d._id.toString()] = d.rootInstitute.toString();

        const instituteIdsWithService = new Set(
            claims.map((c) => deptIdToInstituteId[c.departmentId.toString()]).filter(Boolean)
        );
        institutes = institutes.filter((i) => instituteIdsWithService.has(i._id.toString()));
    }

    if (!institutes.length) return sendSuccess(res, 200, "Institutes fetched", { institutes: [] });

    // Min price per institute (across their services in Pricing)
    const instituteIds = institutes.map((i) => i._id);
    const pricings = await Pricing.find({ providerId: { $in: instituteIds } }).lean();
    const priceRangeMap = {};
    for (const p of pricings) {
        const key = p.providerId.toString();
        if (!priceRangeMap[key]) priceRangeMap[key] = { min: p.price, max: p.price };
        else {
            if (p.price < priceRangeMap[key].min) priceRangeMap[key].min = p.price;
            if (p.price > priceRangeMap[key].max) priceRangeMap[key].max = p.price;
        }
    }

    // Price range filter
    if (minPrice || maxPrice) {
        institutes = institutes.filter((i) => {
            const range = priceRangeMap[i._id.toString()];
            if (!range) return false;
            if (minPrice && range.max < parseFloat(minPrice)) return false;
            if (maxPrice && range.min > parseFloat(maxPrice)) return false;
            return true;
        });
    }

    // Average ratings from completed appointments
    const finalIds = institutes.map((i) => i._id);
    const ratingAgg = await Appointment.aggregate([
        {
            $match: {
                instituteId: { $in: finalIds.map((id) => new mongoose.Types.ObjectId(id)) },
                rating: { $exists: true, $ne: null },
            },
        },
        { $group: { _id: "$instituteId", avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ]);
    const ratingMap = {};
    for (const r of ratingAgg) ratingMap[r._id.toString()] = { avg: Math.round(r.avgRating * 10) / 10, count: r.reviewCount };

    let results = institutes.map((i) => {
        const id = i._id.toString();
        const coords = i.address?.coordinates?.coordinates;
        let distanceKm = null;
        if (userCoords?.length === 2 && coords?.length === 2) {
            distanceKm = Math.round(haversineKm(userCoords[1], userCoords[0], coords[1], coords[0]) * 10) / 10;
        }
        return {
            _id: i._id,
            instituteName: i.instituteName,
            instituteType: i.instituteType,
            profilePic: i.profilePic,
            bio: i.bio,
            city: i.address?.city || null,
            province: i.address?.province || null,
            coordinates: coords || null,
            departmentTypes: (i.departments || []).map((d) => d.name || d).filter(Boolean),
            priceRange: priceRangeMap[id] ?? null,
            averageRating: ratingMap[id]?.avg ?? null,
            reviewCount: ratingMap[id]?.count ?? 0,
            distanceKm,
            role: "institute",
        };
    });

    results.sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return a.instituteName.localeCompare(b.instituteName);
    });

    return sendSuccess(res, 200, "Institutes fetched", { institutes: results, sortedByProximity: Boolean(userCoords) });
});
