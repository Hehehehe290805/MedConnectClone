import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { CreditCardIcon, AlertTriangleIcon } from "lucide-react";

function generateRef() {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `MC-${ts}-${rand}`;
}

const MockGCashPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const appointmentId = params.get("appointmentId");
    const type = params.get("type"); // "deposit" | "balance"
    const amount = parseFloat(params.get("amount") || "0");

    const [confirmed, setConfirmed] = useState(false);
    const [ref] = useState(generateRef);

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            const endpoint = type === "deposit" ? "/booking/pay-deposit" : "/booking/pay-balance";
            const res = await axiosInstance.post(endpoint, { appointmentId, referenceNumber: ref });
            return res.data;
        },
        onSuccess: () => {
            toast.success(type === "deposit" ? "Deposit confirmed." : "Balance payment confirmed.");
            navigate("/");
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || "Payment failed. Please try again.");
        },
    });

    if (!appointmentId || !type || !amount) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-100">
                <div className="card bg-base-200 p-8 text-center">
                    <p className="text-error">Invalid payment link.</p>
                    <button className="btn btn-ghost mt-4" onClick={() => navigate("/")}>Go Home</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-300 flex items-center justify-center p-4">
            <div className="card bg-base-100 w-full max-w-sm shadow-2xl">
                {/* Header */}
                <div className="bg-primary rounded-t-2xl px-6 py-5 text-primary-content text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <CreditCardIcon className="size-5 opacity-80" />
                        <span className="text-xs uppercase tracking-widest opacity-70">Simulated Payment</span>
                    </div>
                    <p className="text-4xl font-bold">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm opacity-80 mt-1">
                        {type === "deposit" ? "Appointment Deposit (50%)" : "Balance Payment (50%)"}
                    </p>
                </div>

                <div className="card-body space-y-4">
                    {/* Demo notice */}
                    <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm">
                        <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                        <p className="text-warning-content opacity-80">
                            <strong>Demo mode.</strong> No real payment is processed. This simulates a GCash/payment gateway flow for development purposes.
                        </p>
                    </div>

                    {/* Payment details */}
                    <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="opacity-60">Type</span>
                            <span className="font-medium capitalize">{type} payment</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Amount</span>
                            <span className="font-semibold">₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Reference No.</span>
                            <span className="font-mono font-semibold text-primary">{ref}</span>
                        </div>
                    </div>

                    {/* Confirm checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-primary mt-0.5"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        <span className="text-sm opacity-70">
                            I confirm this simulated payment of{" "}
                            <strong>₱{amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>.
                        </span>
                    </label>

                    <button
                        className="btn btn-primary w-full"
                        disabled={!confirmed || isPending}
                        onClick={() => mutate()}
                    >
                        {isPending
                            ? <><span className="loading loading-spinner loading-sm" />Processing…</>
                            : "Confirm Payment"}
                    </button>

                    <button className="btn btn-ghost btn-sm w-full" onClick={() => navigate(-1)} disabled={isPending}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MockGCashPage;
