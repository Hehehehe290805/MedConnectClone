import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { VideoIcon, ClockIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import useAuthUser from "../hooks/useAuthUser";

const JOIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const VirtualJoinPrompt = () => {
    const { authUser } = useAuthUser();
    const navigate = useNavigate();
    const [secondsLeft, setSecondsLeft] = useState(null);
    const canHaveVirtual = ["patient", "doctor", "department"].includes(authUser?.role);

    const { data } = useQuery({
        queryKey: ["myAppointments"],
        queryFn: () => axiosInstance.get("/booking/my-appointments").then(r => r.data?.data?.appointments || []),
        enabled: Boolean(authUser && canHaveVirtual),
        refetchInterval: 15_000,
        staleTime: 10_000,
    });

    // Find an ongoing virtual appointment that the current user hasn't joined yet
    const appt = data?.find(a => {
        if (a.status !== "ongoing" || !a.virtual) return false;
        const isPatient  = a.patientId?._id === authUser?._id || a.patientId === authUser?._id;
        const isProvider = a.doctorId?._id === authUser?._id   || a.doctorId === authUser?._id  ||
                           a.instituteId?._id === authUser?._id || a.instituteId === authUser?._id;
        if (isPatient  && a.patientJoined)  return false;
        if (isProvider && a.providerJoined) return false;
        return isPatient || isProvider;
    });

    // Countdown timer
    useEffect(() => {
        if (!appt) { setSecondsLeft(null); return; }
        const calcRemaining = () => {
            const elapsed = Date.now() - new Date(appt.start).getTime();
            return Math.max(0, Math.round((JOIN_WINDOW_MS - elapsed) / 1000));
        };
        setSecondsLeft(calcRemaining());
        const interval = setInterval(() => setSecondsLeft(calcRemaining()), 1000);
        return () => clearInterval(interval);
    }, [appt?._id, appt?.start]);

    if (!appt || secondsLeft === null) return null;

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    const isUrgent = secondsLeft <= 60;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-base-100 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="bg-primary p-5 text-primary-content text-center">
                    <VideoIcon className="size-10 mx-auto mb-2" />
                    <h2 className="text-xl font-bold">Your Appointment Has Started</h2>
                    <p className="text-sm opacity-80 mt-1">Virtual appointment — join the video call now</p>
                </div>

                <div className="p-6 space-y-4">
                    <div className={`flex items-center justify-center gap-2 text-2xl font-mono font-bold ${isUrgent ? "text-error" : "text-base-content"}`}>
                        <ClockIcon className={`size-6 ${isUrgent ? "text-error" : "opacity-60"}`} />
                        {timeStr}
                    </div>
                    <p className="text-sm text-center opacity-60">
                        {secondsLeft > 0
                            ? "Join before the timer runs out or the missed-appointment rules will apply."
                            : "Time is up. The appointment may be cancelled shortly."}
                    </p>

                    <button
                        className="btn btn-primary w-full gap-2 text-base"
                        onClick={() => navigate(`/call/${appt._id}`)}
                    >
                        <VideoIcon className="size-5" />
                        Join Video Call
                    </button>

                    <p className="text-xs text-center opacity-40">
                        This prompt cannot be dismissed until you join or the appointment is resolved.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VirtualJoinPrompt;
