import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeftIcon,
    CreditCardIcon,
    MinusIcon,
    PackageIcon,
    PlusIcon,
    SearchIcon,
    ShoppingCartIcon,
    Trash2Icon,
    UploadCloudIcon,
    XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import TermsOfServiceContent from "../components/TermsOfServiceContent";
import {
    createPaidPharmacyOrder,
    getMyPharmacyOrders,
    getPublicPharmacyProducts,
    payApprovedPrescriptionOrder,
    submitPrescriptionReviewOrder,
    updateProfile,
    uploadFile,
} from "../lib/api";

const DELIVERY_FEE = 75;

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const addressText = (address = {}) => [
    address.buildingNumber,
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
].filter(Boolean).join(", ");

const emptyAddress = {
    buildingNumber: "",
    street: "",
    barangay: "",
    city: "",
    province: "",
    postalCode: "",
};

const createCheckoutRequestId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const ProductImage = ({ product, className = "h-36 w-full" }) => (
    product.image?.url ? (
        <img src={product.image.url} alt={product.name} className={`${className} object-cover rounded-lg`} />
    ) : (
        <div className={`${className} bg-base-300 rounded-lg flex items-center justify-center`}>
            <PackageIcon className="size-10 opacity-50" />
        </div>
    )
);

const BackButton = ({ onClick, children }) => (
    <button onClick={onClick} className="flex items-center gap-2 text-primary font-semibold hover:underline">
        <ArrowLeftIcon className="w-5 h-5" />
        {children}
    </button>
);

const TermsModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Terms and Conditions</h2>
                        <p className="text-sm opacity-60">Last updated: June 2026</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>
                <div className="max-h-[65vh] overflow-y-auto pr-2">
                    <TermsOfServiceContent />
                </div>
                <div className="modal-action">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const CartLineDetails = ({ item }) => (
    <div className="text-sm opacity-70 space-y-0.5">
        <p>{item.product.quantityValue} {item.product.quantityUnit}</p>
        <p>Unit price: {currency(item.product.price)}</p>
        <p>Quantity: {item.quantity}</p>
        <p>{item.product.overTheCounter ? "No prescription required" : "Prescription required"}</p>
    </div>
);

const ProductDetailModal = ({ product, onClose, onAddToCart }) => {
    if (!product) return null;

    const pharmacyAddress = addressText(product.pharmacyId?.address);

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">{product.name}</h2>
                        <p className="text-sm opacity-60">{product.pharmacyId?.pharmacyName || "Pharmacy"}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                    <ProductImage product={product} className="w-full aspect-square" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Medicine name</p>
                            <p className="font-semibold">{product.name}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Price</p>
                            <p className="font-semibold">{currency(product.price)}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Amount</p>
                            <p className="font-semibold">{product.quantityValue} {product.quantityUnit}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Available stock</p>
                            <p className="font-semibold">{product.stock}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Prescription</p>
                            <p className="font-semibold">{product.overTheCounter ? "Not required" : "Required before payment"}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="opacity-60">Pharmacy</p>
                            <p className="font-semibold">{product.pharmacyId?.pharmacyName || "Pharmacy"}</p>
                        </div>
                        {pharmacyAddress && (
                            <div className="bg-base-200 rounded-lg p-3 sm:col-span-2">
                                <p className="opacity-60">Pharmacy address</p>
                                <p className="font-semibold">{pharmacyAddress}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Close</button>
                    <button className="btn btn-primary gap-2" onClick={() => onAddToCart(product)} disabled={product.stock <= 0}>
                        <ShoppingCartIcon className="size-4" />
                        Add to cart
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const CustomerPharmacyPage = () => {
    const { authUser } = useAuthUser();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [sort, setSort] = useState("newest");
    const [view, setView] = useState("shop");
    const [cart, setCart] = useState([]);
    const [fulfillmentMethod, setFulfillmentMethod] = useState("delivery");
    const [pickupTime, setPickupTime] = useState("");
    const [prescriptionFile, setPrescriptionFile] = useState(null);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [addressForm, setAddressForm] = useState(emptyAddress);
    const [isAddressEditing, setIsAddressEditing] = useState(false);
    const [checkoutRequestId, setCheckoutRequestId] = useState(createCheckoutRequestId);
    const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
    const [approvedPaymentOrder, setApprovedPaymentOrder] = useState(null);
    const [approvedTermsAccepted, setApprovedTermsAccepted] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [detailProduct, setDetailProduct] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ["public-pharmacy-products", submittedQuery, sort],
        queryFn: () => getPublicPharmacyProducts({ q: submittedQuery, sort }),
    });

    const { data: myOrdersData } = useQuery({
        queryKey: ["my-pharmacy-orders"],
        queryFn: getMyPharmacyOrders,
    });

    const products = data?.data?.products ?? [];
    const myOrders = myOrdersData?.data?.orders ?? [];
    const prescriptionOrders = myOrders.filter((order) => ["prescription_review", "prescription_approved"].includes(order.status));
    const suggestions = useMemo(() => products.map((product) => product.name).slice(0, 8), [products]);

    const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const hasPrescriptionItems = cart.some((item) => !item.product.overTheCounter);
    const deliveryFee = fulfillmentMethod === "delivery" ? DELIVERY_FEE : 0;
    const total = cartTotal + deliveryFee;
    const savedAddress = addressText(authUser?.address);
    const checkoutAddress = addressText(addressForm);

    useEffect(() => {
        setAddressForm({ ...emptyAddress, ...(authUser?.address || {}) });
    }, [authUser?._id]);

    const addToCart = (product) => {
        setCheckoutRequestId(createCheckoutRequestId());
        setCart((current) => {
            const existing = current.find((item) => item.product._id === product._id);
            if (existing) {
                return current.map((item) => item.product._id === product._id
                    ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
                    : item);
            }
            return [...current, { product, quantity: 1 }];
        });
        toast.success("Added to cart");
    };

    const updateQuantity = (productId, delta) => {
        setCheckoutRequestId(createCheckoutRequestId());
        setCart((current) => current
            .map((item) => item.product._id === productId
                ? { ...item, quantity: Math.max(1, Math.min(item.quantity + delta, item.product.stock)) }
                : item)
            .filter((item) => item.quantity > 0));
    };

    const removeItem = (productId) => {
        setCheckoutRequestId(createCheckoutRequestId());
        setCart((current) => current.filter((item) => item.product._id !== productId));
    };

    const resetCheckoutState = () => {
        setCart([]);
        setCheckoutRequestId(createCheckoutRequestId());
    };

    const checkoutPayload = () => ({
        clientRequestId: checkoutRequestId,
        items: cart.map((item) => ({
            productId: item.product._id,
            quantity: item.quantity,
        })),
        fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === "delivery" ? checkoutAddress : "",
        pickupTime: fulfillmentMethod === "pickup" ? pickupTime : undefined,
    });

    const paidOrderMutation = useMutation({
        mutationFn: createPaidPharmacyOrder,
        onSuccess: () => {
            toast.success("Payment confirmed. Order sent to pharmacy.");
            resetCheckoutState();
            setPaymentOpen(false);
            setPaymentTermsAccepted(false);
            setView("shop");
            queryClient.invalidateQueries({ queryKey: ["public-pharmacy-products"] });
            queryClient.invalidateQueries({ queryKey: ["my-pharmacy-orders"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not place order"),
    });

    const prescriptionMutation = useMutation({
        mutationFn: async () => {
            if (!prescriptionFile) throw new Error("Prescription image is required.");
            const uploaded = await uploadFile(prescriptionFile, "prescriptionImage");
            return submitPrescriptionReviewOrder({
                ...checkoutPayload(),
                prescriptionImage: uploaded.data,
            });
        },
        onSuccess: () => {
            toast.success("Prescription submitted for pharmacy review.");
            resetCheckoutState();
            setPrescriptionFile(null);
            setView("shop");
            queryClient.invalidateQueries({ queryKey: ["my-pharmacy-orders"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || error.message || "Could not submit prescription"),
    });

    const payApprovedMutation = useMutation({
        mutationFn: payApprovedPrescriptionOrder,
        onSuccess: () => {
            toast.success("Payment confirmed. Order sent to pharmacy.");
            setApprovedPaymentOrder(null);
            setApprovedTermsAccepted(false);
            queryClient.invalidateQueries({ queryKey: ["my-pharmacy-orders"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not pay approved order"),
    });

    const saveAddressMutation = useMutation({
        mutationFn: () => updateProfile({ address: addressForm }),
        onSuccess: () => {
            toast.success("Address saved");
            setIsAddressEditing(false);
            queryClient.invalidateQueries({ queryKey: ["authUser"] });
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not save address"),
    });

    const canCheckout = cart.length > 0
        && (fulfillmentMethod !== "delivery" || checkoutAddress)
        && (fulfillmentMethod !== "pickup" || pickupTime);

    const updateAddress = (field, value) => {
        setAddressForm((current) => ({ ...current, [field]: value }));
    };

    return (
        <div className="p-8 pb-28 space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Pharmacy</h1>
                <button className="btn btn-primary btn-sm gap-2" onClick={() => setView("cart")}>
                    <ShoppingCartIcon className="size-4" />
                    Cart
                    {cartCount > 0 && <span className="badge badge-sm">{cartCount}</span>}
                </button>
            </div>

            {view === "shop" && (
                <>
                    {prescriptionOrders.length > 0 && (
                        <div className="space-y-3">
                            {prescriptionOrders.map((order) => (
                                <div key={order._id} className="alert bg-base-200 min-h-[72px]">
                                    <PackageIcon className="size-5" />
                                    <div className="flex-1">
                                        <p className="font-semibold">{order.referenceNumber}</p>
                                        <p className="text-sm opacity-70">
                                            {order.status === "prescription_review" && "Prescription review pending"}
                                            {order.status === "prescription_approved" && "Prescription approved. Payment is ready."}
                                            {order.status === "prescription_rejected" && "Prescription rejected"}
                                        </p>
                                    </div>
                                    {order.status === "prescription_approved" && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setApprovedPaymentOrder(order)} disabled={payApprovedMutation.isPending}>
                                            Pay {currency(order.totalAmount)}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="relative flex-1">
                            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                            <input
                                className="input input-bordered w-full pl-9"
                                value={query}
                                list="pharmacy-product-suggestions"
                                placeholder="Search medicine"
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            <datalist id="pharmacy-product-suggestions">
                                {suggestions.map((name) => <option key={name} value={name} />)}
                            </datalist>
                        </div>
                        <select className="select select-bordered lg:w-56" value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="newest">Newest</option>
                            <option value="price_asc">Cheapest first</option>
                            <option value="price_desc">Most expensive first</option>
                        </select>
                        <button className="btn btn-primary gap-2" onClick={() => setSubmittedQuery(query)}>
                            <SearchIcon className="size-4" />
                            Search
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <span className="loading loading-spinner loading-lg text-primary" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="text-center py-16 opacity-40">
                            <PackageIcon className="size-12 mx-auto mb-3" />
                            <p className="text-lg font-medium">No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            {products.map((product) => (
                                <div
                                    key={product._id}
                                    className="card bg-base-200 shadow-sm h-[360px] cursor-pointer transition-shadow hover:shadow-md"
                                    onClick={() => setDetailProduct(product)}
                                >
                                    <div className="card-body h-full">
                                        <ProductImage product={product} />
                                        <div className="min-h-[76px]">
                                            <h2 className="font-semibold line-clamp-2 min-h-[48px]">{product.name}</h2>
                                            <p className="text-sm opacity-60">{product.quantityValue} {product.quantityUnit}</p>
                                            <p className="text-sm opacity-60 truncate">{product.pharmacyId?.pharmacyName || "Pharmacy"}</p>
                                        </div>
                                        <div className="flex items-center justify-between min-h-[28px]">
                                            <p className="font-bold">{currency(product.price)}</p>
                                            <span className={`badge ${product.overTheCounter ? "badge-success" : "badge-warning"}`}>
                                                {product.overTheCounter ? "OTC" : "Prescription"}
                                            </span>
                                        </div>
                                        <button className="btn btn-primary btn-sm gap-2 mt-auto" onClick={(e) => {
                                            e.stopPropagation();
                                            addToCart(product);
                                        }} disabled={product.stock <= 0}>
                                            <ShoppingCartIcon className="size-4" />
                                            Add to cart
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {view === "cart" && (
                <div className="space-y-4">
                    <BackButton onClick={() => setView("shop")}>Back to Pharmacy</BackButton>
                    {cart.map((item) => (
                        <div key={item.product._id} className="card bg-base-200">
                            <div className="card-body flex-row items-center gap-4">
                                <ProductImage product={item.product} className="size-20" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold">{item.product.name}</p>
                                    <CartLineDetails item={item} />
                                    <p className="font-semibold mt-1">{currency(item.product.price * item.quantity)}</p>
                                </div>
                                <div className="join">
                                    <button className="btn btn-sm join-item" onClick={() => updateQuantity(item.product._id, -1)}><MinusIcon className="size-4" /></button>
                                    <button className="btn btn-sm join-item pointer-events-none">{item.quantity}</button>
                                    <button className="btn btn-sm join-item" onClick={() => updateQuantity(item.product._id, 1)}><PlusIcon className="size-4" /></button>
                                </div>
                                <button className="btn btn-error btn-sm" onClick={() => removeItem(item.product._id)}><Trash2Icon className="size-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === "checkout" && (
                <div className="space-y-4">
                    <BackButton onClick={() => setView("cart")}>Back to Cart</BackButton>
                    <div className="card bg-base-200">
                        <div
                            className={`card-body space-y-3 ${!isAddressEditing ? "cursor-pointer hover:bg-base-300/40 transition-colors rounded-2xl" : ""}`}
                            onClick={() => !isAddressEditing && setIsAddressEditing(true)}
                        >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <div>
                                    <h2 className="font-semibold">Customer Information</h2>
                                    <p>{`${authUser?.firstName || ""} ${authUser?.lastName || ""}`.trim() || "Patient"}</p>
                                </div>
                                {isAddressEditing ? (
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => {
                                            setAddressForm({ ...emptyAddress, ...(authUser?.address || {}) });
                                            setIsAddressEditing(false);
                                        }}>
                                            Cancel
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={() => saveAddressMutation.mutate()} disabled={saveAddressMutation.isPending}>
                                            {saveAddressMutation.isPending ? <span className="loading loading-spinner loading-xs" /> : null}
                                            Save Address
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-sm text-primary font-semibold">Click to edit</span>
                                )}
                            </div>
                            {isAddressEditing && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                                    <input className="input input-bordered input-sm" placeholder="Building / House No." value={addressForm.buildingNumber} onChange={(e) => updateAddress("buildingNumber", e.target.value)} />
                                    <input className="input input-bordered input-sm" placeholder="Street" value={addressForm.street} onChange={(e) => updateAddress("street", e.target.value)} />
                                    <input className="input input-bordered input-sm" placeholder="Barangay" value={addressForm.barangay} onChange={(e) => updateAddress("barangay", e.target.value)} />
                                    <input className="input input-bordered input-sm" placeholder="City" value={addressForm.city} onChange={(e) => updateAddress("city", e.target.value)} />
                                    <input className="input input-bordered input-sm" placeholder="Province" value={addressForm.province} onChange={(e) => updateAddress("province", e.target.value)} />
                                    <input className="input input-bordered input-sm" placeholder="Postal Code" value={addressForm.postalCode} onChange={(e) => updateAddress("postalCode", e.target.value)} />
                                </div>
                            )}
                            <p className={checkoutAddress ? "text-sm opacity-70" : "text-sm text-error"}>
                                {checkoutAddress || savedAddress || "Address is missing. Fill it in here before delivery checkout."}
                            </p>
                        </div>
                    </div>
                    <div className="card bg-base-200">
                        <div className="card-body space-y-3">
                            <h2 className="font-semibold">Items</h2>
                            {cart.map((item) => (
                                <div key={item.product._id} className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 rounded-lg bg-base-100 p-3">
                                    <div>
                                        <p className="font-semibold">{item.product.name}</p>
                                        <CartLineDetails item={item} />
                                    </div>
                                    <span className="font-semibold">{currency(item.product.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="card bg-base-200">
                        <div className="card-body space-y-3">
                            <h2 className="font-semibold">Fulfillment</h2>
                            <div className="join">
                                <button className={`btn join-item ${fulfillmentMethod === "delivery" ? "btn-primary" : "btn-outline"}`} onClick={() => setFulfillmentMethod("delivery")}>Delivery</button>
                                <button className={`btn join-item ${fulfillmentMethod === "pickup" ? "btn-primary" : "btn-outline"}`} onClick={() => setFulfillmentMethod("pickup")}>Pickup</button>
                            </div>
                            {fulfillmentMethod === "pickup" && (
                                <input type="datetime-local" className="input input-bordered max-w-sm" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                            )}
                        </div>
                    </div>
                    {hasPrescriptionItems && (
                        <div className="card bg-warning/10 border border-warning/30">
                            <div className="card-body min-h-[172px]">
                                <h2 className="font-semibold">Prescription Required</h2>
                                <div className="flex flex-col md:flex-row md:items-center gap-3 min-h-[56px]">
                                    <input type="file" accept="image/*" className="file-input file-input-bordered w-full max-w-sm" onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)} />
                                    <div className="text-sm opacity-70 min-h-[20px]">
                                        {prescriptionFile ? prescriptionFile.name : "No prescription image selected"}
                                    </div>
                                </div>
                                <p className="text-sm opacity-70">Your order will be held for pharmacy review before payment.</p>
                            </div>
                        </div>
                    )}
                    <div className="card bg-base-200">
                        <div className="card-body space-y-2">
                            <div className="flex justify-between"><span>Subtotal</span><span>{currency(cartTotal)}</span></div>
                            <div className="flex justify-between"><span>Delivery fee</span><span>{currency(deliveryFee)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{currency(total)}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {view === "shop" && cart.length > 0 && (
                <button className="fixed bottom-5 left-1/2 -translate-x-1/2 btn btn-primary shadow-xl gap-3" onClick={() => setView("cart")}>
                    <ShoppingCartIcon className="size-5" />
                    {cartCount} item(s)
                    <span>View Cart</span>
                    <span>{currency(cartTotal)}</span>
                </button>
            )}

            {view === "cart" && cart.length > 0 && (
                <button className="fixed bottom-5 left-1/2 -translate-x-1/2 btn btn-primary shadow-xl gap-3" onClick={() => setView("checkout")}>
                    Checkout
                    <span>{currency(cartTotal)}</span>
                </button>
            )}

            {view === "checkout" && (
                <button
                    className="fixed bottom-5 left-1/2 -translate-x-1/2 btn btn-primary shadow-xl gap-3"
                    disabled={!canCheckout
                        || (hasPrescriptionItems && !prescriptionFile)
                        || prescriptionMutation.isPending
                        || paidOrderMutation.isPending}
                    onClick={() => hasPrescriptionItems ? prescriptionMutation.mutate() : setPaymentOpen(true)}
                >
                    {prescriptionMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : (
                        hasPrescriptionItems ? <UploadCloudIcon className="size-5" /> : <CreditCardIcon className="size-5" />
                    )}
                    {hasPrescriptionItems ? "Submit Prescription" : "Order"}
                    <span>{currency(total)}</span>
                </button>
            )}

            {paymentOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">Simulated Payment</h2>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setPaymentOpen(false)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="bg-base-200 rounded-lg p-4 space-y-2">
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.product._id} className="border-b border-base-300 pb-2 last:border-b-0">
                                        <div className="flex justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{item.product.name}</p>
                                                <CartLineDetails item={item} />
                                            </div>
                                            <span className="font-semibold">{currency(item.product.price * item.quantity)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between"><span>Subtotal</span><span>{currency(cartTotal)}</span></div>
                            <div className="flex justify-between"><span>Delivery fee</span><span>{currency(deliveryFee)}</span></div>
                            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency(total)}</span></div>
                        </div>
                        <div className="modal-action">
                            <label className="label cursor-pointer justify-start gap-3 flex-1">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary checkbox-sm"
                                    checked={paymentTermsAccepted}
                                    onChange={(e) => setPaymentTermsAccepted(e.target.checked)}
                                />
                                <span className="label-text text-xs">
                                    I confirm the pharmacy order details, prescription requirements, fulfillment choice, and MedConnect{" "}
                                    <button
                                        type="button"
                                        className="link link-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTermsOpen(true);
                                        }}
                                    >
                                        terms and conditions
                                    </button>.
                                </span>
                            </label>
                            <button className="btn btn-ghost" onClick={() => {
                                setPaymentOpen(false);
                                setPaymentTermsAccepted(false);
                            }}>Cancel</button>
                            <button className="btn btn-primary" disabled={paidOrderMutation.isPending || !paymentTermsAccepted} onClick={() => paidOrderMutation.mutate(checkoutPayload())}>
                                {paidOrderMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : null}
                                Pay {currency(total)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {approvedPaymentOrder && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">Simulated Payment</h2>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => {
                                setApprovedPaymentOrder(null);
                                setApprovedTermsAccepted(false);
                            }}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="bg-base-200 rounded-lg p-4 space-y-2">
                            {(approvedPaymentOrder.items || []).map((item, index) => (
                                <div key={`${item.name}-${index}`} className="border-b border-base-300 pb-2 last:border-b-0">
                                    <div className="flex justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-sm opacity-70">Unit price: {currency(item.unitPrice)}</p>
                                            <p className="text-sm opacity-70">Quantity: {item.quantity}</p>
                                            <p className="text-sm opacity-70">{item.overTheCounter ? "No prescription required" : "Prescription required"}</p>
                                        </div>
                                        <span className="font-semibold">{currency(item.unitPrice * item.quantity)}</span>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between"><span>Subtotal</span><span>{currency(approvedPaymentOrder.subtotal)}</span></div>
                            <div className="flex justify-between"><span>Delivery fee</span><span>{currency(approvedPaymentOrder.deliveryFee)}</span></div>
                            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency(approvedPaymentOrder.totalAmount)}</span></div>
                        </div>
                        <label className="label cursor-pointer justify-start gap-3 mt-4">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary checkbox-sm"
                                checked={approvedTermsAccepted}
                                onChange={(e) => setApprovedTermsAccepted(e.target.checked)}
                            />
                            <span className="label-text text-xs">
                                I confirm the approved prescription order details and MedConnect{" "}
                                <button
                                    type="button"
                                    className="link link-primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTermsOpen(true);
                                    }}
                                >
                                    terms and conditions
                                </button>.
                            </span>
                        </label>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => {
                                setApprovedPaymentOrder(null);
                                setApprovedTermsAccepted(false);
                            }}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                disabled={payApprovedMutation.isPending || !approvedTermsAccepted}
                                onClick={() => payApprovedMutation.mutate(approvedPaymentOrder._id)}
                            >
                                {payApprovedMutation.isPending ? <span className="loading loading-spinner loading-sm" /> : null}
                                Pay {currency(approvedPaymentOrder.totalAmount)}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => {
                        setApprovedPaymentOrder(null);
                        setApprovedTermsAccepted(false);
                    }} />
                </div>
            )}
            <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
            <ProductDetailModal
                product={detailProduct}
                onClose={() => setDetailProduct(null)}
                onAddToCart={(product) => {
                    addToCart(product);
                    setDetailProduct(null);
                }}
            />
        </div>
    );
};

export default CustomerPharmacyPage;
