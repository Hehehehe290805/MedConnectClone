import { useState } from "react";
import { axiosInstance } from "../lib/axios";

const SetPricePopup = ({ onClose, onPriceSet, currentPrice }) => {
    const [price, setPrice] = useState(currentPrice || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!price || isNaN(price) || parseFloat(price) <= 0) {
            setError("Please enter a valid positive number for the price.");
            return;
        }

        try {
            setLoading(true);
            setError("");


            try {
                await axiosInstance.post("/specialties-and-services/auto-claim-appointment", {});

            } catch (err) {
                console.warn("⚠️ Auto-claim skipped or failed:", err.response?.data?.message || err.message);
            }

            const res = await axiosInstance.post("/pricing/set-pricing", {
                price: parseFloat(price),
            });
            
            if (res.data.message === "Pricing set/updated successfully") {
                onPriceSet(parseFloat(price));
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update price");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">
                    {currentPrice ? "Update Consultation Price" : "Set Consultation Price"}
                </h2>

                <form onSubmit={handleSubmit}>
                    <div className="form-control w-full mb-4">
                        <label className="label">
                            <span className="label-text">Consultation Price (₱)</span>
                        </label>
                        <input
                            type="number"
                            placeholder="Enter price in pesos"
                            className="input input-bordered w-full"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            min="0"
                            disabled={loading}
                        />
                        <label className="label">
                            <span className="label-text-alt">
                                This will be your standard consultation fee
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="alert alert-error mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Setting Price...
                                </>
                            ) : (
                                currentPrice ? "Update Price" : "Set Price"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetPricePopup;