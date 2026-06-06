import express from "express";
import {
    approvePrescriptionOrder,
    createManualPharmacyTransaction,
    createPaidPharmacyOrder,
    getMyPharmacyOrders,
    getPharmacyIncome,
    getPharmacyOrderDashboard,
    markPharmacyOrderReady,
    payApprovedPrescriptionOrder,
    rejectPrescriptionOrder,
    submitPrescriptionReviewOrder,
    startPharmacyOrderFulfillment,
} from "../controllers/pharmacyOrder.controller.js";
import {
    createPharmacyProduct,
    deletePharmacyProduct,
    listMyPharmacyProducts,
    listPublicPharmacyProducts,
    updatePharmacyProduct,
} from "../controllers/pharmacyProduct.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    createPaidPharmacyOrderValidator,
    createManualPharmacyTransactionValidator,
    pharmacyOrderIdValidator,
    pharmacyIncomeQueryValidator,
    rejectPrescriptionOrderValidator,
    submitPrescriptionReviewOrderValidator,
} from "../validators/pharmacyOrder.validator.js";
import {
    createPharmacyProductValidator,
    pharmacyProductIdValidator,
    productQueryValidator,
    updatePharmacyProductValidator,
} from "../validators/pharmacyProduct.validator.js";

const router = express.Router();

router.get("/products", protectRoute, productQueryValidator, validate, listPublicPharmacyProducts);
router.get("/products/mine", protectRoute, listMyPharmacyProducts);
router.post("/products", protectRoute, createPharmacyProductValidator, validate, createPharmacyProduct);
router.patch("/products/:productId", protectRoute, updatePharmacyProductValidator, validate, updatePharmacyProduct);
router.delete("/products/:productId", protectRoute, pharmacyProductIdValidator, validate, deletePharmacyProduct);

router.get("/orders/dashboard", protectRoute, getPharmacyOrderDashboard);
router.get("/income", protectRoute, pharmacyIncomeQueryValidator, validate, getPharmacyIncome);
router.post("/income/manual", protectRoute, createManualPharmacyTransactionValidator, validate, createManualPharmacyTransaction);
router.get("/orders/my", protectRoute, getMyPharmacyOrders);
router.post("/orders/pay-now", protectRoute, createPaidPharmacyOrderValidator, validate, createPaidPharmacyOrder);
router.post("/orders/prescription-review", protectRoute, submitPrescriptionReviewOrderValidator, validate, submitPrescriptionReviewOrder);
router.patch("/orders/:orderId/pay-approved", protectRoute, pharmacyOrderIdValidator, validate, payApprovedPrescriptionOrder);
router.patch("/orders/:orderId/prescription/approve", protectRoute, pharmacyOrderIdValidator, validate, approvePrescriptionOrder);
router.patch("/orders/:orderId/prescription/reject", protectRoute, rejectPrescriptionOrderValidator, validate, rejectPrescriptionOrder);
router.patch("/orders/:orderId/ready", protectRoute, pharmacyOrderIdValidator, validate, markPharmacyOrderReady);
router.patch("/orders/:orderId/start-fulfillment", protectRoute, pharmacyOrderIdValidator, validate, startPharmacyOrderFulfillment);

export default router;
