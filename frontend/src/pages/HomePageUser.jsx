import { useEffect, useState } from "react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios.js";
import AppointmentCalendar from "../components/AppointmentCalendar.jsx";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { ClockIcon, StethoscopeIcon, SearchIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";

const HomePageUser = () => {
  const { authUser } = useAuthUser();
  const isPending = authUser?.status === "pending";

  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axiosInstance.get("/booking/my-appointments");
      const appts = res.data.data?.appointments;
      if (res.data.success && Array.isArray(appts)) {
        setAppointments(appts.sort((a, b) => new Date(a.start) - new Date(b.start)));
      } else {
        setAppointments([]);
      }
    } catch {
      setError("Failed to load appointments.");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, []);

  return (
    <div className="p-8 space-y-8">
      {isPending && (
        <div className="alert bg-warning/10 border border-warning/30">
          <ClockIcon className="size-5 text-warning" />
          <div>
            <p className="font-semibold">Your account is pending approval</p>
            <p className="text-sm opacity-70">Our team is reviewing your information.</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Welcome to MedConnect</h1>
      </div>

      <div className="card bg-primary/5 border border-primary/20 p-6 rounded-xl">
        <p className="font-bold text-lg mb-1">Book Now!</p>
        <p className="text-sm opacity-70 mb-4">Get matched with the right specialist, or search directly.</p>
        <div className="flex gap-3 flex-wrap">
          <Link to="/consultation" className="btn btn-primary gap-2">
            <StethoscopeIcon className="size-4" />
            Start Pre-Consultation
          </Link>
          <Link to="/search" className="btn btn-outline gap-2">
            <SearchIcon className="size-4" />
            Search Directly
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error"><span>{error}</span></div>}

      <AppointmentCalendar
        appointments={appointments}
        onViewDetails={setSelectedAppointment}
        isLoading={loading}
      />

      {selectedAppointment && (
        <ViewPendingAppointmentPatientPopup
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdated={fetchAppointments}
        />
      )}
    </div>
  );
};

export default HomePageUser;
