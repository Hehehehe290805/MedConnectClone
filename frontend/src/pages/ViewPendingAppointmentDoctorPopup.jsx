import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const ViewPendingAppointmentDoctorPopup = ({ appointment, onClose, onAppointmentUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [patient, setPatient] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    };
  };

  const getDuration = () => {
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    return Math.round((end - start) / (1000 * 60));
  };

  const { date, time } = formatDateTime(appointment.start);

  // --- FETCH PATIENT INFO ---
  useEffect(() => {
    const fetchPatient = async () => {
      if (!appointment.patientId) return;

      const patientId = typeof appointment.patientId === "string"
        ? appointment.patientId
        : appointment.patientId._id;

      try {
        const res = await axiosInstance.get(`/users/${patientId}`);

        setPatient(res.data.data);
      } catch (err) {
        console.error("Failed to fetch patient info:", err);
        toast.error("Failed to load patient information");
      }
    };

    fetchPatient();
  }, [appointment.patientId]);

  // --- ACCEPT HANDLER ---
  const handleAccept = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post("/doctor-schedule/confirm", {
        appointmentId: appointment._id,
      });


      if (res.data.success) {
        toast.success("Appointment accepted. Awaiting patient deposit.");
        onAppointmentUpdated(appointment._id, "awaiting_deposit");
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to accept appointment";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // --- REJECT HANDLER ---
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post("/doctor-schedule/reject", {
        appointmentId: appointment._id,
        reason: rejectReason || "No reason provided",
      });


      if (res.data.success) {
        toast.success("Appointment rejected");
        onAppointmentUpdated(appointment._id, "rejected");
        setShowRejectModal(false);
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to reject appointment";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CONFIRM DEPOSIT HANDLER
  const handleConfirmDeposit = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post("/doctor-schedule/confirm-deposit", {
        appointmentId: appointment._id,
      });


      if (res.data.success) {
        toast.success("Deposit confirmed successfully");
        onAppointmentUpdated(appointment._id, "confirmed");
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to confirm deposit";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAttend = async () => {
    try {
      setLoading(true);

      const res = await axiosInstance.post(`/booking/attend/${appointment._id}`, {});

      toast.success("Attendance marked successfully!"); // ✅ show success toast
      onAppointmentUpdated(res.data.appointment);

      // small delay so user can see toast before closing
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };


  // ✅ MARK COMPLETE HANDLER
  const handleMarkComplete = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post("/doctor-schedule/mark-complete", {
        appointmentId: appointment._id,
      });


      if (res.data.success) {
        toast.success("Appointment marked as complete");
        onAppointmentUpdated(appointment._id, "marked_complete");
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to mark as complete";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CONFIRM BALANCE PAYMENT HANDLER
  const handleConfirmBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.post("/doctor-schedule/confirm-full-payment", {
        appointmentId: appointment._id,
      });


      if (res.data.success) {
        toast.success("Balance payment confirmed successfully");
        onAppointmentUpdated(appointment._id, "confirm_fully_paid");
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to confirm balance";
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => {
    switch (appointment.status) {
      case "pending_accept":
        return (
          <div className="flex gap-2">
            <button
              className="btn btn-success btn-sm flex-1"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading ? "Processing..." : "Accept"}
            </button>
            <button
              className="btn btn-error btn-sm flex-1"
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
            >
              Reject
            </button>
          </div>
        );

      case "awaiting_deposit":
        return (
          <div className="alert alert-info">
            <span>Waiting for patient to pay deposit...</span>
          </div>
        );

      case "booked":
        return (
          <>
            <div className="alert alert-warning mb-4">
              <span>Deposit received. Please confirm to finalize appointment.</span>
            </div>
            <button
              className="btn btn-success btn-block"
              onClick={handleConfirmDeposit}
              disabled={loading}
            >
              {loading ? "Confirming..." : "Confirm Deposit"}
            </button>
          </>
        );

      case "confirmed":
        return (
          <div className="alert alert-success">
            <span>Appointment confirmed! Waiting for appointment time...</span>
          </div>
        );

      case "ongoing":
        return (
          <>
            <div className="alert alert-info mb-4">
              <span>Appointment is ongoing. Mark as complete when finished.</span>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary flex-1"
                onClick={handleAttend}
                disabled={loading}
              >
                {loading ? "Processing..." : "Mark Attendance"}
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleMarkComplete}
                disabled={loading}
              >
                {loading ? "Processing..." : "Mark as Complete"}
              </button>
            </div>
          </>
        );



      case "marked_complete":
        return (
          <div className="alert alert-warning">
            <span>Waiting for patient to pay balance...</span>
          </div>
        );

      case "fully_paid":
        return (
          <>
            <div className="alert alert-info mb-4">
              <span>Balance payment received. Confirm to complete.</span>
            </div>
            <button
              className="btn btn-success btn-block"
              onClick={handleConfirmBalance}
              disabled={loading}
            >
              {loading ? "Confirming..." : "Confirm   Balance Payment"}
            </button>
          </>
        );

      case "completed":
        return (
          <div className="alert alert-success">
            <span>Appointment completed! Awaiting Payment.</span>
          </div>
        );

      case "rejected":
        return (
          <div className="alert alert-error">
            <span>This appointment was rejected</span>
          </div>
        );

      default:
        return (
          <div className="alert alert-info">
            <span>Status: {appointment.status}</span>
          </div>
        );
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h2 className="text-lg font-bold mb-4">Appointment Details</h2>

        {/* Patient Info */}
        <div className="mb-4">
          <h3 className="font-semibold">Patient:</h3>
          {patient ? (
            <p>{patient.firstName} {patient.lastName}</p>
          ) : (
            <p>Loading patient info...</p>
          )}
        </div>

        {/* Appointment Details */}
        <div className="space-y-2 mb-4 text-sm">
          <p><strong>Date:</strong> {date}</p>
          <p><strong>Time:</strong> {time}</p>
          <p><strong>Duration:</strong> {getDuration()} minutes</p>
          <p><strong>Amount:</strong> ₱{appointment.amount}</p>
          {appointment.status && <p><strong>Status:</strong> {appointment.status}</p>}
        </div>

        {/* Deposit Info (if exists) */}
        {appointment.depositRef && (
          <div className="mb-4 p-3 bg-base-200 rounded">
            <p><strong>Deposit Amount:</strong> ₱{appointment.paymentDeposit}</p>
            <p><strong>Reference Number:</strong> {appointment.depositRef}</p>
          </div>
        )}

        {/* Balance Info (if exists) */}
        {appointment.balanceRef && (
          <div className="mb-4 p-3 bg-base-200 rounded">
            <p><strong>Balance Amount:</strong> ₱{appointment.balanceAmount}</p>
            <p><strong>Reference Number:</strong> {appointment.balanceRef}</p>
          </div>
        )}

        {/* Success/Error Messages */}
        {success && <div className="alert alert-success mb-4">{success}</div>}
        {error && <div className="alert alert-error mb-4">{error}</div>}

        {/* Action Buttons */}
        {renderActions()}

        {/* Close Button */}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Reason for Rejection</h3>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Enter reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleReject}
                disabled={loading}
              >
                {loading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewPendingAppointmentDoctorPopup;
