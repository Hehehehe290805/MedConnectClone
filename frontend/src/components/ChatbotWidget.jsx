import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { BotIcon, XIcon, SendIcon, RefreshCwIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router";
import useAuthUser from "../hooks/useAuthUser";

const WELCOME = "Hi! I'm the MedConnect Assistant. Ask me how to use the platform, about appointments, payments, or anything else about MedConnect.";

const QUICK_PROMPTS_BY_ROLE = {
    patient: [
        "How do I book an appointment?",
        "What are the payment terms?",
        "How does the pre-consultation wizard work?",
        "How do I cancel or dispute an appointment?",
    ],
    doctor: [
        "How do I set my schedule and pricing?",
        "How do I accept or reject an appointment?",
        "How does the queue system work?",
        "How do I renew my license?",
    ],
    pharmacy: [
        "How does prescription review work?",
        "How do I manage my catalogue?",
        "How does the order fulfillment flow work?",
        "How do I renew my FDA license?",
    ],
    institute: [
        "How do I create department sub-accounts?",
        "How do I view my transactions?",
        "How do I renew my business permit?",
        "What's the difference between a clinic and a hospital?",
    ],
    department: [
        "How do I claim services?",
        "How does the appointment queue work?",
        "How do I accept or reject a booking?",
        "How do I renew my technologist license?",
    ],
    admin: [
        "How do I approve or reject pending accounts?",
        "How do I resolve a dispute?",
        "How do I manage specialties and services?",
        "How does permit renewal approval work?",
    ],
};

const FOLLOW_UPS_BY_TOPIC = [
    {
        keywords: ["pharmacy", "medicine", "cart", "prescription", "catalogue", "delivery", "pickup", "order"],
        prompts: [
            "How does prescription review work?",
            "How do I track a pharmacy order?",
            "What fees are added to pharmacy checkout?",
            "How do I edit my cart before checkout?",
        ],
    },
    {
        keywords: ["appointment", "book", "booking", "doctor", "schedule", "deposit", "balance", "cancel", "missed"],
        prompts: [
            "How do I book an appointment?",
            "What happens if I miss a virtual appointment?",
            "How do appointment payments work?",
            "Where can I see my appointment history?",
        ],
    },
    {
        keywords: ["payment", "fee", "refund", "transaction", "receipt", "sales", "revenue", "analytics"],
        prompts: [
            "Where can I view my transactions?",
            "How are platform fees handled?",
            "When can a refund happen?",
            "How does admin analytics work?",
        ],
    },
    {
        keywords: ["report", "dispute", "complaint", "admin", "resolve"],
        prompts: [
            "How do I file a report?",
            "Who reviews appointment disputes?",
            "What happens after admin resolves a report?",
            "Where can admins view reports?",
        ],
    },
    {
        keywords: ["license", "permit", "renew", "renewal", "fda", "prc", "claim", "specialty", "service"],
        prompts: [
            "How do I renew a license or permit?",
            "How does admin approve claims?",
            "How do doctors claim specialties?",
            "How do departments claim services?",
        ],
    },
    {
        keywords: ["chat", "video", "call", "stream", "message"],
        prompts: [
            "When can I join a video call?",
            "Where do I open appointment chat?",
            "What should I do if video call fails?",
            "Who can use chat and video?",
        ],
    },
    {
        keywords: ["settings", "profile", "bio", "photo", "password", "email", "2fa", "account"],
        prompts: [
            "How do I update my profile?",
            "How do I change my password?",
            "How do I enable two-factor authentication?",
            "How do I delete my account?",
        ],
    },
];

const buildFollowUpPrompts = (latestUserMessage, fallbackPrompts) => {
    const normalized = latestUserMessage.toLowerCase();
    const matched = FOLLOW_UPS_BY_TOPIC.find(topic =>
        topic.keywords.some(keyword => normalized.includes(keyword))
    );

    return [...new Set(matched?.prompts ?? fallbackPrompts)].slice(0, 4);
};

const linkify = (text) => {
    // Convert /path references to clickable links
    const parts = text.split(/(\/[a-z-]+(?:\/[a-z-]+)*)/g);
    return parts.map((part, i) => {
        if (/^\/[a-z-]/.test(part)) {
            return <Link key={i} to={part} className="link link-primary font-medium">{part}</Link>;
        }
        return part;
    });
};

const ChatbotWidget = () => {
    const { authUser } = useAuthUser();
    const quickPrompts = QUICK_PROMPTS_BY_ROLE[authUser?.role] ?? QUICK_PROMPTS_BY_ROLE.patient;
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [promptsHidden, setPromptsHidden] = useState(false);
    const [messages, setMessages] = useState([
        { role: "assistant", content: WELCOME },
    ]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    const { mutate: sendMessage, isPending } = useMutation({
        mutationFn: ({ message, history }) =>
            axiosInstance.post("/chatbot/message", { message, history }).then(r => r.data.data),
        onSuccess: ({ reply }) => {
            setMessages(prev => [...prev, { role: "assistant", content: reply }]);
            setTimeout(() => inputRef.current?.focus(), 0);
        },
        onError: (err) => {
            const msg = err?.response?.data?.message || "Chatbot unavailable.";
            if (err?.response?.status === 429) {
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: "You've reached the 20 message/hour limit. Please try again later.",
                    isError: true,
                }]);
            } else {
                toast.error(msg);
            }
        },
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const handleSend = (text) => {
        const msg = (text || input).trim();
        if (!msg || isPending) return;
        setInput("");
        const newMessages = [...messages, { role: "user", content: msg }];
        setMessages(newMessages);
        const history = newMessages.slice(-9, -1).map(m => ({ role: m.role, content: m.content }));
        sendMessage({ message: msg, history });
    };

    const handleReset = () => {
        setMessages([{ role: "assistant", content: WELCOME }]);
        setInput("");
    };

    const showInitialPrompts = messages.length === 1;
    const showFollowUpPrompts = !isPending && messages.length > 1 && messages[messages.length - 1]?.role === "assistant";
    const promptLabel = showInitialPrompts ? "Try asking:" : "Ask another question:";
    const latestUserMessage = useMemo(
        () => [...messages].reverse().find(m => m.role === "user")?.content ?? "",
        [messages]
    );
    const visiblePrompts = useMemo(
        () => showInitialPrompts ? quickPrompts : buildFollowUpPrompts(latestUserMessage, quickPrompts),
        [latestUserMessage, quickPrompts, showInitialPrompts]
    );

    return (
        <>
            {/* Floating button */}
            <button
                className="fixed bottom-6 right-6 z-50 btn btn-primary btn-circle shadow-lg size-14"
                onClick={() => setOpen(o => !o)}
                aria-label="Open MedConnect Assistant"
            >
                {open ? <XIcon className="size-6" /> : <BotIcon className="size-6" />}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col bg-base-100 rounded-2xl shadow-2xl border border-base-300 overflow-hidden"
                    style={{ maxHeight: "70vh" }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-content">
                        <div className="flex items-center gap-2">
                            <BotIcon className="size-5" />
                            <div>
                                <p className="font-semibold text-sm leading-none">MedConnect Assistant</p>
                                <p className="text-xs opacity-70">20 messages/hour • Not medical advice</p>
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-xs btn-circle text-primary-content" onClick={handleReset} title="Reset conversation">
                            <RefreshCwIcon className="size-3.5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                                    m.role === "user"
                                        ? "bg-primary text-primary-content rounded-br-sm"
                                        : m.isError
                                            ? "bg-error/10 text-error border border-error/20 rounded-bl-sm"
                                            : "bg-base-200 text-base-content rounded-bl-sm"
                                }`}>
                                    {m.role === "assistant" ? linkify(m.content) : m.content}
                                </div>
                            </div>
                        ))}
                        {isPending && (
                            <div className="flex justify-start">
                                <div className="bg-base-200 rounded-2xl rounded-bl-sm px-4 py-3">
                                    <span className="loading loading-dots loading-sm" />
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Quick prompts — show only when just welcome message */}
                    {(showInitialPrompts || showFollowUpPrompts) && (
                        <div className="px-3 pb-2">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
                                    {promptLabel}
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs h-6 min-h-0 px-2 text-base-content/60"
                                    onClick={() => setPromptsHidden(hidden => !hidden)}
                                    title={promptsHidden ? "Show suggested questions" : "Hide suggested questions"}
                                >
                                    {promptsHidden ? <EyeIcon className="size-3.5" /> : <EyeOffIcon className="size-3.5" />}
                                    {promptsHidden ? "Show" : "Hide"}
                                </button>
                            </div>
                            {!promptsHidden && (
                                <div className="flex flex-wrap gap-1.5">
                                    {visiblePrompts.map((p) => (
                                        <button
                                            key={p}
                                            className="btn btn-xs btn-outline rounded-full"
                                            onClick={() => handleSend(p)}
                                            disabled={isPending}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    <div className="flex gap-2 p-3 border-t border-base-300">
                        <input
                            ref={inputRef}
                            type="text"
                            className="input input-bordered input-sm flex-1 text-sm"
                            placeholder="Ask something…"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                            disabled={isPending}
                        />
                        <button
                            className="btn btn-primary btn-sm btn-circle"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isPending}
                        >
                            <SendIcon className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotWidget;
