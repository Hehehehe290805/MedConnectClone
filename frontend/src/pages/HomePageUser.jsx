import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { axiosInstance } from "../lib/axios.js";
import { useQuery } from "@tanstack/react-query";
import AppointmentCalendar from "../components/AppointmentCalendar.jsx";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { ClockIcon, StethoscopeIcon, SearchIcon, VideoIcon, UsersIcon, CreditCardIcon, StarIcon, MessageCircleIcon, CalendarCheckIcon, CheckCircleIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const HomePageUser = () => {
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const isPending = authUser?.status === "pending";

  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const appointmentsLoadedRef = useRef(false);

  const fetchAppointments = async () => {
    try {
      if (!appointmentsLoadedRef.current) setLoading(true);
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
      appointmentsLoadedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    const id = setInterval(fetchAppointments, 30_000);
    return () => clearInterval(id);
  }, []);

  const joinCallAppt = appointments.find(a => {
    if (!a.virtual) return false;
    if (a.status === "ongoing") return true;
    if (a.status === "accepted") {
      const minsUntil = dayjs(a.start).tz(PH_TZ).diff(dayjs().tz(PH_TZ), "minute");
      return minsUntil <= 30 && minsUntil >= -5;
    }
    return false;
  });


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

  const doctorIdOf = (appt) => appt?.doctorId?._id || appt?.doctorId;
  const fmtAppt = (appt) => dayjs(appt.start).tz(PH_TZ).format("ddd, MMM D [at] h:mm A");

  // Pick the single most-urgent appointment to surface in the action banner.
  // Virtual ongoing is already handled by the Join Call banner above.
  const urgentBanner = (() => {
    if (!appointments.length) return null;
    const find = (fn) => appointments.find(fn);

    const awaitingBalance = find(a => a.status === "awaiting_balance");
    if (awaitingBalance) return { appt: awaitingBalance, type: "awaiting_balance" };

    const pendingPayment = find(a => a.status === "pending_payment");
    if (pendingPayment) return { appt: pendingPayment, type: "pending_payment" };

    const ongoingInPerson = find(a => a.status === "ongoing" && !a.virtual);
    if (ongoingInPerson) return { appt: ongoingInPerson, type: "ongoing" };

    const accepted = appointments
      .filter(a => a.status === "accepted")
      .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    if (accepted) return { appt: accepted, type: "accepted" };

    const depositPaid = find(a => a.status === "deposit_paid");
    if (depositPaid) return { appt: depositPaid, type: "deposit_paid" };

    const forReview = find(a =>
      ["fully_paid", "completed"].includes(a.status) && !a.rating
    );
    if (forReview) return { appt: forReview, type: "review" };

    return null;
  })();

  const renderActionBanner = () => {
    if (!urgentBanner) {
      return (
        <div className="card bg-primary/5 border border-primary/20 p-6 rounded-xl">
          <p className="font-bold text-lg mb-1">Book Now!</p>
          <p className="text-sm opacity-70 mb-4">Get matched with the right specialist, or search directly.</p>
          <div className="flex gap-3 flex-wrap">
            <Link to="/consultation" className="btn btn-primary gap-2">
              <StethoscopeIcon className="size-4" />Start Pre-Consultation
            </Link>
            <Link to="/search" className="btn btn-outline gap-2">
              <SearchIcon className="size-4" />Search Directly
            </Link>
          </div>
        </div>
      );
    }

    const { appt, type } = urgentBanner;
    const pid = doctorIdOf(appt);
    const dateStr = fmtAppt(appt);

    const CONFIGS = {
      awaiting_balance: {
        bg: "bg-warning/5 border-warning/30",
        icon: <CreditCardIcon className="size-5 text-warning shrink-0 mt-0.5" />,
        title: "Balance Payment Due",
        subtitle: `Your appointment on ${dateStr} is complete — pay the remaining 50%.`,
        actions: (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedAppointment(appt)}>View Details</button>
            <button
              className="btn btn-sm btn-warning"
              onClick={() => navigate(`/mock-payment?appointmentId=${appt._id}&type=balance&amount=${appt.balanceAmount}`)}
            >
              Pay ₱{appt.balanceAmount?.toLocaleString("en-PH")}
            </button>
          </>
        ),
      },
      pending_payment: {
        bg: "bg-primary/5 border-primary/20",
        icon: <CreditCardIcon className="size-5 text-primary shrink-0 mt-0.5" />,
        title: "Deposit Required",
        subtitle: `Confirm your appointment on ${dateStr} by paying the 50% deposit.`,
        actions: (
          <>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelectedAppointment(appt)}>View Details</button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => navigate(`/mock-payment?appointmentId=${appt._id}&type=deposit&amount=${appt.depositAmount}`)}
            >
              Pay ₱{appt.depositAmount?.toLocaleString("en-PH")}
            </button>
          </>
        ),
      },
      ongoing: {
        bg: "bg-info/5 border-info/30",
        icon: <CheckCircleIcon className="size-5 text-info shrink-0 mt-0.5" />,
        title: "Appointment In Progress",
        subtitle: `Your in-person appointment (${dateStr}) is currently ongoing.`,
        actions: (
          <>
            {pid && (
              <button className="btn btn-sm btn-ghost gap-1" onClick={() => navigate(`/chat/${pid}`)}>
                <MessageCircleIcon className="size-4" />Message
              </button>
            )}
            <button className="btn btn-sm btn-info btn-outline" onClick={() => setSelectedAppointment(appt)}>View Details</button>
          </>
        ),
      },
      accepted: {
        bg: "bg-success/5 border-success/30",
        icon: <CalendarCheckIcon className="size-5 text-success shrink-0 mt-0.5" />,
        title: "Upcoming Appointment",
        subtitle: `Confirmed for ${dateStr}.`,
        actions: (
          <>
            {pid && (
              <button className="btn btn-sm btn-ghost gap-1" onClick={() => navigate(`/chat/${pid}`)}>
                <MessageCircleIcon className="size-4" />Message Doctor
              </button>
            )}
            <button className="btn btn-sm btn-success btn-outline" onClick={() => setSelectedAppointment(appt)}>View Details</button>
          </>
        ),
      },
      deposit_paid: {
        bg: "bg-base-200/80 border-base-300",
        icon: <ClockIcon className="size-5 text-base-content/50 shrink-0 mt-0.5" />,
        title: "Waiting for Confirmation",
        subtitle: `Deposit received for your appointment on ${dateStr}. Awaiting provider confirmation.`,
        actions: (
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedAppointment(appt)}>View Details</button>
        ),
      },
      review: {
        bg: "bg-yellow-50/50 border-yellow-200",
        icon: <StarIcon className="size-5 text-yellow-500 fill-yellow-500 shrink-0 mt-0.5" />,
        title: "Leave a Review",
        subtitle: "How was your recent appointment? Your feedback helps other patients.",
        actions: (
          <button className="btn btn-sm btn-warning btn-outline" onClick={() => setSelectedAppointment(appt)}>Write a Review</button>
        ),
      },
    };

    const cfg = CONFIGS[type];
    return (
      <div className={`card border p-5 rounded-xl ${cfg.bg}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            {cfg.icon}
            <div>
              <p className="font-bold">{cfg.title}</p>
              <p className="text-sm opacity-70 mt-0.5">{cfg.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            {cfg.actions}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8">
      {joinCallAppt && (
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
          <Link to={`/call/${joinCallAppt._id}`} className="btn btn-success btn-sm gap-2 shrink-0">
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

      {renderActionBanner()}

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
