import { AlertTriangleIcon, CreditCardIcon } from "lucide-react";

const formatCurrency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const SimulatedPaymentCard = ({
    amount,
    subtitle,
    referenceNumber,
    detailRows = [],
    children,
    confirmed,
    onConfirmedChange,
    confirmText,
    confirmLabel,
    onConfirm,
    isPending = false,
    onCancel,
    cancelLabel = "Cancel",
    footer,
    maxWidth = "max-w-sm",
}) => (
    <div className={`card bg-base-100 w-full ${maxWidth} shadow-2xl`}>
        <div className="bg-primary rounded-t-2xl px-6 py-5 text-primary-content text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                <CreditCardIcon className="size-5 opacity-80" />
                <span className="text-xs uppercase tracking-widest opacity-70">Simulated Payment</span>
            </div>
            <p className="text-4xl font-bold">{formatCurrency(amount)}</p>
            {subtitle && <p className="text-sm opacity-80 mt-1">{subtitle}</p>}
        </div>

        <div className="card-body space-y-4">
            <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm">
                <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                <p className="text-warning-content opacity-80">
                    <strong>Demo mode.</strong> No real payment is processed. This simulates a GCash/payment gateway flow for development purposes.
                </p>
            </div>

            <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm">
                {detailRows.map((row) => (
                    <div key={row.label} className="flex justify-between gap-3">
                        <span className="opacity-60">{row.label}</span>
                        <span className={`text-right ${row.mono ? "font-mono font-semibold text-primary" : "font-medium"}`}>
                            {row.value}
                        </span>
                    </div>
                ))}
                {referenceNumber && (
                    <div className="flex justify-between gap-3">
                        <span className="opacity-60">Reference No.</span>
                        <span className="font-mono font-semibold text-primary text-right">{referenceNumber}</span>
                    </div>
                )}
            </div>

            {children}

            <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                    type="checkbox"
                    className="checkbox checkbox-primary mt-0.5"
                    checked={confirmed}
                    onChange={(e) => onConfirmedChange(e.target.checked)}
                />
                <span className="text-sm opacity-70">{confirmText}</span>
            </label>

            <button
                className="btn btn-primary w-full"
                disabled={!confirmed || isPending}
                onClick={onConfirm}
            >
                {isPending ? (
                    <>
                        <span className="loading loading-spinner loading-sm" />
                        Processing...
                    </>
                ) : confirmLabel}
            </button>

            {footer}

            {onCancel && (
                <button className="btn btn-ghost btn-sm w-full" onClick={onCancel} disabled={isPending}>
                    {cancelLabel}
                </button>
            )}
        </div>
    </div>
);

export default SimulatedPaymentCard;
