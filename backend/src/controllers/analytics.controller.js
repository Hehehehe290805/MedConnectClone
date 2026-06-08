import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const getAnalytics = asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    // Default: last 30 days in Asia/Manila time
    const toDate = to
        ? dayjs.tz(to, "Asia/Manila").endOf("day")
        : dayjs().tz("Asia/Manila").endOf("day");
    const fromDate = from
        ? dayjs.tz(from, "Asia/Manila").startOf("day")
        : toDate.subtract(29, "day").startOf("day");

    const fromUtc = fromDate.toDate();
    const toUtc = toDate.toDate();

    // ── 1. Total revenue across all transactions ───────────────────────────
    const [revenueTotals] = await Transaction.aggregate([
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" },
                platformRevenue: { $sum: "$platformFee" },
            },
        },
    ]).exec();

    const totalRevenue = revenueTotals?.totalRevenue ?? 0;
    const platformRevenue = revenueTotals?.platformRevenue ?? 0;

    // ── 2. Revenue by day (within date range) ─────────────────────────────
    const revenueByDayRaw = await Transaction.aggregate([
        { $match: { createdAt: { $gte: fromUtc, $lte: toUtc } } },
        {
            $group: {
                _id: {
                    day: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$createdAt",
                            timezone: "Asia/Manila",
                        },
                    },
                },
                revenue: { $sum: "$amount" },
                platformRevenue: { $sum: "$platformFee" },
            },
        },
        { $sort: { "_id.day": 1 } },
    ]).exec();

    const revenueByDay = revenueByDayRaw.map((r) => ({
        date: dayjs.utc(r._id.day).tz("Asia/Manila").format("YYYY-MM-DD"),
        revenue: r.revenue,
        platformRevenue: r.platformRevenue,
    }));

    // ── 3. Revenue by doctor (top 20) ─────────────────────────────────────
    // Transactions go to the payeeId (the provider). We only want doctor payees.
    const revenueByDoctorRaw = await Transaction.aggregate([
        {
            $group: {
                _id: "$payeeId",
                totalRevenue: { $sum: "$amount" },
                appointmentCount: { $addToSet: "$appointmentId" },
            },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 20 },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "provider",
            },
        },
        { $unwind: { path: "$provider", preserveNullAndEmpty: false } },
        { $match: { "provider.role": "doctor" } },
    ]).exec();

    const revenueByDoctor = revenueByDoctorRaw.map((r) => ({
        doctorId: r._id,
        name: `${r.provider.firstName ?? ""} ${r.provider.lastName ?? ""}`.trim() || r.provider.email,
        totalRevenue: r.totalRevenue,
        appointmentCount: r.appointmentCount.length,
    }));

    // ── 4. Appointment volume ──────────────────────────────────────────────
    const volumeRaw = await Appointment.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]).exec();

    const volumeMap = {};
    for (const { _id, count } of volumeRaw) volumeMap[_id] = count;

    const total = Object.values(volumeMap).reduce((a, b) => a + b, 0);
    const appointmentVolume = {
        total,
        accepted: volumeMap.accepted ?? 0,
        completed: volumeMap.completed ?? 0,
        fullyPaid: volumeMap.fully_paid ?? 0,
        cancelled: volumeMap.cancelled ?? 0,
        rejected: volumeMap.rejected ?? 0,
        disputed: volumeMap.disputed ?? 0,
        resolved: volumeMap.resolved ?? 0,
    };

    // ── 5. Top providers by appointment count (top 10) ────────────────────
    const topProvidersRaw = await Appointment.aggregate([
        {
            $facet: {
                byDoctor: [
                    { $match: { doctorId: { $exists: true, $ne: null } } },
                    {
                        $group: {
                            _id: "$doctorId",
                            appointmentCount: { $sum: 1 },
                        },
                    },
                ],
                byInstitute: [
                    { $match: { instituteId: { $exists: true, $ne: null } } },
                    {
                        $group: {
                            _id: "$instituteId",
                            appointmentCount: { $sum: 1 },
                        },
                    },
                ],
            },
        },
    ]).exec();

    const allProviderCounts = [
        ...(topProvidersRaw[0]?.byDoctor ?? []).map((p) => ({ ...p, providerType: "doctor" })),
        ...(topProvidersRaw[0]?.byInstitute ?? []).map((p) => ({ ...p, providerType: "department" })),
    ].sort((a, b) => b.appointmentCount - a.appointmentCount).slice(0, 10);

    // Fetch revenue totals for these providers
    const providerIds = allProviderCounts.map((p) => p._id);
    const providerRevenueRaw = await Transaction.aggregate([
        { $match: { payeeId: { $in: providerIds } } },
        { $group: { _id: "$payeeId", totalRevenue: { $sum: "$amount" } } },
    ]).exec();
    const providerRevenueMap = {};
    for (const { _id, totalRevenue } of providerRevenueRaw) {
        providerRevenueMap[_id.toString()] = totalRevenue;
    }

    // Fetch user documents for name resolution
    const providerDocs = await User.find({ _id: { $in: providerIds } })
        .select("firstName lastName instituteName pharmacyName role email technologistFirstName technologistLastName")
        .lean();
    const providerDocMap = {};
    for (const doc of providerDocs) providerDocMap[doc._id.toString()] = doc;

    const resolveName = (doc) => {
        if (!doc) return "Unknown";
        if (doc.firstName && doc.lastName) return `${doc.firstName} ${doc.lastName}`;
        if (doc.technologistFirstName) return `${doc.technologistFirstName} ${doc.technologistLastName ?? ""}`.trim();
        return doc.instituteName || doc.pharmacyName || doc.email || "Unknown";
    };

    const topProviders = allProviderCounts.map((p) => {
        const doc = providerDocMap[p._id.toString()];
        return {
            providerId: p._id,
            name: resolveName(doc),
            role: doc?.role ?? p.providerType,
            appointmentCount: p.appointmentCount,
            totalRevenue: providerRevenueMap[p._id.toString()] ?? 0,
        };
    });

    // ── 6. Rates ──────────────────────────────────────────────────────────
    const cancellationRate = total > 0 ? ((appointmentVolume.cancelled / total) * 100) : 0;
    const disputeRate = total > 0 ? (((appointmentVolume.disputed + appointmentVolume.resolved) / total) * 100) : 0;

    return sendSuccess(res, 200, "Analytics fetched successfully.", {
        totalRevenue,
        platformRevenue,
        revenueByDay,
        revenueByDoctor,
        appointmentVolume,
        topProviders,
        cancellationRate: parseFloat(cancellationRate.toFixed(2)),
        disputeRate: parseFloat(disputeRate.toFixed(2)),
    });
});
