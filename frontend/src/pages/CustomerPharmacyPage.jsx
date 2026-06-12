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
import SimulatedPaymentCard from "../components/SimulatedPaymentCard";
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

const DELIVERY_FEE_RATE = 0.15;
const PLATFORM_FEE_RATE = 0.1;

const roundCurrency = (value) => Math.round(value * 100) / 100;

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

const cartStorageKey = (userId) => `medconnect:pharmacy-cart:${userId || "guest"}`;

const ProductImage = ({ product, className = "h-36 w-full" }) => (
    product.image?.url ? (
        <img src={product.image.url} alt={product.name} className={`${className} object-cover rounded-lg`} />
    ) : (
        <div className={`${className} bg-base-300 rounded-lg flex items-center justify-center`}>
            <PackageIcon className="size-10 opacity-50" />
        </div>
    )
);

const MedicineTypePill = ({ overTheCounter, full = false }) => (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        overTheCounter
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : "bg-amber-100 text-amber-800 border-amber-200"
    }`}>
        {overTheCounter ? (full ? "Over the Counter" : "OTC") : "Prescription"}
    </span>
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
        <div className="pt-1"><MedicineTypePill overTheCounter={item.product.overTheCounter} full /></div>
    </div>
);

const CartInfoBlock = ({ label, children, className = "" }) => (
    <div className={className}>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-1 text-sm font-semibold text-slate-800">{children}</div>
    </div>
);

const ProductDetailModal = ({ product, onClose, onAddToCart }) => {
    if (!product) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="font-bold text-xl leading-tight">{product.name}</h2>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 p-5">
                    <ProductImage product={product} className="w-full aspect-square" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="text-sm opacity-60">Price</p>
                            <p className="text-lg font-bold">{currency(product.price)}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="text-sm opacity-60">Amount</p>
                            <p className="text-lg font-semibold">{product.quantityValue} {product.quantityUnit}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="text-sm opacity-60">Available stock</p>
                            <p className="text-lg font-semibold">{product.stock}</p>
                        </div>
                        <div className="bg-base-200 rounded-lg p-3">
                            <p className="text-sm opacity-60">Type</p>
                            <div className="mt-1"><MedicineTypePill overTheCounter={product.overTheCounter} full /></div>
                        </div>
                    </div>
                </div>

                <div className="modal-action px-5 pb-5">
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

const AddToCartModal = ({ product, onClose, onConfirm }) => {
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        setQuantity(1);
    }, [product?._id]);

    if (!product) return null;

    const maxStock = Math.max(1, product.stock || 1);
    const normalizedQuantity = Math.max(1, Math.min(Number(quantity) || 1, maxStock));
    const total = product.price * normalizedQuantity;
    const updateQuantity = (value) => setQuantity(Math.max(1, Math.min(Number(value) || 1, maxStock)));

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-sm p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wide opacity-80">Add to Cart</p>
                            <h2 className="font-bold text-lg leading-tight">{product.name}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <ProductImage product={product} className="h-36 w-full" />
                    <div className="grid grid-cols-2 gap-3">
                        <CartInfoBlock label="Amount">{product.quantityValue} {product.quantityUnit}</CartInfoBlock>
                        <CartInfoBlock label="Type">
                            <MedicineTypePill overTheCounter={product.overTheCounter} full />
                        </CartInfoBlock>
                        <CartInfoBlock label="Unit Price">{currency(product.price)}</CartInfoBlock>
                        <CartInfoBlock label="Stock">{product.stock}</CartInfoBlock>
                    </div>

                    <div className="rounded-xl bg-base-200 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Quantity</p>
                        <div className="flex items-center gap-2">
                            <button className="btn btn-sm" onClick={() => updateQuantity(normalizedQuantity - 1)}>
                                <MinusIcon className="size-4" />
                            </button>
                            <input
                                className="input input-bordered input-sm text-center flex-1"
                                type="number"
                                min="1"
                                max={maxStock}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                onBlur={() => updateQuantity(quantity)}
                            />
                            <button className="btn btn-sm" onClick={() => updateQuantity(normalizedQuantity + 1)}>
                                <PlusIcon className="size-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border-2 border-primary/20 bg-primary/10 p-3">
                        <span className="text-sm font-semibold">Total</span>
                        <span className="text-xl font-bold text-primary">{currency(total)}</span>
                    </div>
                </div>

                <div className="modal-action px-5 pb-5 mt-0">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary gap-2" onClick={() => onConfirm(product, normalizedQuantity)}>
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
    const [selectedCartIds, setSelectedCartIds] = useState([]);
    const [cartLoaded, setCartLoaded] = useState(false);
    const [cartOwnerId, setCartOwnerId] = useState(null);
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
    const [cartProduct, setCartProduct] = useState(null);

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

    const selectedCart = cart.filter((item) => selectedCartIds.includes(item.product._id));
    const cartTotal = selectedCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const selectedCartCount = selectedCart.reduce((sum, item) => sum + item.quantity, 0);
    const hasPrescriptionItems = selectedCart.some((item) => !item.product.overTheCounter);
    const deliveryFee = fulfillmentMethod === "delivery" ? roundCurrency(cartTotal * DELIVERY_FEE_RATE) : 0;
    const platformFee = roundCurrency(cartTotal * PLATFORM_FEE_RATE);
    const total = roundCurrency(cartTotal + deliveryFee + platformFee);
    const savedAddress = addressText(authUser?.address);
    const checkoutAddress = addressText(addressForm);

    useEffect(() => {
        setAddressForm({ ...emptyAddress, ...(authUser?.address || {}) });
    }, [authUser?._id]);

    useEffect(() => {
        if (!authUser?._id) return;
        setCartLoaded(false);
        try {
            const savedCart = JSON.parse(localStorage.getItem(cartStorageKey(authUser._id)) || "[]");
            const safeCart = Array.isArray(savedCart)
                ? savedCart.filter((item) => item?.product?._id && Number(item.quantity) > 0)
                : [];
            setCart(safeCart);
            setSelectedCartIds(safeCart.map((item) => item.product._id));
        } catch {
            setCart([]);
            setSelectedCartIds([]);
        } finally {
            setCartOwnerId(authUser._id);
            setCartLoaded(true);
        }
    }, [authUser?._id]);

    useEffect(() => {
        if (!authUser?._id || !cartLoaded || cartOwnerId !== authUser._id) return;
        localStorage.setItem(cartStorageKey(authUser._id), JSON.stringify(cart));
    }, [authUser?._id, cart, cartLoaded, cartOwnerId]);

    const addToCart = (product, quantity = 1) => {
        const amount = Math.max(1, Math.min(Number(quantity) || 1, product.stock || 1));
        setCheckoutRequestId(createCheckoutRequestId());
        setCart((current) => {
            const existing = current.find((item) => item.product._id === product._id);
            if (existing) {
                return current.map((item) => item.product._id === product._id
                    ? { ...item, quantity: Math.min(item.quantity + amount, product.stock) }
                    : item);
            }
            return [...current, { product, quantity: amount }];
        });
        setSelectedCartIds((current) => current.includes(product._id) ? current : [...current, product._id]);
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
        setSelectedCartIds((current) => current.filter((id) => id !== productId));
    };

    const resetCheckoutState = () => {
        setCart((current) => current.filter((item) => !selectedCartIds.includes(item.product._id)));
        setSelectedCartIds([]);
        setCheckoutRequestId(createCheckoutRequestId());
    };

    const checkoutPayload = () => ({
        clientRequestId: checkoutRequestId,
        items: selectedCart.map((item) => ({
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

    const canCheckout = selectedCart.length > 0
        && (fulfillmentMethod !== "delivery" || checkoutAddress)
        && (fulfillmentMethod !== "pickup" || pickupTime);

    const updateAddress = (field, value) => {
        setAddressForm((current) => ({ ...current, [field]: value }));
    };

    const toggleCartSelection = (productId) => {
        setCheckoutRequestId(createCheckoutRequestId());
        setSelectedCartIds((current) => current.includes(productId)
            ? current.filter((id) => id !== productId)
            : [...current, productId]);
    };

    const allCartSelected = cart.length > 0 && selectedCartIds.length === cart.length;

    const toggleAllCartSelection = () => {
        setCheckoutRequestId(createCheckoutRequestId());
        setSelectedCartIds(allCartSelected ? [] : cart.map((item) => item.product._id));
    };

    return (
        <div className="p-8 pb-28 space-y-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-3xl font-bold">Pharmacy</h1>
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
                                    className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)] h-[330px] cursor-pointer transition-all hover:border-primary/40 hover:shadow-[0_0_0_2px_rgba(47,112,186,0.22),0_12px_34px_rgba(15,23,42,0.36)]"
                                    onClick={() => setDetailProduct(product)}
                                >
                                    <div className="card-body h-full p-4 gap-3">
                                        <ProductImage product={product} className="h-32 w-full" />
                                        <div className="min-h-[58px] text-center">
                                            <h2 className="font-semibold line-clamp-2 min-h-[40px]">{product.name}</h2>
                                            <p className="text-sm opacity-60">{product.quantityValue} {product.quantityUnit}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 min-h-[28px]">
                                            <p className="font-bold">{currency(product.price)}</p>
                                            <MedicineTypePill overTheCounter={product.overTheCounter} />
                                        </div>
                                        <button className="btn btn-primary btn-sm gap-2 mt-auto" onClick={(e) => {
                                            e.stopPropagation();
                                            setCartProduct(product);
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
                    {cart.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border-2 border-base-300 bg-base-100 px-4 py-3 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_6px_22px_rgba(15,23,42,0.22)]">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary"
                                    checked={allCartSelected}
                                    onChange={toggleAllCartSelection}
                                />
                                <span className="font-semibold">Select all cart items</span>
                            </label>
                            <p className="text-sm text-slate-600">
                                {selectedCartCount} selected item(s) · {currency(cartTotal)}
                            </p>
                        </div>
                    )}
                    {cart.map((item) => (
                        <div key={item.product._id} className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)]">
                            <div className="card-body p-5">
                                <div className="grid grid-cols-1 lg:grid-cols-[auto_96px_1.25fr_0.8fr_0.8fr_0.8fr_auto] gap-4 items-center">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={selectedCartIds.includes(item.product._id)}
                                        onChange={() => toggleCartSelection(item.product._id)}
                                        aria-label={`Select ${item.product.name}`}
                                    />
                                    <ProductImage product={item.product} className="size-24" />
                                    <CartInfoBlock label="Medicine">
                                        <p className="text-base">{item.product.name}</p>
                                        <p className="text-xs font-normal text-slate-500">{item.product.quantityValue} {item.product.quantityUnit}</p>
                                    </CartInfoBlock>
                                    <CartInfoBlock label="Unit Price">{currency(item.product.price)}</CartInfoBlock>
                                    <CartInfoBlock label="Type">
                                        <MedicineTypePill overTheCounter={item.product.overTheCounter} full />
                                    </CartInfoBlock>
                                    <CartInfoBlock label="Total">
                                        <span className="text-base">{currency(item.product.price * item.quantity)}</span>
                                    </CartInfoBlock>
                                    <div className="flex items-center justify-start lg:justify-end gap-3">
                                        <div className="join">
                                            <button className="btn btn-sm join-item" onClick={() => updateQuantity(item.product._id, -1)}><MinusIcon className="size-4" /></button>
                                            <button className="btn btn-sm join-item pointer-events-none min-w-12">{item.quantity}</button>
                                            <button className="btn btn-sm join-item" onClick={() => updateQuantity(item.product._id, 1)}><PlusIcon className="size-4" /></button>
                                        </div>
                                        <button className="btn btn-error btn-sm" onClick={() => removeItem(item.product._id)}><Trash2Icon className="size-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {view === "checkout" && (
                <div className="space-y-4">
                    <BackButton onClick={() => setView("cart")}>Back to Cart</BackButton>
                    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)]">
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
                    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)]">
                        <div className="card-body space-y-3">
                            <h2 className="font-semibold">Items</h2>
                            {selectedCart.map((item) => (
                                <div key={item.product._id} className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 rounded-lg bg-base-200 border-2 border-base-300 p-3 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_5px_18px_rgba(15,23,42,0.24)]">
                                    <div>
                                        <p className="font-semibold">{item.product.name}</p>
                                        <CartLineDetails item={item} />
                                    </div>
                                    <span className="font-semibold">{currency(item.product.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)]">
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
                        <div className="card bg-warning/10 border-2 border-warning/40 shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_8px_28px_rgba(15,23,42,0.30)]">
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
                    <div className="card bg-primary/10 border-2 border-primary/30 shadow-[0_0_0_1px_rgba(15,23,42,0.14),0_8px_30px_rgba(15,23,42,0.32)]">
                        <div className="card-body space-y-2">
                            <div className="flex justify-between"><span>Subtotal</span><span>{currency(cartTotal)}</span></div>
                            <div className="flex justify-between"><span>Delivery fee</span><span>{currency(deliveryFee)}</span></div>
                            <div className="flex justify-between"><span>Platform fee</span><span>{currency(platformFee)}</span></div>
                            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{currency(total)}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {view === "shop" && cart.length > 0 && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
                    <button className="btn btn-primary shadow-xl gap-3" onClick={() => setView("cart")}>
                        <ShoppingCartIcon className="size-5" />
                        {cartCount} item(s)
                        <span>View Cart</span>
                        <span>{currency(cartTotal)}</span>
                    </button>
                </div>
            )}

            {view === "cart" && cart.length > 0 && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
                    <button className="btn btn-primary shadow-xl gap-3" onClick={() => setView("checkout")} disabled={selectedCart.length === 0}>
                        {selectedCart.length === 0 ? "Select Items" : "Checkout"}
                        <span>{currency(cartTotal)}</span>
                    </button>
                </div>
            )}

            {view === "checkout" && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
                    <button
                        className="btn btn-primary shadow-xl gap-3"
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
                </div>
            )}

            {paymentOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm p-0 bg-transparent shadow-none">
                        <SimulatedPaymentCard
                            amount={total}
                            subtitle="Pharmacy Order Payment"
                            detailRows={[
                                { label: "Subtotal", value: currency(cartTotal) },
                                { label: "Delivery fee", value: currency(deliveryFee) },
                                { label: "Platform fee", value: currency(platformFee) },
                                { label: "Total", value: currency(total) },
                            ]}
                            confirmed={paymentTermsAccepted}
                            onConfirmedChange={setPaymentTermsAccepted}
                            confirmText={(
                                <>
                                    I confirm the pharmacy order details, prescription requirements, fulfillment choice, and MedConnect{" "}
                                    <button
                                        type="button"
                                        className="link link-primary"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setTermsOpen(true);
                                        }}
                                    >
                                        terms and conditions
                                    </button>.
                                </>
                            )}
                            confirmLabel={`Pay ${currency(total)}`}
                            onConfirm={() => paidOrderMutation.mutate(checkoutPayload())}
                            isPending={paidOrderMutation.isPending}
                            onCancel={() => {
                                setPaymentOpen(false);
                                setPaymentTermsAccepted(false);
                            }}
                        >
                            <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm max-h-56 overflow-y-auto">
                                {selectedCart.map((item) => (
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
                        </SimulatedPaymentCard>
                    </div>
                    <div className="modal-backdrop" onClick={() => {
                        setPaymentOpen(false);
                        setPaymentTermsAccepted(false);
                    }} />
                </div>
            )}

            {approvedPaymentOrder && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm p-0 bg-transparent shadow-none">
                        <SimulatedPaymentCard
                            amount={approvedPaymentOrder.totalAmount}
                            subtitle="Approved Prescription Order Payment"
                            detailRows={[
                                { label: "Subtotal", value: currency(approvedPaymentOrder.subtotal) },
                                { label: "Delivery fee", value: currency(approvedPaymentOrder.deliveryFee) },
                                { label: "Platform fee", value: currency(approvedPaymentOrder.platformFee) },
                                { label: "Total", value: currency(approvedPaymentOrder.totalAmount) },
                            ]}
                            confirmed={approvedTermsAccepted}
                            onConfirmedChange={setApprovedTermsAccepted}
                            confirmText={(
                                <>
                                    I confirm the approved prescription order details and MedConnect{" "}
                                    <button
                                        type="button"
                                        className="link link-primary"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setTermsOpen(true);
                                        }}
                                    >
                                        terms and conditions
                                    </button>.
                                </>
                            )}
                            confirmLabel={`Pay ${currency(approvedPaymentOrder.totalAmount)}`}
                            onConfirm={() => payApprovedMutation.mutate(approvedPaymentOrder._id)}
                            isPending={payApprovedMutation.isPending}
                            onCancel={() => {
                                setApprovedPaymentOrder(null);
                                setApprovedTermsAccepted(false);
                            }}
                        >
                        <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm max-h-56 overflow-y-auto">
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
                        </div>
                        </SimulatedPaymentCard>
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
                    setDetailProduct(null);
                    setCartProduct(product);
                }}
            />
            <AddToCartModal
                product={cartProduct}
                onClose={() => setCartProduct(null)}
                onConfirm={(product, quantity) => {
                    addToCart(product, quantity);
                    setCartProduct(null);
                }}
            />
        </div>
    );
};

export default CustomerPharmacyPage;
