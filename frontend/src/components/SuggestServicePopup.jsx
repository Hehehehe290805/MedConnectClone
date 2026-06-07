import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import useAuthUser from "../hooks/useAuthUser";
import toast from "react-hot-toast";

const SuggestServicePopup = ({ onClose }) => {
    const { authUser } = useAuthUser();
    const queryClient = useQueryClient();
    const [name, setName] = useState("");

    const { mutate: suggestService, isPending } = useMutation({
        mutationFn: async (data) => {
            const res = await axiosInstance.post("/services/suggest", data);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Service suggested successfully. Waiting for admin approval.");
            queryClient.invalidateQueries({ queryKey: ["myServices"] });
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || "Failed to suggest service.");
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Service name is required");
        suggestService({
            name: name.trim(),
            type: "service",
            rootDepartmentTypeId: authUser?.departmentType,
        });
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box">
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                >
                    ✕
                </button>
                <h3 className="font-bold text-lg mb-4">Suggest New Service</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Service Name</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., Complete Blood Count"
                            className="input input-bordered w-full"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isPending}>
                            {isPending ? <span className="loading loading-spinner loading-sm" /> : "Suggest"}
                        </button>
                    </div>
                </form>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

export default SuggestServicePopup;
