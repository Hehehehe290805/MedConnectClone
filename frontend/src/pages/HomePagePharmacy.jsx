import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircleIcon,
    ClockIcon,
    PackageCheckIcon,
    PackageIcon,
    PackageOpenIcon,
    ShieldCheckIcon,
    ShieldXIcon,
    RefreshCwIcon,
    ShoppingBagIcon,
    TruckIcon,
    XIcon,
} from "lucide-react";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import ImagePreviewModal from "../components/ImagePreviewModal";
import {
    approvePrescriptionOrder,
    getPharmacyOrderDashboard,
    markPharmacyOrderReady,
    rejectPrescriptionOrder,
    startPharmacyOrderFulfillment,
} from "../lib/api";

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = "Asia/Manila";

const methodConfig = {
    delivery: {
        label: "Delivery",
        icon: TruckIcon,
        readyLabel: "Ready for shipping",
        startLabel: "Start shipping",
    },
    pickup: {
        label: "Pickup",
        icon: ShoppingBagIcon,
        readyLabel: "Ready for pickup",
        startLabel: "Release pickup",
    },
};

const statusConfig = {
    paid: { label: "Paid" },
    ready_for_shipping: { label: "Ready for shipping" },
    ready_for_pickup: { label: "Ready for pickup" },
    out_for_delivery: { label: "Out for delivery" },
    pickup_in_progress: { label: "Pickup in progress" },
    completed: { label: "Completed" },
    cancelled: { label: "Cancelled" },
};

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const formatDateTime = (value) => value ? dayjs(value).tz(PH_TZ).format("MMM D, YYYY h:mm A") : "Not set";

const rejectionReasons = [
    "Prescription image is unclear",
    "Medicine does not match prescription",
    "Prescription is expired",
    "Missing patient or prescriber details",
    "Invalid or incomplete prescription",
    "Other",
];

const EmptyState = ({ icon: Icon, title, description }) => (
    <div className="text-center py-14 opacity-50">
        <Icon className="size-12 mx-auto mb-3" />
        <p className="text-lg font-medium">{title}</p>
        <p className="text-sm">{description}</p>
    </div>
);

const OrderItems = ({ items }) => (
    <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="flex items-center gap-2 bg-base-100 rounded-lg px-2 py-1">
                {item.image?.url ? (
                    <img src={item.image.url} alt={item.name} className="size-8 rounded object-cover" />
                ) : (
                    <div className="size-8 rounded bg-base-300 flex items-center justify-center">
                        <PackageIcon className="size-4 opacity-60" />
                    </div>
                )}
                <div className="text-xs">
                    <p className="font-medium">{item.name}</p>
                    <p className="opacity-60">x{item.quantity} - {currency(item.unitPrice)}</p>
                </div>
            </div>
        ))}
    </div>
);

const SimpleOrderForm = ({ order }) => {
    const prescriptionItems = (order.items || []).filter((item) => !item.overTheCounter);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-base-200 rounded-lg p-3">
                    <p className="opacity-60">Customer</p>
                    <p className="font-semibold">{order.customerName}</p>
                </div>
                <div className="bg-base-200 rounded-lg p-3">
                    <p className="opacity-60">Reference</p>
                    <p className="font-mono font-semibold">{order.referenceNumber}</p>
                </div>
                <div className="bg-base-200 rounded-lg p-3">
                    <p className="opacity-60">Fulfillment</p>
                    <p className="font-semibold capitalize">{order.fulfillmentMethod}</p>
                </div>
                <div className="bg-base-200 rounded-lg p-3">
                    <p className="opacity-60">Total</p>
                    <p className="font-semibold">{currency(order.totalAmount)}</p>
                </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Medicine requiring prescription</p>
                <OrderItems items={prescriptionItems} />
            </div>
            {order.prescriptionImage?.key && (
                <ImagePreviewModal s3Key={order.prescriptionImage.key} label="View Prescription" />
            )}
        </div>
    );
};

const OrderCard = ({ order, actionLabel, actionIcon: ActionIcon, onAction, isActionLoading }) => {
    const method = methodConfig[order.fulfillmentMethod] ?? methodConfig.pickup;
    const MethodIcon = method.icon;
    const status = statusConfig[order.status] ?? { label: order.status?.replace(/_/g, " ") };

    return (
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
            <div className="card-body gap-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-base-200 px-3 py-1 text-xs font-semibold text-primary">
                                <MethodIcon className="size-3" />
                                {method.label}
                            </span>
                            <span className="rounded-lg bg-base-200 px-3 py-1 text-xs font-semibold capitalize text-primary">{status.label}</span>
                            <span className="rounded-lg bg-base-200 px-3 py-1 font-mono text-xs">{order.referenceNumber}</span>
                        </div>
                        <div>
                            <p className="font-semibold">{order.customerName}</p>
                            <p className="text-sm opacity-60">Paid {formatDateTime(order.createdAt)}</p>
                        </div>
                    </div>

                    <div className="text-left lg:text-right">
                        <p className="text-sm opacity-60">Total</p>
                        <p className="text-xl font-bold">{currency(order.totalAmount)}</p>
                    </div>
                </div>

                <OrderItems items={order.items ?? []} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {order.fulfillmentMethod === "delivery" ? (
                        <div className="bg-base-100 rounded-lg p-3">
                            <p className="opacity-60">Delivery address</p>
                            <p className="font-medium">{order.deliveryAddress || "No address recorded"}</p>
                        </div>
                    ) : (
                        <div className="bg-base-100 rounded-lg p-3">
                            <p className="opacity-60">Pickup time</p>
                            <p className="font-medium">{formatDateTime(order.pickupTime)}</p>
                        </div>
                    )}
                    {order.autoCompleteAt && (
                        <div className="bg-base-100 rounded-lg p-3">
                            <p className="opacity-60">Mock completion</p>
                            <p className="font-medium">{formatDateTime(order.autoCompleteAt)}</p>
                        </div>
                    )}
                </div>

                {actionLabel && (
                    <div className="card-actions justify-end">
                        <button className="btn btn-primary btn-sm gap-2" onClick={() => onAction(order._id)} disabled={isActionLoading}>
                            {isActionLoading ? <span className="loading loading-spinner loading-xs" /> : <ActionIcon className="size-4" />}
                            {actionLabel}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const OrderSection = ({ title, description, icon: Icon, orders, emptyTitle, emptyDescription, renderAction }) => (
    <section className="space-y-3">
        <div className="flex items-center gap-2">
            <Icon className="size-5 text-primary" />
            <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm opacity-60">{description}</p>
            </div>
        </div>

        {orders.length === 0 ? (
            <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
        ) : (
            <div className="space-y-3">
                {orders.map((order) => (
                    <OrderCard key={order._id} order={order} {...renderAction(order)} />
                ))}
            </div>
        )}
    </section>
);

const PrescriptionReviewModal = ({ isOpen, onClose, orders, onApprove, onRejectClick, isApproving, isRejecting }) => {
    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-4xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Pending Prescription Review</h2>
                        <p className="text-sm opacity-60">Review prescription images before customers can proceed to payment.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {orders.length === 0 ? (
                    <div className="alert bg-base-200">
                        <ShieldCheckIcon className="size-5 opacity-50" />
                        <span className="text-sm opacity-70">No prescription orders are waiting for review.</span>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {orders.map((order) => {
                            return (
                                <div key={order._id} className="card bg-warning/10 border border-warning/30">
                                    <div className="card-body gap-4">
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    <span className="rounded-lg bg-base-200 px-3 py-1 text-xs font-semibold text-primary">On hold</span>
                                                    <span className="rounded-lg bg-base-200 px-3 py-1 font-mono text-xs">{order.referenceNumber}</span>
                                                </div>
                                                <p className="font-semibold">{order.customerName}</p>
                                                <p className="text-sm opacity-70">Needs review before payment</p>
                                            </div>
                                            <p className="font-bold">{currency(order.totalAmount)}</p>
                                        </div>

                                        <SimpleOrderForm order={order} />

                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <span className="text-sm opacity-60">Approve only when the prescription matches the order.</span>
                                            <div className="flex gap-2">
                                                <button className="btn btn-error btn-sm gap-2" onClick={() => onRejectClick(order)} disabled={isRejecting}>
                                                    <ShieldXIcon className="size-4" />
                                                    Reject
                                                </button>
                                                <button className="btn btn-primary btn-sm gap-2" onClick={() => onApprove(order._id)} disabled={isApproving}>
                                                    <ShieldCheckIcon className="size-4" />
                                                    Accept
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const RejectionFormModal = ({ order, onClose, onSubmit, isSubmitting }) => {
    const [reason, setReason] = useState(rejectionReasons[0]);
    const [otherReason, setOtherReason] = useState("");
    const [notes, setNotes] = useState("");

    if (!order) return null;

    const finalReason = reason === "Other" ? otherReason.trim() : reason;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Reject Prescription Request</h2>
                        <p className="text-sm opacity-60">Confirm the order details before sending the rejection reason to the customer.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <SimpleOrderForm order={order} />

                <div className="divider" />
                <div className="space-y-3">
                    <label className="form-control">
                        <span className="label-text font-medium">Reason</span>
                        <select className="select select-bordered" value={reason} onChange={(e) => setReason(e.target.value)}>
                            {rejectionReasons.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </label>
                    {reason === "Other" && (
                        <input className="input input-bordered" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Enter rejection reason" />
                    )}
                    <label className="form-control">
                        <span className="label-text font-medium">Extra notes</span>
                        <textarea className="textarea textarea-bordered min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the customer" />
                    </label>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-error"
                        disabled={isSubmitting || !finalReason}
                        onClick={() => onSubmit({ orderId: order._id, reason: finalReason, notes })}
                    >
                        {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : <ShieldXIcon className="size-4" />}
                        Reject Request
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const RejectedPrescriptionsModal = ({ isOpen, onClose, orders }) => {
    const [selectedOrder, setSelectedOrder] = useState(null);

    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-4xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Rejected Prescription Requests</h2>
                        <p className="text-sm opacity-60">Click a rejected request to view its order form.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {selectedOrder ? (
                    <div className="space-y-4">
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>Back to rejected list</button>
                        <SimpleOrderForm order={selectedOrder} />
                        <div className="alert bg-error/10 border border-error/20">
                            <ShieldXIcon className="size-5 text-error" />
                            <div>
                                <p className="font-semibold">Rejected reason</p>
                                <p className="text-sm opacity-80">{selectedOrder.prescriptionRejectionReason || "No reason recorded."}</p>
                            </div>
                        </div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="alert bg-base-200">
                        <ShieldCheckIcon className="size-5 opacity-50" />
                        <span className="text-sm opacity-70">No rejected prescription requests yet.</span>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {orders.map((order) => (
                            <button
                                key={order._id}
                                className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg bg-base-200 p-3 text-left hover:bg-base-300"
                                onClick={() => setSelectedOrder(order)}
                            >
                                <div>
                                    <p className="font-semibold">{order.customerName}</p>
                                    <p className="text-sm opacity-60 font-mono">{order.referenceNumber}</p>
                                </div>
                                <span className="text-sm font-semibold text-primary">Rejected</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const HomePagePharmacy = () => {
    const { authUser } = useAuthUser();
    const queryClient = useQueryClient();
    const isPending = authUser?.status === "pending";
    const [tab, setTab] = useState("orders");
    const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
    const [rejectedModalOpen, setRejectedModalOpen] = useState(false);
    const [rejectingOrder, setRejectingOrder] = useState(null);

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["pharmacy-orders-dashboard"],
        queryFn: getPharmacyOrderDashboard,
        refetchInterval: 60 * 1000,
    });

    const dashboard = data?.data ?? {};
    const prescriptionReviews = dashboard.prescriptionReviews ?? [];
    const rejectedPrescriptionReviews = dashboard.rejectedPrescriptionReviews ?? [];
    const orderList = dashboard.orderList ?? [];
    const shipping = dashboard.shipping ?? [];
    const completedRecent = dashboard.completedRecent ?? [];
    const history = dashboard.history ?? [];

    const readyMutation = useMutation({
        mutationFn: markPharmacyOrderReady,
        onSuccess: () => {
            toast.success("Order moved to shipping and pickup queue");
            queryClient.invalidateQueries({ queryKey: ["pharmacy-orders-dashboard"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not update order"),
    });

    const startMutation = useMutation({
        mutationFn: startPharmacyOrderFulfillment,
        onSuccess: () => {
            toast.success("Order fulfillment started");
            queryClient.invalidateQueries({ queryKey: ["pharmacy-orders-dashboard"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not start fulfillment"),
    });

    const approveMutation = useMutation({
        mutationFn: approvePrescriptionOrder,
        onSuccess: () => {
            toast.success("Prescription accepted");
            queryClient.invalidateQueries({ queryKey: ["pharmacy-orders-dashboard"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not accept prescription"),
    });

    const rejectMutation = useMutation({
        mutationFn: rejectPrescriptionOrder,
        onSuccess: () => {
            toast.success("Prescription rejected");
            setRejectingOrder(null);
            queryClient.invalidateQueries({ queryKey: ["pharmacy-orders-dashboard"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not reject prescription"),
    });

    return (
        <div className="p-8 space-y-6">
            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your account is pending approval</p>
                        <p className="text-sm opacity-70">Our team is reviewing your information.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h1 className="text-3xl font-bold">Pharmacy</h1>
                <button className="btn btn-ghost btn-sm gap-2" onClick={() => refetch()} disabled={isFetching}>
                    {isFetching ? <span className="loading loading-spinner loading-xs" /> : <RefreshCwIcon className="size-4" />}
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title">Paid Orders</div>
                    <div className="stat-value text-2xl">{orderList.length}</div>
                    <div className="stat-desc">Waiting for pharmacy prep</div>
                </div>
                <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title">Shipping / Pickup</div>
                    <div className="stat-value text-2xl">{shipping.length}</div>
                    <div className="stat-desc">Ready or in progress</div>
                </div>
                <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title">Completed This Week</div>
                    <div className="stat-value text-2xl">{completedRecent.length}</div>
                    <div className="stat-desc">Last 7 days</div>
                </div>
            </div>

            {!isLoading && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                            className="btn btn-warning btn-outline w-full min-h-14 h-auto justify-between px-5"
                            onClick={() => setPrescriptionModalOpen(true)}
                        >
                            <span className="flex items-center gap-2">
                                <ShieldCheckIcon className="size-5" />
                                Prescription Reviews
                            </span>
                            <span className="font-semibold text-primary">{prescriptionReviews.length} pending</span>
                        </button>
                        <button
                            className="btn btn-error btn-outline w-full min-h-14 h-auto justify-between px-5"
                            onClick={() => setRejectedModalOpen(true)}
                        >
                            <span className="flex items-center gap-2">
                                <ShieldXIcon className="size-5" />
                                Rejected Prescription Requests
                            </span>
                            <span className="font-semibold text-primary">{rejectedPrescriptionReviews.length} rejected</span>
                        </button>
                    </div>
                    <PrescriptionReviewModal
                        isOpen={prescriptionModalOpen}
                        onClose={() => setPrescriptionModalOpen(false)}
                        orders={prescriptionReviews}
                        onApprove={approveMutation.mutate}
                        onRejectClick={setRejectingOrder}
                        isApproving={approveMutation.isPending}
                        isRejecting={rejectMutation.isPending}
                    />
                    <RejectedPrescriptionsModal
                        isOpen={rejectedModalOpen}
                        onClose={() => setRejectedModalOpen(false)}
                        orders={rejectedPrescriptionReviews}
                    />
                    <RejectionFormModal
                        order={rejectingOrder}
                        onClose={() => setRejectingOrder(null)}
                        onSubmit={rejectMutation.mutate}
                        isSubmitting={rejectMutation.isPending}
                    />
                </>
            )}

            <div role="tablist" className="tabs tabs-bordered">
                <button role="tab" className={`tab gap-2 ${tab === "orders" ? "tab-active" : ""}`} onClick={() => setTab("orders")}>
                    <ShoppingBagIcon className="size-4" /> Order List
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "shipping" ? "tab-active" : ""}`} onClick={() => setTab("shipping")}>
                    <TruckIcon className="size-4" /> Shipping & Pickup
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "completed" ? "tab-active" : ""}`} onClick={() => setTab("completed")}>
                    <CheckCircleIcon className="size-4" /> Completed
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "history" ? "tab-active" : ""}`} onClick={() => setTab("history")}>
                    <ClockIcon className="size-4" /> Order History
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            ) : (
                <>
                    {tab === "orders" && (
                        <OrderSection
                            title="Order List"
                            description="Paid delivery and pickup orders waiting for pharmacy preparation."
                            icon={ShoppingBagIcon}
                            orders={orderList}
                            emptyTitle="No paid orders waiting"
                            emptyDescription="Paid customer orders will appear here first."
                            renderAction={(order) => ({
                                actionLabel: methodConfig[order.fulfillmentMethod]?.readyLabel || "Mark ready",
                                actionIcon: PackageCheckIcon,
                                onAction: readyMutation.mutate,
                                isActionLoading: readyMutation.isPending,
                            })}
                        />
                    )}

                    {tab === "shipping" && (
                        <OrderSection
                            title="Shipping & Pickup"
                            description="Prepared orders move here before mock delivery or pickup release."
                            icon={TruckIcon}
                            orders={shipping}
                            emptyTitle="No orders in shipping or pickup"
                            emptyDescription="Orders marked ready will move into this queue."
                            renderAction={(order) => {
                                const canStart = ["ready_for_shipping", "ready_for_pickup"].includes(order.status);
                                return canStart ? {
                                    actionLabel: methodConfig[order.fulfillmentMethod]?.startLabel || "Start fulfillment",
                                    actionIcon: order.fulfillmentMethod === "delivery" ? TruckIcon : PackageOpenIcon,
                                    onAction: startMutation.mutate,
                                    isActionLoading: startMutation.isPending,
                                } : {
                                    actionLabel: null,
                                };
                            }}
                        />
                    )}

                    {tab === "completed" && (
                        <OrderSection
                            title="Completed Orders"
                            description="A focused view of pharmacy orders completed in the last 7 days."
                            icon={CheckCircleIcon}
                            orders={completedRecent}
                            emptyTitle="No completed orders this week"
                            emptyDescription="Mock deliveries and pickups complete automatically after 10 minutes."
                            renderAction={() => ({ actionLabel: null })}
                        />
                    )}

                    {tab === "history" && (
                        <OrderSection
                            title="Order History"
                            description="Organized pharmacy-side history for completed and cancelled orders."
                            icon={ClockIcon}
                            orders={history}
                            emptyTitle="No order history yet"
                            emptyDescription="Completed and cancelled pharmacy orders will be listed here."
                            renderAction={() => ({ actionLabel: null })}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default HomePagePharmacy;
