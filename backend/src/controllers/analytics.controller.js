import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import PharmacyOrder from "../models/PharmacyOrder.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const roundCurrency = (value) => Math.round((value || 0) * 100) / 100;

const resolveUserName = (user) => {
    if (!user) return "Unknown";
    if (user.firstName || user.lastName) return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    if (user.pharmacyName) return user.pharmacyName;
    if (user.instituteName) return user.instituteName;
    if (user.technologistFirstName || user.technologistLastName) {
        return `${user.technologistFirstName || ""} ${user.technologistLastName || ""}`.trim();
    }
    return user.email || "Unknown";
};

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
    const dateRange = { $gte: fromUtc, $lte: toUtc };
    const transactionDateFilter = { createdAt: dateRange };
    const paidPharmacyOrderDateFilter = {
        paymentStatus: "paid",
        $or: [
            { paidAt: dateRange },
            { paidAt: { $exists: false }, createdAt: dateRange },
            { paidAt: null, createdAt: dateRange },
        ],
    };

    // ── 1. Total revenue across all transactions ───────────────────────────
    const [appointmentRevenueTotals] = await Transaction.aggregate([
        { $match: transactionDateFilter },
        {
            $group: {
                _id: null,
                appointmentRevenue: { $sum: "$amount" },
                platformRevenue: { $sum: "$platformFee" },
            },
        },
    ]).exec();

    const [pharmacyRevenueTotals] = await PharmacyOrder.aggregate([
        { $match: paidPharmacyOrderDateFilter },
        {
            $group: {
                _id: null,
                pharmacyRevenue: { $sum: "$totalAmount" },
                pharmacyDeliveryFees: { $sum: "$deliveryFee" },
                pharmacyPlatformFees: { $sum: "$platformFee" },
                pharmacyOrderCount: { $sum: 1 },
            },
        },
    ]).exec();

    const appointmentRevenue = appointmentRevenueTotals?.appointmentRevenue ?? 0;
    const appointmentPlatformFees = appointmentRevenueTotals?.platformRevenue ?? 0;
    const pharmacyRevenue = pharmacyRevenueTotals?.pharmacyRevenue ?? 0;
    const pharmacyDeliveryFees = pharmacyRevenueTotals?.pharmacyDeliveryFees ?? 0;
    const pharmacyPlatformFees = pharmacyRevenueTotals?.pharmacyPlatformFees ?? 0;
    const pharmacyOrderCount = pharmacyRevenueTotals?.pharmacyOrderCount ?? 0;
    const additionalFees = 0;
    const totalRevenue = appointmentRevenue + pharmacyRevenue;
    const platformRevenue = appointmentPlatformFees + pharmacyDeliveryFees + pharmacyPlatformFees + additionalFees;

    const [appointmentPlatformTransactions, pharmacyPlatformTransactions] = await Promise.all([
        Transaction.find({ ...transactionDateFilter, platformFee: { $gt: 0 } })
            .populate({
                path: "appointmentId",
                select: "amount start doctorId instituteId serviceId",
                populate: [
                    { path: "doctorId", select: "firstName lastName email role" },
                    { path: "instituteId", select: "instituteName technologistFirstName technologistLastName email role" },
                    { path: "serviceId", select: "name" },
                ],
            })
            .populate("payerId", "firstName lastName email role")
            .populate("payeeId", "firstName lastName instituteName technologistFirstName technologistLastName email role")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean(),
        PharmacyOrder.find(paidPharmacyOrderDateFilter)
            .populate("patientId", "firstName lastName email role")
            .populate("pharmacyId", "pharmacyName email role")
            .sort({ paidAt: -1, createdAt: -1 })
            .limit(100)
            .lean(),
    ]);

    const platformFeeTransactions = [
        ...appointmentPlatformTransactions.map((transaction) => {
            const appointment = transaction.appointmentId;
            const provider = appointment?.doctorId || appointment?.instituteId || transaction.payeeId;
            const serviceName = appointment?.serviceId?.name;
            const summary = serviceName
                ? `${serviceName} appointment`
                : `${resolveUserName(provider)} appointment`;

            return {
                id: transaction._id,
                source: "appointment",
                referenceNumber: transaction.referenceNumber,
                orderId: appointment?._id || transaction.appointmentId,
                customerName: resolveUserName(transaction.payerId),
                providerName: resolveUserName(provider),
                summary,
                paidAt: transaction.createdAt,
                totalAmount: appointment?.amount ?? transaction.amount,
                amountPaid: transaction.amount,
                platformFee: transaction.platformFee || 0,
                deliveryFee: 0,
                adminCut: transaction.platformFee || 0,
            };
        }),
        ...pharmacyPlatformTransactions.map((order) => {
            const fallbackPlatformFee = order.platformFee || roundCurrency((order.subtotal || 0) * 0.1);
            const deliveryFee = order.deliveryFee || 0;
            const itemSummary = (order.items || []).map((item) => item.name).filter(Boolean).slice(0, 3).join(", ");

            return {
                id: order._id,
                source: "pharmacy",
                referenceNumber: order.referenceNumber,
                orderId: order._id,
                customerName: resolveUserName(order.patientId),
                providerName: resolveUserName(order.pharmacyId),
                summary: itemSummary || "Pharmacy order",
                paidAt: order.paidAt || order.createdAt,
                totalAmount: order.totalAmount || 0,
                amountPaid: order.totalAmount || 0,
                platformFee: fallbackPlatformFee,
                deliveryFee,
                adminCut: roundCurrency(fallbackPlatformFee + deliveryFee),
            };
        }),
    ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)).slice(0, 150);

    // ── 2. Revenue by day (within date range) ─────────────────────────────
    const revenueByDayRaw = await Transaction.aggregate([
        { $match: transactionDateFilter },
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

    const pharmacyRevenueByDayRaw = await PharmacyOrder.aggregate([
        { $match: paidPharmacyOrderDateFilter },
        {
            $group: {
                _id: {
                    day: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: { $ifNull: ["$paidAt", "$createdAt"] },
                            timezone: "Asia/Manila",
                        },
                    },
                },
                revenue: { $sum: "$totalAmount" },
                platformRevenue: { $sum: { $add: ["$deliveryFee", { $ifNull: ["$platformFee", 0] }] } },
            },
        },
        { $sort: { "_id.day": 1 } },
    ]).exec();

    const revenueByDayMap = new Map(revenueByDay.map((row) => [row.date, { ...row }]));
    for (const row of pharmacyRevenueByDayRaw) {
        const date = dayjs.utc(row._id.day).tz("Asia/Manila").format("YYYY-MM-DD");
        const current = revenueByDayMap.get(date) || { date, revenue: 0, platformRevenue: 0 };
        current.revenue += row.revenue;
        current.platformRevenue += row.platformRevenue;
        revenueByDayMap.set(date, current);
    }
    const combinedRevenueByDay = [...revenueByDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

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
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: false } },
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
        salesBreakdown: {
            appointmentRevenue,
            appointmentPlatformFees,
            pharmacyRevenue,
            pharmacyDeliveryFees,
            pharmacyPlatformFees,
            pharmacyOrderCount,
            additionalFees,
        },
        revenueByDay: combinedRevenueByDay,
        platformFeeTransactions,
        revenueByDoctor,
        appointmentVolume,
        topProviders,
        cancellationRate: parseFloat(cancellationRate.toFixed(2)),
        disputeRate: parseFloat(disputeRate.toFixed(2)),
    });
});
