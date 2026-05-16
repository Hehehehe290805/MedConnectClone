import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios.js";
import PendingAppointment from "../components/PendingAppointment.jsx";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";

const HomePageUser = ({ currentUser }) => {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch appointments for the logged-in patient
  useEffect(() => {
    const fetchUserAppointments = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axiosInstance.get("/booking/user-appointments");


        if (res.data.success && Array.isArray(res.data.appointments)) {
          const validStatuses = [
            "pending_accept", "awaiting_deposit",
            "booked", "confirmed", "ongoing",
            "marked_complete", "completed",
            "fully_paid", "confirm_fully_paid",
            "no_show_patient", "no_show_doctor", "no_show_both",
            "cancelled_unpaid", "cancelled", "rejected", "freeze"
          ];

          const filteredAppointments = res.data.appointments
            .filter(a => validStatuses.includes(a.status))
            .sort((a, b) => new Date(a.start) - new Date(b.start));

          setAppointments(filteredAppointments);
        } else {
          setAppointments([]);
        }
      } catch (err) {
        setError("Failed to load appointments.");
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAppointments();
  }, []);

  // Update a single appointment in state
  const handleAppointmentUpdated = (appointmentId, newStatus, depositRef) => {
    setAppointments(prev =>
      prev.map(a =>
        a._id === appointmentId ? { ...a, status: newStatus, depositRef } : a
      )
    );
  };

  const openAppointmentModal = (appointment) => setSelectedAppointment(appointment);
  const closeAppointmentModal = () => setSelectedAppointment(null);

  // Appointment groups for display
  const groups = {
    "Booking Level": ["pending_accept", "awaiting_deposit"],
    "Deposit Level": ["booked", "confirmed"],
    "Ongoing Appointments": ["ongoing"],
    "Completed Appointments": [
      "marked_complete", "completed",
      "fully_paid", "confirm_fully_paid",
      "no_show_doctor", "no_show_patient", "no_show_both"
    ],
    "Cancelled Appointments": ["cancelled", "cancelled_unpaid", "rejected"],
    "Reported Appointments": ["freeze"],
  };

  // Render each group of appointments
  const renderAppointmentGroup = (title, statuses, badgeColor) => {
    const groupAppointments = appointments.filter(a => statuses.includes(a.status));

    return (
      <section key={title} className="border rounded shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <span className={`badge ${badgeColor}`}>{groupAppointments.length}</span>
        </div>

        {groupAppointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No appointments in this group.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {groupAppointments.map(appointment => (
              <PendingAppointment
                key={appointment._id}
                appointment={appointment}
                onAppointmentUpdated={handleAppointmentUpdated}
                onViewDetails={openAppointmentModal}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  // Patient-only popup component
  const getPopupComponent = () => {
    if (!selectedAppointment) return null;

    return (
      <ViewPendingAppointmentPatientPopup
        appointment={selectedAppointment}
        onClose={closeAppointmentModal}
        onAppointmentUpdated={handleAppointmentUpdated}
      />
    );
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome to MedConnect</h1>
        <p className="mt-2 text-gray-600">User Dashboard</p>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {renderAppointmentGroup("Booking Level", groups["Booking Level"], "badge-warning")}
          {renderAppointmentGroup("Deposit Level", groups["Deposit Level"], "badge-primary")}
          {renderAppointmentGroup("Ongoing Appointments", groups["Ongoing Appointments"], "badge-secondary")}
          {renderAppointmentGroup("Completed Appointments", groups["Completed Appointments"], "badge-success")}
          {renderAppointmentGroup("Cancelled Appointments", groups["Cancelled Appointments"], "badge-error")}
          {renderAppointmentGroup("Reported Appointments", groups["Reported Appointments"], "badge-neutral")}
        </>
      )}

      {selectedAppointment && getPopupComponent()}
    </div>
  );
};

export default HomePageUser;
