import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { axiosInstance } from "../lib/axios";
import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import CallButton from "../components/CallButton";
import MedicalChatMessage from "../components/MedicalChatMessage";

const LANG_OPTIONS = [
  { code: "tl",  label: "Tagalog" },
  { code: "ceb", label: "Cebuano" },
  { code: "en",  label: "English" },
];

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

function getDisplayName(user) {
    if (!user) return "User";
    if (user.role === "institute")  return user.instituteName || "Institute";
    if (user.role === "pharmacy")   return user.pharmacyName || `${user.pharmacistFirstName || ""} ${user.pharmacistLastName || ""}`.trim() || "Pharmacy";
    if (user.role === "department") return `${user.technologistFirstName || ""} ${user.technologistLastName || ""}`.trim() || "Department";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
}

const ChatPage = () => {
    const { id: targetUserId } = useParams();

    const [chatClient, setChatClient] = useState(null);
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [chatError, setChatError] = useState(null); // stores the error message string
    const [targetLang, setTargetLang] = useState("tl");

    const { authUser } = useAuthUser();

    const { data: tokenData } = useQuery({
        queryKey: ["streamToken"],
        queryFn: getStreamToken,
        enabled: !!authUser,
        staleTime: 55 * 60 * 1000,
    });

    // Check for an active ongoing virtual appointment with this specific chat partner.
    // Used to enable/disable the video call button.
    const { data: appointments } = useQuery({
        queryKey: ["myAppointments"],
        queryFn: () => axiosInstance.get("/booking/my-appointments").then(r => r.data?.data?.appointments || []),
        enabled: !!authUser,
        refetchInterval: 30_000,
        staleTime: 15_000,
    });

    const hasOngoingCall = useMemo(() => {
        if (!appointments || !targetUserId) return false;
        return appointments.some(a => {
            if (a.status !== "ongoing" || !a.virtual) return false;
            const doctorId  = a.doctorId?._id  || a.doctorId;
            const patientId = a.patientId?._id || a.patientId;
            return doctorId === targetUserId || patientId === targetUserId;
        });
    }, [appointments, targetUserId]);

    useEffect(() => {
        let cancelled = false;

        const initChat = async () => {
            const token = tokenData?.data?.token;
            if (!token || !authUser) return;

            setChatError(null);

            try {
                const client = StreamChat.getInstance(STREAM_API_KEY);

                // Always attempt connectUser. In React Strict Mode the effect fires twice
                // before the first connectUser resolves, so Stream throws "connectUser was
                // called twice". We swallow that specific error: if userID ended up set to
                // our user the first call won and we can proceed to channel setup.
                try {
                    await client.connectUser(
                        {
                            id: authUser._id,
                            name: getDisplayName(authUser),
                            image: authUser.profilePic?.url || undefined,
                        },
                        token
                    );
                } catch (connErr) {
                    if (client.userID !== authUser._id) throw connErr;
                    // else: first concurrent call succeeded — continue
                }

                if (cancelled) return;

                const channelId = [authUser._id, targetUserId].sort().join("-");
                const currChannel = client.channel("messaging", channelId, {
                    members: [authUser._id, targetUserId],
                });
                await currChannel.watch();

                if (!cancelled) {
                    setChatClient(client);
                    setChannel(currChannel);
                }
            } catch (error) {
                console.error("Stream chat error:", error);
                if (!cancelled) {
                    const msg = error?.message || error?.response?.data?.message || String(error);
                    setChatError(msg);
                }
            } finally {
                // Always clear the loading flag. React 18 silently ignores state
                // updates on unmounted components so this is safe even after cleanup.
                setLoading(false);
            }
        };

        initChat();

        return () => {
            cancelled = true;
        };
    }, [tokenData, authUser, targetUserId]);

    const handleVideoCall = () => {
        if (channel) {
            window.open(`/call/${channel.id}`, "_blank", "noopener,noreferrer");
        }
    };

    if (chatError) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 p-4 max-w-md mx-auto text-center">
                <p className="font-semibold">Could not connect to chat</p>
                <p className="text-xs font-mono bg-base-200 rounded-lg px-3 py-2 break-all opacity-70">{chatError}</p>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                        const client = StreamChat.getInstance(STREAM_API_KEY);
                        if (client.userID) client.disconnectUser().catch(() => {});
                        window.location.reload();
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    if (loading || !chatClient || !channel) return <ChatLoader />;

    return (
        <div className="h-[93vh]">
            <Chat client={chatClient}>
                <Channel channel={channel}>
                    <div className="w-full relative">
                        {["doctor", "patient"].includes(authUser?.role) && (
                            <CallButton handleVideoCall={handleVideoCall} disabled={!hasOngoingCall} />
                        )}
                        <Window>
                            <ChannelHeader />
                            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-base-200 bg-base-100">
                                <span className="text-xs opacity-40 mr-1">Translate to:</span>
                                {LANG_OPTIONS.map(({ code, label }) => (
                                    <button
                                        key={code}
                                        onClick={() => setTargetLang(code)}
                                        className={`badge cursor-pointer text-xs transition-colors ${
                                            targetLang === code ? "badge-primary" : "badge-ghost hover:badge-neutral"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <MessageList
                                Message={() => (
                                    <MedicalChatMessage targetLang={targetLang} />
                                )}
                            />
                            <MessageInput focus />
                        </Window>
                    </div>
                    <Thread />
                </Channel>
            </Chat>
        </div>
    );
};

export default ChatPage;
