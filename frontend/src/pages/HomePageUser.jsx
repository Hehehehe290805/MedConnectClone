import { useEffect, useState } from "react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios.js";
import { useQuery } from "@tanstack/react-query";
import AppointmentCalendar from "../components/AppointmentCalendar.jsx";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { ClockIcon, StethoscopeIcon, SearchIcon, VideoIcon, UsersIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

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

  const joinCallAppt = appointments.find(a => {
    if (!a.virtual) return false;
    if (a.status === "ongoing") return true;
    if (a.status === "accepted") {
      const minsUntil = dayjs(a.start).tz(PH_TZ).diff(dayjs().tz(PH_TZ), "minute");
      return minsUntil <= 30 && minsUntil >= -5;
    }
    return false;
  });

  const callPartnerId = joinCallAppt
    ? (joinCallAppt.doctorId?._id || joinCallAppt.doctorId)
    : null;

  // Queue position — poll for the earliest accepted/ongoing appointment today
  const todayAppt = appointments.find(a =>
    ["accepted", "ongoing"].includes(a.status) &&
    !a.virtual &&
    dayjs(a.start).tz(PH_TZ).isSame(dayjs().tz(PH_TZ), "day")
  );

  const { data: queuePositionData } = useQuery({
    queryKey: ["queue-position", todayAppt?._id],
    queryFn: () =>
      axiosInstance.get(`/queue/position?appointmentId=${todayAppt._id}`)
        .then(r => r.data.data),
    enabled: Boolean(todayAppt?._id),
    refetchInterval: 60_000,  // poll every 60 seconds
  });

  const queuePos = queuePositionData?.position;
  const queueAhead = queuePositionData?.ahead;

  return (
    <div className="p-8 space-y-8">
      {joinCallAppt && callPartnerId && (
        <div className="alert bg-success/10 border border-success/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VideoIcon className="size-5 text-success shrink-0" />
            <div>
              <p className="font-semibold">
                {joinCallAppt.status === "ongoing"
                  ? "Your virtual appointment is in progress!"
                  : "Your virtual appointment starts soon!"}
              </p>
              <p className="text-sm opacity-70">
                {dayjs(joinCallAppt.start).tz(PH_TZ).format("ddd, MMM D [at] h:mm A")}
              </p>
            </div>
          </div>
          <Link to={`/call/${callPartnerId}`} className="btn btn-success btn-sm gap-2 shrink-0">
            <VideoIcon className="size-4" /> Join Call
          </Link>
        </div>
      )}

      {queuePos != null && (
        <div className="alert bg-info/10 border border-info/30 flex items-center gap-4">
          <UsersIcon className="size-5 text-info shrink-0" />
          <div>
            <p className="font-semibold">
              You are <span className="text-info font-bold">#{queuePos}</span> in the queue
            </p>
            <p className="text-sm opacity-70">
              {queueAhead === 0
                ? "You're next — please check in with the provider!"
                : `${queueAhead} patient${queueAhead === 1 ? "" : "s"} ahead of you`}
            </p>
          </div>
        </div>
      )}

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
