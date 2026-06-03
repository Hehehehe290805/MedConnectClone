import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const STATUS_COLORS = {
    pending_payment:  "badge-warning",
    deposit_paid:     "badge-info",
    accepted:         "badge-success",
    ongoing:          "badge-accent",
    completed:        "badge-success",
    awaiting_balance: "badge-warning",
    fully_paid:       "badge-success",
    cancelled:        "badge-error",
    rejected:         "badge-error",
    disputed:         "badge-warning",
    resolved:         "badge-ghost",
};

const PendingAppointment = ({ appointment, onViewDetails }) => {
    const navigate = useNavigate();
    const { authUser } = useAuthUser();
    const [providerName, setProviderName] = useState("");

    useEffect(() => {
        const fetchCounterpart = async () => {
            try {
                if (authUser?.role === "patient" || authUser?.role === "user") {
                    const id = appointment.doctorId?._id || appointment.doctorId;
                    if (id) {
                        const res = await axiosInstance.get(`/users/${id}`);
                        const d = res.data.data;
                        setProviderName(`Dr. ${d?.firstName} ${d?.lastName}`);
                    }
                } else {
                    const id = appointment.patientId?._id || appointment.patientId;
                    if (id) {
                        const res = await axiosInstance.get(`/users/${id}`);
                        const p = res.data.data;
                        setProviderName(`${p?.firstName} ${p?.lastName}`);
                    }
                }
            } catch { /* non-fatal */ }
        };
        if (authUser && appointment) fetchCounterpart();
    }, [appointment, authUser]);

    const handleMessage = () => {
        const id = authUser?.role === "patient" || authUser?.role === "user"
            ? (appointment.doctorId?._id || appointment.doctorId)
            : (appointment.patientId?._id || appointment.patientId);
        if (id) navigate(`/chat/${id}`);
    };

    const { date, time } = (() => {
        const d = new Date(appointment.start);
        return {
            date: d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
            time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        };
    })();

    const paymentLabel = appointment.balancePaid
        ? "Fully Paid ✓"
        : appointment.depositPaid
            ? "Deposit Paid"
            : "Pending Payment";

    return (
        <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
                <div className="flex justify-between items-start">
                    <h3 className="card-title text-base">
                        {providerName || "Appointment"}
                    </h3>
                    <span className={`badge ${STATUS_COLORS[appointment.status] || "badge-ghost"}`}>
                        {(appointment.status || "").replace(/_/g, " ")}
                    </span>
                </div>

                <div className="space-y-1 text-sm">
                    <p><strong>Date:</strong> {date}</p>
                    <p><strong>Time:</strong> {time}</p>
                    <p><strong>Duration:</strong> {Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000)} min</p>
                    <p><strong>Amount:</strong> ₱{appointment.amount?.toLocaleString("en-PH")}</p>
                    <p><strong>Payment:</strong> {paymentLabel}</p>
                </div>

                <div className="card-actions justify-end mt-3 gap-2">
                    <button className="btn btn-sm btn-ghost" onClick={handleMessage}>
                        Message
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => onViewDetails(appointment)}>
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingAppointment;
