import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import SimulatedPaymentCard from "../components/SimulatedPaymentCard";

function generateRef() {
    const ts = Date.now().toString().slice(-8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `MC-${ts}-${rand}`;
}

const formatCurrency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const MockGCashPage = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const appointmentId = params.get("appointmentId");
    const type = params.get("type");
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

    useEffect(() => {
        document.title = "Mock GCash Payment";
    }, []);

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
            <SimulatedPaymentCard
                amount={amount}
                subtitle={type === "deposit" ? "Appointment Deposit (50%)" : "Balance Payment (50%)"}
                referenceNumber={ref}
                detailRows={[
                    { label: "Type", value: `${type} payment` },
                    { label: "Amount", value: formatCurrency(amount) },
                ]}
                confirmed={confirmed}
                onConfirmedChange={setConfirmed}
                confirmText={(
                    <>
                        I confirm this simulated payment of <strong>{formatCurrency(amount)}</strong>.
                    </>
                )}
                confirmLabel={`Confirm & Complete ${type === "deposit" ? "Deposit" : "Balance"} Payment`}
                onConfirm={() => mutate()}
                isPending={isPending}
                footer={(
                    <p className="text-xs text-center opacity-50">
                        By clicking this button, you agree to our{" "}
                        <Link to="/terms-of-service" target="_blank" className="link link-primary">Terms &amp; Conditions</Link>.
                    </p>
                )}
                onCancel={() => navigate(-1)}
            />
        </div>
    );
};

export default MockGCashPage;
