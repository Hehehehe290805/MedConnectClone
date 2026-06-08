import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { BotIcon, XIcon, SendIcon, RefreshCwIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router";

const WELCOME = "Hi! I'm the MedConnect Assistant. Ask me how to use the platform, about appointments, payments, or anything else about MedConnect.";

const QUICK_PROMPTS = [
    "How do I book an appointment?",
    "What are the payment terms?",
    "How does 2FA work?",
    "Redirect me to pre-consultation",
];

const linkify = (text) => {
    // Convert /path references to clickable links
    const parts = text.split(/(\/[a-z\-]+(?:\/[a-z\-]+)*)/g);
    return parts.map((part, i) => {
        if (/^\/[a-z\-]/.test(part)) {
            return <Link key={i} to={part} className="link link-primary font-medium">{part}</Link>;
        }
        return part;
    });
};

const ChatbotWidget = () => {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
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
                    {messages.length === 1 && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                            {QUICK_PROMPTS.map((p) => (
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
