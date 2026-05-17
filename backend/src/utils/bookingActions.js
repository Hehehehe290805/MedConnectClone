import axios from "axios";
import dayjs from "dayjs";

/**
 * Rules for which user acts at each appointment phase
 */
const rules = {
    // Doctor's turns
    doctor: [
        "pending_accept",    // Accepts appointment
        "booked",            // Confirms appointment
        "confirmed",         // Starts session
        "ongoing",           // Marks complete
        "marked_complete",   // Marks finished
        "fully_paid"         // Confirms payment
    ],

    // Patient's turns
    patient: [
        "awaiting_deposit",      // Pays deposit
        "completed",             // Pays balance
        "confirm_fully_paid"     // Rates and reviews the appointment
    ]
};

/**
 * Determines whether the logged-in user can perform the next action
 * @param {string} userRole - 'doctor' or 'patient'
 * @param {string} status - current appointment status
 */
export function canProceedToNextPhase(userRole, status) {
    return rules[userRole]?.includes(status);
}

/**
 * Handles appointment status transitions (doctor/patient)
 * @param {object} appointment - the appointment object
 * @param {string} userRole - current user's role
 * @param {function} onStatusUpdate - callback when updated successfully
 */
export async function handleNextStatus(appointment, userRole, onStatusUpdate) {
    const API_URL = import.meta.env.VITE_API_URL || "";
    const { _id, status } = appointment;

    try {
        let endpoint = "";
        let payload = {};
        let successMessage = "";

        // Doctor flow
        if (userRole === "doctor") {
            switch (status) {
                case "pending_accept":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "booked" };
                    successMessage = "Appointment accepted successfully!";
                    break;

                case "booked":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "confirmed" };
                    successMessage = "Appointment confirmed successfully!";
                    break;

                case "confirmed":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "ongoing" };
                    successMessage = "Session started!";
                    break;

                case "ongoing":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "marked_complete" };
                    successMessage = "Appointment marked complete!";
                    break;

                case "marked_complete":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "fully_paid" };
                    successMessage = "Payment confirmed!";
                    break;

                default:
                    throw new Error("No further actions available for this status.");
            }

            // Patient flow
        } else if (userRole === "patient") {
            switch (status) {
                case "awaiting_deposit":
                    endpoint = "/api/payment/deposit";
                    payload = { appointmentId: _id };
                    successMessage = "Deposit paid successfully!";
                    break;

                case "completed":
                    endpoint = "/api/payment/balance";
                    payload = { appointmentId: _id };
                    successMessage = "Balance paid successfully!";
                    break;

                case "confirm_fully_paid":
                    endpoint = "/api/booking/update-status";
                    payload = { appointmentId: _id, newStatus: "rated" };
                    successMessage = "Appointment rated and reviewed!";
                    break;

                default:
                    throw new Error("No further actions available for this status.");
            }
        }

        // Send API request
        const res = await axios.post(`${API_URL}${endpoint}`, payload, { withCredentials: true });

        if (res.status === 200 || res.status === 201) {
            alert(successMessage);
            onStatusUpdate(res.data.appointment || res.data);
        }

    } catch (error) {
        console.error("Error progressing appointment:", error);
        alert(error.response?.data?.message || error.message || "Action failed.");
    }
}
