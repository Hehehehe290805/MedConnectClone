import { useState } from "react";
import { PackageIcon, ReceiptIcon, ClockIcon, ShoppingBagIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import TransactionList from "../components/TransactionList";

const HomePagePharmacy = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";
    const [tab, setTab] = useState("orders");

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

            <div>
                <h1 className="text-2xl font-bold">Welcome, {authUser?.pharmacyName || "Pharmacy"}</h1>
            </div>

            <div role="tablist" className="tabs tabs-bordered">
                <button role="tab" className={`tab gap-2 ${tab === "orders" ? "tab-active" : ""}`} onClick={() => setTab("orders")}>
                    <ShoppingBagIcon className="size-4" /> Orders
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "catalogue" ? "tab-active" : ""}`} onClick={() => setTab("catalogue")}>
                    <PackageIcon className="size-4" /> Manage Catalogue
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "transactions" ? "tab-active" : ""}`} onClick={() => setTab("transactions")}>
                    <ReceiptIcon className="size-4" /> Transactions
                </button>
            </div>

            {tab === "orders" && (
                <div className="text-center py-16 opacity-40">
                    <ShoppingBagIcon className="size-12 mx-auto mb-3" />
                    <p className="text-lg font-medium">Orders</p>
                    <p className="text-sm">Order management is coming soon.</p>
                </div>
            )}

            {tab === "catalogue" && (
                <div className="text-center py-16 opacity-40">
                    <PackageIcon className="size-12 mx-auto mb-3" />
                    <p className="text-lg font-medium">Catalogue Management</p>
                    <p className="text-sm">Medicine catalogue features are coming soon.</p>
                </div>
            )}

            {tab === "transactions" && <TransactionList />}
        </div>
    );
};

export default HomePagePharmacy;
