import PharmacyOrder from "../models/PharmacyOrder.js";
import PharmacyManualTransaction from "../models/PharmacyManualTransaction.js";
import PharmacyProduct from "../models/PharmacyProduct.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { notify } from "../services/notification.service.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = "Asia/Manila";

const ACTIVE_STATUSES = [
    "paid",
    "ready_for_shipping",
    "ready_for_pickup",
    "out_for_delivery",
    "pickup_in_progress",
];

const RECENT_COMPLETED_DAYS = 7;
const AUTO_COMPLETE_MINUTES = 10;
const DELIVERY_FEE_RATE = 0.15;
const PLATFORM_FEE_RATE = 0.1;

const roundCurrency = (value) => Math.round(value * 100) / 100;

const ensurePharmacy = (req, res) => {
    if (req.user?.role !== "pharmacy") {
        sendError(res, 403, "Only pharmacy accounts can manage pharmacy orders.");
        return false;
    }
    return true;
};

const populateOrder = (query) => query.populate("patientId", "firstName lastName email phoneNumber");

const generateReference = (prefix = "PH") => {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${ts}-${rand}`;
};

const findClientOrder = ({ patientId, clientRequestId }) => {
    if (!clientRequestId) return null;
    return PharmacyOrder.findOne({ patientId, clientRequestId });
};

const sendExistingClientOrder = async ({ req, res, clientRequestId, message }) => {
    const existingOrder = await findClientOrder({
        patientId: req.user._id,
        clientRequestId,
    });
    if (!existingOrder) return false;

    sendSuccess(res, 200, message, { order: normalizeOrder(existingOrder) });
    return true;
};

const ensurePatient = (req, res) => {
    if (req.user?.role !== "patient") {
        sendError(res, 403, "Only patient accounts can place pharmacy orders.");
        return false;
    }
    return true;
};

const formatAddress = (address = {}) => [
    address.buildingNumber,
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
].filter(Boolean).join(", ");

const orderPaymentDateFilter = (start, end) => ({
    paymentStatus: "paid",
    $or: [
        { paidAt: { $gte: start, $lt: end } },
        { paidAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
        { paidAt: null, createdAt: { $gte: start, $lt: end } },
    ],
});

const buildOrderFromCart = async ({ user, items, fulfillmentMethod, pickupTime, deliveryAddress, paymentStatus, status, prescriptionImage, clientRequestId, referencePrefix = "PH", allowPrescriptionItems = false, requirePrescriptionItems = false }) => {
    const productIds = items.map((item) => item.productId);
    const products = await PharmacyProduct.find({ _id: { $in: productIds }, isActive: true });
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    const orderItems = [];
    let pharmacyId = null;
    let subtotal = 0;
    let hasPrescriptionItem = false;

    for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error("A product in your cart is no longer available.");
        if (pharmacyId && pharmacyId.toString() !== product.pharmacyId.toString()) {
            throw new Error("Please checkout products from one pharmacy at a time.");
        }
        if (product.stock < item.quantity) {
            throw new Error(`${product.name} only has ${product.stock} item(s) in stock.`);
        }
        if (!allowPrescriptionItems && !product.overTheCounter) {
            throw new Error(`${product.name} requires prescription review before payment.`);
        }
        if (!product.overTheCounter) hasPrescriptionItem = true;

        pharmacyId = product.pharmacyId;
        subtotal += product.price * item.quantity;
        orderItems.push({
            productId: product._id,
            name: product.name,
            image: product.image,
            unitPrice: product.price,
            quantity: item.quantity,
            overTheCounter: product.overTheCounter,
        });
    }

    if (requirePrescriptionItems && !hasPrescriptionItem) {
        throw new Error("This cart does not contain any medicine that needs prescription review.");
    }

    const deliveryFee = fulfillmentMethod === "delivery" ? roundCurrency(subtotal * DELIVERY_FEE_RATE) : 0;
    const platformFee = roundCurrency(subtotal * PLATFORM_FEE_RATE);
    const order = await PharmacyOrder.create({
        pharmacyId,
        patientId: user._id,
        items: orderItems,
        fulfillmentMethod,
        status,
        paymentStatus,
        subtotal,
        deliveryFee,
        platformFee,
        totalAmount: roundCurrency(subtotal + deliveryFee + platformFee),
        pickupTime,
        deliveryAddress,
        clientRequestId,
        prescriptionImage,
        referenceNumber: generateReference(referencePrefix),
        paidAt: paymentStatus === "paid" ? new Date() : undefined,
    });

    return order;
};

const reduceStockForOrder = async (order) => {
    for (const item of order.items) {
        await PharmacyProduct.updateOne(
            { _id: item.productId, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } }
        );
    }
};

const normalizeOrder = (order) => {
    const raw = typeof order.toObject === "function" ? order.toObject() : order;
    const patient = raw.patientId;
    return {
        ...raw,
        customerName: patient
            ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || patient.email || "Customer"
            : "Customer",
    };
};

export const completeDuePharmacyOrders = async () => {
    const now = new Date();
    const dueOrders = await PharmacyOrder.find({
        status: { $in: ["out_for_delivery", "pickup_in_progress"] },
        autoCompleteAt: { $lte: now },
    });

    for (const order of dueOrders) {
        order.status = "completed";
        order.completedAt = now;
        await order.save();

        const title = order.fulfillmentMethod === "delivery" ? "Order Delivered" : "Order Picked Up";
        const body = order.fulfillmentMethod === "delivery"
            ? `Your pharmacy order ${order.referenceNumber} has been marked delivered.`
            : `Your pharmacy order ${order.referenceNumber} has been marked picked up.`;
        notify(order.patientId, "pharmacy_order_completed", title, body);
        notify(order.pharmacyId, "pharmacy_order_completed", title, `Order ${order.referenceNumber} is now complete.`);
    }
};

export const getPharmacyOrderDashboard = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    await completeDuePharmacyOrders();

    const pharmacyId = req.user._id;
    const recentCompletedCutoff = new Date(Date.now() - RECENT_COMPLETED_DAYS * 24 * 60 * 60 * 1000);

    const [prescriptionReviews, rejectedPrescriptionReviews, activeOrders, recentCompleted, history] = await Promise.all([
        populateOrder(PharmacyOrder.find({
            pharmacyId,
            status: "prescription_review",
            paymentStatus: "pending",
        }).sort({ createdAt: 1 })),
        populateOrder(PharmacyOrder.find({
            pharmacyId,
            status: "prescription_rejected",
        }).sort({ prescriptionReviewedAt: -1 }).limit(20)),
        populateOrder(PharmacyOrder.find({
            pharmacyId,
            paymentStatus: "paid",
            status: { $in: ACTIVE_STATUSES },
        }).sort({ createdAt: 1 })),
        populateOrder(PharmacyOrder.find({
            pharmacyId,
            status: "completed",
            completedAt: { $gte: recentCompletedCutoff },
        }).sort({ completedAt: -1 })),
        populateOrder(PharmacyOrder.find({
            pharmacyId,
            status: { $in: ["completed", "cancelled"] },
        }).sort({ createdAt: -1 }).limit(100)),
    ]);

    const orderList = activeOrders.filter((order) => order.status === "paid");
    const shipping = activeOrders.filter((order) => [
        "ready_for_shipping",
        "ready_for_pickup",
        "out_for_delivery",
        "pickup_in_progress",
    ].includes(order.status));

    sendSuccess(res, 200, "Pharmacy orders retrieved", {
        prescriptionReviews: prescriptionReviews.map(normalizeOrder),
        rejectedPrescriptionReviews: rejectedPrescriptionReviews.map(normalizeOrder),
        orderList: orderList.map(normalizeOrder),
        shipping: shipping.map(normalizeOrder),
        completedRecent: recentCompleted.map(normalizeOrder),
        history: history.map(normalizeOrder),
    });
});

export const createPaidPharmacyOrder = asyncHandler(async (req, res) => {
    if (!ensurePatient(req, res)) return;

    const clientRequestId = req.body.clientRequestId;
    if (await sendExistingClientOrder({
        req,
        res,
        clientRequestId,
        message: "Pharmacy order already paid",
    })) return;

    try {
        const order = await buildOrderFromCart({
            user: req.user,
            items: req.body.items,
            fulfillmentMethod: req.body.fulfillmentMethod,
            pickupTime: req.body.pickupTime,
            deliveryAddress: req.body.deliveryAddress || formatAddress(req.user.address),
            paymentStatus: "paid",
            status: "paid",
            clientRequestId,
            referencePrefix: "PH-PAY",
            allowPrescriptionItems: false,
        });
        await reduceStockForOrder(order);
        notify(order.pharmacyId, "pharmacy_order_paid", "New Paid Pharmacy Order", `Order ${order.referenceNumber} is ready for preparation.`);
        notify(order.patientId, "pharmacy_order_paid", "Pharmacy Payment Confirmed", `Your pharmacy payment of PHP ${order.totalAmount.toFixed(2)} was received. Reference: ${order.referenceNumber}`);
        sendSuccess(res, 201, "Pharmacy order paid", { order: normalizeOrder(order) });
    } catch (error) {
        if (error.code === 11000 && clientRequestId && await sendExistingClientOrder({
            req,
            res,
            clientRequestId,
            message: "Pharmacy order already paid",
        })) return;

        sendError(res, 400, error.message);
    }
});

export const submitPrescriptionReviewOrder = asyncHandler(async (req, res) => {
    if (!ensurePatient(req, res)) return;

    if (!req.body.prescriptionImage?.key) {
        return sendError(res, 400, "Prescription image is required.");
    }

    const clientRequestId = req.body.clientRequestId;
    if (await sendExistingClientOrder({
        req,
        res,
        clientRequestId,
        message: "Prescription already submitted for review",
    })) return;

    try {
        const order = await buildOrderFromCart({
            user: req.user,
            items: req.body.items,
            fulfillmentMethod: req.body.fulfillmentMethod,
            pickupTime: req.body.pickupTime,
            deliveryAddress: req.body.deliveryAddress || formatAddress(req.user.address),
            paymentStatus: "pending",
            status: "prescription_review",
            prescriptionImage: req.body.prescriptionImage,
            clientRequestId,
            referencePrefix: "PH-RX",
            allowPrescriptionItems: true,
            requirePrescriptionItems: true,
        });
        notify(order.pharmacyId, "pharmacy_prescription_review", "Prescription Review Needed", `Order ${order.referenceNumber} needs prescription review.`);
        sendSuccess(res, 201, "Prescription submitted for review", { order: normalizeOrder(order) });
    } catch (error) {
        if (error.code === 11000 && clientRequestId && await sendExistingClientOrder({
            req,
            res,
            clientRequestId,
            message: "Prescription already submitted for review",
        })) return;

        sendError(res, 400, error.message);
    }
});

export const approvePrescriptionOrder = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const order = await PharmacyOrder.findOne({
        _id: req.params.orderId,
        pharmacyId: req.user._id,
        status: "prescription_review",
    });
    if (!order) return sendError(res, 404, "Prescription review order not found.");

    order.status = "prescription_approved";
    order.prescriptionReviewedAt = new Date();
    order.prescriptionReviewedBy = req.user._id;
    await order.save();

    notify(order.patientId, "pharmacy_prescription_approved", "Prescription Approved", `Your pharmacy order ${order.referenceNumber} was approved. You may now proceed to payment.`);

    const populated = await populateOrder(PharmacyOrder.findById(order._id));
    sendSuccess(res, 200, "Prescription approved", { order: normalizeOrder(populated) });
});

export const rejectPrescriptionOrder = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const order = await PharmacyOrder.findOne({
        _id: req.params.orderId,
        pharmacyId: req.user._id,
        status: "prescription_review",
    });
    if (!order) return sendError(res, 404, "Prescription review order not found.");

    order.status = "prescription_rejected";
    order.prescriptionReviewedAt = new Date();
    order.prescriptionReviewedBy = req.user._id;
    const rejectionReason = req.body.reason;
    const rejectionNotes = req.body.notes || "";
    order.prescriptionRejectionReason = rejectionNotes
        ? `${rejectionReason} Notes: ${rejectionNotes}`
        : rejectionReason;
    await order.save();

    notify(
        order.patientId,
        "pharmacy_prescription_rejected",
        "Prescription Rejected",
        `Your pharmacy order ${order.referenceNumber} was rejected. Open this notification to view the reason.`,
        {
            orderId: order._id,
            referenceNumber: order.referenceNumber,
            reason: rejectionReason,
            notes: rejectionNotes,
            items: order.items.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                overTheCounter: item.overTheCounter,
            })),
        }
    );

    const populated = await populateOrder(PharmacyOrder.findById(order._id));
    sendSuccess(res, 200, "Prescription rejected", { order: normalizeOrder(populated) });
});

export const getMyPharmacyOrders = asyncHandler(async (req, res) => {
    if (!ensurePatient(req, res)) return;

    const orders = await PharmacyOrder.find({ patientId: req.user._id })
        .populate("pharmacyId", "pharmacyName")
        .sort({ createdAt: -1 })
        .limit(50);

    sendSuccess(res, 200, "Your pharmacy orders retrieved", { orders });
});

export const payApprovedPrescriptionOrder = asyncHandler(async (req, res) => {
    if (!ensurePatient(req, res)) return;

    const order = await PharmacyOrder.findOne({
        _id: req.params.orderId,
        patientId: req.user._id,
    });
    if (!order) return sendError(res, 404, "Approved prescription order not found.");

    if (order.paymentStatus === "paid") {
        return sendSuccess(res, 200, "Prescription order already paid", { order: normalizeOrder(order) });
    }

    if (order.status !== "prescription_approved" || order.paymentStatus !== "pending") {
        return sendError(res, 400, "Prescription order is not ready for payment.");
    }

    for (const item of order.items) {
        const product = await PharmacyProduct.findById(item.productId);
        if (!product || product.stock < item.quantity) {
            return sendError(res, 400, `${item.name} is no longer available in the requested quantity.`);
        }
    }

    const paidOrder = await PharmacyOrder.findOneAndUpdate(
        {
            _id: req.params.orderId,
            patientId: req.user._id,
            status: "prescription_approved",
            paymentStatus: "pending",
        },
        {
            status: "paid",
            paymentStatus: "paid",
            referenceNumber: generateReference("PH-PAY"),
            paidAt: new Date(),
        },
        { new: true }
    );

    if (!paidOrder) {
        const existingPaidOrder = await PharmacyOrder.findOne({
            _id: req.params.orderId,
            patientId: req.user._id,
            paymentStatus: "paid",
        });
        if (existingPaidOrder) {
            return sendSuccess(res, 200, "Prescription order already paid", { order: normalizeOrder(existingPaidOrder) });
        }
        return sendError(res, 400, "Prescription order is not ready for payment.");
    }

    await reduceStockForOrder(paidOrder);

    notify(paidOrder.pharmacyId, "pharmacy_order_paid", "Prescription Order Paid", `Order ${paidOrder.referenceNumber} is ready for preparation.`);
    notify(paidOrder.patientId, "pharmacy_order_paid", "Pharmacy Payment Confirmed", `Your approved prescription payment of PHP ${paidOrder.totalAmount.toFixed(2)} was received. Reference: ${paidOrder.referenceNumber}`);

    sendSuccess(res, 200, "Prescription order paid", { order: normalizeOrder(paidOrder) });
});

export const markPharmacyOrderReady = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const order = await PharmacyOrder.findOne({
        _id: req.params.orderId,
        pharmacyId: req.user._id,
        paymentStatus: "paid",
    });

    if (!order) return sendError(res, 404, "Order not found.");
    if (order.status !== "paid") {
        return sendError(res, 400, "Only paid intake orders can be marked ready.");
    }

    order.status = order.fulfillmentMethod === "delivery" ? "ready_for_shipping" : "ready_for_pickup";
    order.readyAt = new Date();
    await order.save();

    const title = order.fulfillmentMethod === "delivery" ? "Order Ready For Shipping" : "Order Ready For Pickup";
    const body = order.fulfillmentMethod === "delivery"
        ? `Your pharmacy order ${order.referenceNumber} is ready for shipping.`
        : `Your pharmacy order ${order.referenceNumber} is ready for pickup.`;
    notify(order.patientId, "pharmacy_order_ready", title, body);

    const populated = await populateOrder(PharmacyOrder.findById(order._id));
    sendSuccess(res, 200, "Order marked ready", { order: normalizeOrder(populated) });
});

export const startPharmacyOrderFulfillment = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const order = await PharmacyOrder.findOne({
        _id: req.params.orderId,
        pharmacyId: req.user._id,
        paymentStatus: "paid",
    });

    if (!order) return sendError(res, 404, "Order not found.");

    const expectedStatus = order.fulfillmentMethod === "delivery" ? "ready_for_shipping" : "ready_for_pickup";
    if (order.status !== expectedStatus) {
        return sendError(res, 400, "Order is not ready for this action.");
    }

    const now = new Date();
    order.status = order.fulfillmentMethod === "delivery" ? "out_for_delivery" : "pickup_in_progress";
    order.fulfillmentStartedAt = now;
    order.autoCompleteAt = new Date(now.getTime() + AUTO_COMPLETE_MINUTES * 60 * 1000);
    await order.save();

    const title = order.fulfillmentMethod === "delivery" ? "Order Out For Delivery" : "Pickup In Progress";
    const body = order.fulfillmentMethod === "delivery"
        ? `Your pharmacy order ${order.referenceNumber} is now out for delivery.`
        : `Your pharmacy order ${order.referenceNumber} is being released for pickup.`;
    notify(order.patientId, "pharmacy_order_in_progress", title, body);

    const populated = await populateOrder(PharmacyOrder.findById(order._id));
    sendSuccess(res, 200, "Order fulfillment started", { order: normalizeOrder(populated) });
});

export const getPharmacyIncome = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const now = dayjs().tz(PH_TZ);
    const year = Number(req.query.year || now.year());
    const month = Number(req.query.month || now.month() + 1);
    const start = dayjs.tz(`${year}-${String(month).padStart(2, "0")}-01`, PH_TZ).startOf("month");
    const end = start.add(1, "month");

    const [orders, manualTransactions] = await Promise.all([
        populateOrder(PharmacyOrder.find({
        pharmacyId: req.user._id,
        ...orderPaymentDateFilter(start.toDate(), end.toDate()),
        }).sort({ paidAt: -1, createdAt: -1 })),
        PharmacyManualTransaction.find({
            pharmacyId: req.user._id,
            transactionDate: { $gte: start.toDate(), $lt: end.toDate() },
        }).sort({ transactionDate: -1 }),
    ]);

    const totals = orders.reduce((acc, order) => {
        acc.grossSales += order.totalAmount || 0;
        acc.productSales += order.subtotal || 0;
        acc.deliveryFees += order.deliveryFee || 0;
        acc.platformFees += order.platformFee || 0;
        acc.orderCount += 1;
        acc.itemCount += (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
        if (order.status === "completed") acc.completedSales += order.totalAmount || 0;
        if (ACTIVE_STATUSES.includes(order.status)) acc.activeSales += order.totalAmount || 0;
        return acc;
    }, {
        grossSales: 0,
        productSales: 0,
        deliveryFees: 0,
        platformFees: 0,
        completedSales: 0,
        activeSales: 0,
        orderCount: 0,
        itemCount: 0,
    });

    for (const transaction of manualTransactions) {
        totals.grossSales += transaction.amount || 0;
        totals.manualSales = (totals.manualSales || 0) + (transaction.amount || 0);
        totals.orderCount += 1;
    }

    totals.averageOrderValue = totals.orderCount ? totals.grossSales / totals.orderCount : 0;

    const availableYears = await PharmacyOrder.distinct("paidAt", {
        pharmacyId: req.user._id,
        paymentStatus: "paid",
        paidAt: { $ne: null },
    });

    const years = [...new Set([
        now.year(),
        ...availableYears.map((date) => dayjs(date).tz(PH_TZ).year()),
    ])].sort((a, b) => b - a);

    sendSuccess(res, 200, "Pharmacy income retrieved", {
        selected: { year, month },
        years,
        totals,
        orders: orders.map(normalizeOrder),
        manualTransactions,
    });
});

export const createManualPharmacyTransaction = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const transaction = await PharmacyManualTransaction.create({
        pharmacyId: req.user._id,
        transactionDate: req.body.transactionDate,
        customerName: req.body.customerName || "Walk-in customer",
        itemSummary: req.body.itemSummary,
        amount: req.body.amount,
        paymentMethod: req.body.paymentMethod || "cash",
        note: req.body.note || "",
        referenceNumber: generateReference("PH-MAN"),
    });

    sendSuccess(res, 201, "Manual transaction added", { transaction });
});
