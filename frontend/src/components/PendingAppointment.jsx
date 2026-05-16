import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const PendingAppointment = ({ appointment, onAppointmentUpdated, onViewDetails }) => {
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const [error, setError] = useState(null);
  const [isReporting, setIsReporting] = useState(false);
  const [complaint, setComplaint] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  
  // Store fetched user data
  const [doctor, setDoctor] = useState(null);
  const [patient, setPatient] = useState(null);
  const [institute, setInstitute] = useState(null);

  // Fetch doctor/patient/institute info based on role
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        if (authUser?.role === "user") {
          // User needs doctor or institute info
          if (appointment.doctorId) {
            const doctorIdStr = typeof appointment.doctorId === "string" 
              ? appointment.doctorId 
              : appointment.doctorId._id;
            
            const res = await axiosInstance.get(`/users/${doctorIdStr}`);

            setDoctor(res.data.data);
          }
        } else if (authUser?.role === "doctor") {
          // Doctor/Institute needs patient info
          if (appointment.patientId) {
            const patientIdStr = typeof appointment.patientId === "string"
              ? appointment.patientId
              : appointment.patientId._id;
            
            const res = await axiosInstance.get(`/users/${patientIdStr}`);

            setPatient(res.data.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    };

    if (authUser && appointment) {
      fetchUserInfo();
    }
  }, [appointment, authUser]);

  // Determine who to chat with based on current user's role
  const getChatRecipientId = () => {
    if (!authUser) return null;

    if (authUser.role === "user") {
      if (appointment.doctorId) {
        return typeof appointment.doctorId === "string"
          ? appointment.doctorId
          : appointment.doctorId._id;
      }
      if (appointment.instituteId) {
        return typeof appointment.instituteId === "string"
          ? appointment.instituteId
          : appointment.instituteId._id;
      }
    }

    if (authUser.role === "doctor" || authUser.role === "institute") {
      if (appointment.patientId) {
        return typeof appointment.patientId === "string"
          ? appointment.patientId
          : appointment.patientId._id;
      }
    }

    return null;
  };

  // Get display name for who user is chatting with
  const getChatRecipientName = () => {
    if (!authUser) return "";

    if (authUser.role === "user") {
      // User chatting with doctor/institute
      if (doctor) {
        return `Dr. ${doctor.firstName} ${doctor.lastName}`;
      }
      if (institute) {
        return institute.facilityName || "Institute";
      }
      return "Provider";
    }

    if (authUser.role === "doctor" || authUser.role === "institute") {
      // Doctor/Institute chatting with patient
      if (patient) {
        return `${patient.firstName} ${patient.lastName}`;
      }
      return "Patient";
    }

    return "Recipient";
  };

  const handleMessageClick = () => {
    const recipientId = getChatRecipientId();
    if (recipientId) {
      navigate(`/chat/${recipientId}`);
    } else {
      setError("Unable to start chat - recipient information not available");
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      pending_accept: "badge-warning",
      awaiting_deposit: "badge-info",
      booked: "badge-primary",
      confirmed: "badge-success",
      ongoing: "badge-secondary",
      marked_complete: "badge-accent",
      completed: "badge-success",
      fully_paid: "badge-primary",
      confirm_fully_paid: "badge-success",
      cancelled_unpaid: "badge-error",
      cancelled: "badge-error",
      rejected: "badge-error",
      no_show_patient: "badge-error",
      no_show_doctor: "badge-error",
      no_show_both: "badge-error",
      freeze: "badge-neutral",
    };

    return (
      <span className={`badge ${statusColors[status] || "badge-ghost"}`}>
        {status.replace(/_/g, " ").toUpperCase()}
      </span>
    );
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const { date, time } = formatDateTime(appointment.start);

  const getPaymentStatus = () => {
    if (appointment.balancePaid) return "Fully Paid ✓";
    if (appointment.depositPaid) return "Deposit Paid (Pending Full Payment)";
    return "Pending Payment";
  };

  const handleReport = async () => {
    if (!complaint.trim()) return;

    setReportLoading(true);
    setError(null);

    try {
      await axiosInstance.post(`/booking/report/${appointment._id}`, {
        complaint: complaint.trim(),
      });

      toast.success("Report submitted successfully!"); // ✅ show toast
      setIsReporting(false);
      setComplaint("");
    } catch (err) {
      console.error("Error reporting:", err);
      const errorMsg = err.response?.data?.message || "Failed to submit report";
      toast.error(errorMsg); // ✅ show error toast
      setError(errorMsg);
    } finally {
      setReportLoading(false);
    }
  };


  const recipientId = getChatRecipientId();
  const recipientName = getChatRecipientName();

  // Check if video call button should show
  const showVideoButton = appointment.status === "ongoing" && appointment.videoCallLink;
  
  return (
    <div className="card bg-base-100 shadow-lg">
      <div className="card-body">
        {/* Status Badge */}
        <div className="flex justify-between items-start">
          <h3 className="card-title">
            Appointment with {recipientName}
          </h3>
          {getStatusBadge(appointment.status)}
        </div>

        {/* Appointment Details */}
        <div className="space-y-2 text-sm">
          <p>
            <strong>Date:</strong> {date}
          </p>
          <p>
            <strong>Time:</strong> {time}
          </p>
          <p>
            <strong>Duration:</strong>{" "}
            {Math.round(
              (new Date(appointment.end) - new Date(appointment.start)) /
                (1000 * 60)
            )}{" "}
            minutes
          </p>
          <p>
            <strong>Amount:</strong> ₱{appointment.amount}
          </p>
          <p>
            <strong>Payment:</strong> {getPaymentStatus()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="card-actions justify-end mt-4 gap-2">
          {/* Video Call Button - Shows when appointment is ongoing */}
          {showVideoButton && (
            <a
              href={appointment.videoCallLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline gap-2"
            >
              Join Video Call
            </a>
          )}

          {/* Message Button */}
          <button
            className="btn btn-sm btn-primary"
            onClick={handleMessageClick}
            disabled={!recipientId}
          >
            Message {authUser?.role === "user" ? "Provider" : "Patient"}
          </button>

          {/* View Details Button */}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onViewDetails(appointment)}
          >
            View Details
          </button>

          {/* Report Button */}
          <button
            className="btn btn-sm btn-error"
            onClick={() => setIsReporting(true)}
          >
            Report Issue
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="alert alert-error mt-4">
            <span>{error}</span>
          </div>
        )}

        {/* Report Modal */}
        {isReporting && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg mb-4">Report Issue</h3>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Describe the issue..."
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                rows={4}
              />
              <div className="modal-action">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setIsReporting(false);
                    setComplaint("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-error"
                  onClick={handleReport}
                  disabled={reportLoading || !complaint.trim()}
                >
                  {reportLoading ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingAppointment;
