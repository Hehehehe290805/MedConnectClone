import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { axiosInstance } from "../lib/axios";
import useCallStore from "../store/useCallStore";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  ScreenShareButton,
  CancelCallButton,
  ReactionsButton,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import { VideoIcon, WifiOffIcon } from "lucide-react";

const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(value || "");
const CALL_JOIN_TIMEOUT_MS = 45000;

function getDisplayName(user) {
  if (!user) return "User";
  if (user.role === "pharmacy") return user.pharmacyName || "Pharmacy";
  if (user.role === "institute") return user.instituteName || "Institute";
  if (user.role === "department") {
    return `${user.technologistFirstName || ""} ${user.technologistLastName || ""}`.trim() || "Department";
  }
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
}

const withTimeout = (promise, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), CALL_JOIN_TIMEOUT_MS);
    }),
  ]);

const CallPage = () => {
  const { id: callId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callError, setCallError] = useState("");

  const { authUser, isLoading } = useAuthUser();
  const { setActiveCallId, clearActiveCallId } = useCallStore();

  // Auth check for compound channel IDs (format: "userId1-userId2").
  // Single-ID calls from the Join Call banner are already gated by the home page.
  const callParts = callId?.includes("-") ? callId.split("-") : null;
  const isCompoundId = callParts?.length === 2 && callParts.every(p => /^[a-f0-9]{24}$/.test(p));
  const isUnauthorized = isCompoundId && !!authUser && !callParts.includes(authUser._id);

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
    staleTime: 55 * 60 * 1000,
  });

  useEffect(() => {
    let cancelled = false;
    let videoClient;
    let callInstance;

    const initCall = async () => {
      const token = tokenData?.data?.token;
      const apiKey = tokenData?.data?.apiKey;
      if (!token || !apiKey || !authUser || !callId) return;

      setIsConnecting(true);
      setCallError("");
      try {
        const user = {
          id: authUser._id,
          name: getDisplayName(authUser),
          image: authUser.profilePic?.url || undefined,
        };

        videoClient = new StreamVideoClient({ apiKey });

        await withTimeout(
          videoClient.connectUser(user, token),
          "Video user session could not be connected. Please try again."
        );

        callInstance = videoClient.call("default", callId);

        await withTimeout(
          callInstance.getOrCreate({
            data: {
              members: [{ user_id: authUser._id }],
              custom: { source: "medconnect" },
            },
          }),
          "Video room could not be prepared. Please try again."
        );

        await withTimeout(
          callInstance.join({ create: false, maxJoinRetries: 3 }),
          "Video room took too long to connect. Please try again."
        );

        if (cancelled) {
          await callInstance.leave().catch(() => {});
          await videoClient.disconnectUser(1000).catch(() => {});
          return;
        }

        setClient(videoClient);
        setCall(callInstance);
        setActiveCallId(callId);
      } catch (error) {
        console.error("Error joining call:", error);
        const message = error?.message || "Could not join the call. Please check your connection and try again.";
        setCallError(message);
        toast.error("Could not join the call. Please try again.");
        await callInstance?.leave?.().catch(() => {});
        await videoClient?.disconnectUser?.(1000).catch(() => {});
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    initCall();

    return () => {
      cancelled = true;
      clearActiveCallId();
      callInstance?.leave?.().catch(() => {});
      videoClient?.disconnectUser?.(1000).catch(() => {});
    };
  }, [tokenData, authUser, callId, setActiveCallId, clearActiveCallId]);

  if (isLoading || isConnecting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary">
            <VideoIcon className="size-7" />
          </div>
          <p className="text-xl font-bold">Preparing your call</p>
          <p className="mt-2 text-sm text-white/70">Connecting securely to the MedConnect video room.</p>
          <span className="loading loading-spinner loading-md text-primary mt-5" />
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-center p-4">
        <p className="text-2xl font-bold">Access Denied</p>
        <p className="opacity-60 max-w-sm">You are not a participant in this call.</p>
        <button className="btn btn-primary" onClick={() => window.close() || (window.location.href = "/")}>
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary">
            <VideoIcon className="size-5" />
          </div>
          <div>
            <p className="font-bold">MedConnect Video Call</p>
            <p className="text-xs text-white/60">Private appointment room</p>
          </div>
        </div>
        <button className="btn btn-sm btn-ghost text-white" onClick={() => window.location.href = "/"}>
          Back
        </button>
      </div>
      <div className="relative flex-1">
        {client && call ? (
          <StreamVideo client={client}>
            <StreamCall call={call}>
              <CallContent appointmentId={isObjectId(callId) ? callId : null} />
            </StreamCall>
          </StreamVideo>
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <div className="max-w-sm rounded-2xl border border-white/10 bg-white/10 p-6 text-center shadow-2xl">
              <WifiOffIcon className="mx-auto mb-3 size-10 text-error" />
              <p className="text-xl font-bold">Call unavailable</p>
              <p className="mt-2 text-sm text-white/70">{callError || "Could not initialize call. Please refresh or try again later."}</p>
              <button className="btn btn-primary btn-sm mt-5" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CallContent = ({ appointmentId }) => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { clearActiveCallId } = useCallStore();
  const navigate = useNavigate();
  const markedJoinedRef = useRef(false);

  useEffect(() => {
    if (!appointmentId || markedJoinedRef.current || callingState !== CallingState.JOINED) return;

    markedJoinedRef.current = true;
    axiosInstance.post("/booking/join-call", { appointmentId }).catch((error) => {
      markedJoinedRef.current = false;
      toast.error(error?.response?.data?.message || "Could not mark call attendance.");
    });
  }, [appointmentId, callingState]);

  useEffect(() => {
    if (callingState !== CallingState.LEFT) return;
    clearActiveCallId();
    navigate("/");
  }, [callingState, clearActiveCallId, navigate]);

  return (
    <StreamTheme>
      <SpeakerLayout />
      {/* Custom controls — recording excluded intentionally */}
      <div className="str-video__call-controls">
        <ReactionsButton />
        <ScreenShareButton />
        <ToggleAudioPublishingButton />
        <ToggleVideoPublishingButton />
        <CancelCallButton />
      </div>
    </StreamTheme>
  );
};

export default CallPage;
