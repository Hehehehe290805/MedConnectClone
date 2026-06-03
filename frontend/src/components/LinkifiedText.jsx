import { useState } from "react";
import { ExternalLinkIcon, XIcon } from "lucide-react";

// Matches http(s) URLs and bare email addresses
const LINK_PATTERN = /(https?:\/\/[^\s<>"{}|\\^[\]`]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const ConfirmModal = ({ display, href, isEmail, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
        <div
            className="bg-base-100 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ExternalLinkIcon className="size-5 text-warning" />
                    <h3 className="font-bold text-lg">Leaving MedConnect</h3>
                </div>
                <button className="btn btn-ghost btn-sm btn-circle" onClick={onCancel}>
                    <XIcon className="size-4" />
                </button>
            </div>
            <p className="text-sm opacity-70">
                {isEmail
                    ? "This will open your email client to compose to:"
                    : "Clicking this link will redirect you to an external website:"}
            </p>
            <p className="text-sm font-mono bg-base-200 rounded-lg p-3 break-all">{display}</p>
            <p className="text-xs opacity-40">MedConnect is not responsible for external content.</p>
            <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
                <button className="btn btn-primary flex-1" onClick={onConfirm}>Continue</button>
            </div>
        </div>
    </div>
);

// Renders plain text, auto-linking URLs and email addresses.
// Clicking a link shows a confirmation modal before navigating.
const LinkifiedText = ({ text, className }) => {
    const [pending, setPending] = useState(null);

    if (!text) return null;

    // Split text into plain/link segments
    const segments = [];
    let lastIndex = 0;
    LINK_PATTERN.lastIndex = 0;
    let match;

    while ((match = LINK_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
        }
        const raw = match[0];
        const isEmail = !raw.startsWith("http");
        segments.push({ type: "link", value: raw, href: isEmail ? `mailto:${raw}` : raw, isEmail });
        lastIndex = match.index + raw.length;
    }
    if (lastIndex < text.length) {
        segments.push({ type: "text", value: text.slice(lastIndex) });
    }

    return (
        <>
            <span className={className}>
                {segments.map((seg, i) =>
                    seg.type === "text" ? (
                        <span key={i}>{seg.value}</span>
                    ) : (
                        <a
                            key={i}
                            href={seg.href}
                            className="text-primary underline hover:opacity-75 transition-opacity"
                            onClick={(e) => {
                                e.preventDefault();
                                setPending(seg);
                            }}
                        >
                            {seg.value}
                        </a>
                    )
                )}
            </span>

            {pending && (
                <ConfirmModal
                    display={pending.value}
                    href={pending.href}
                    isEmail={pending.isEmail}
                    onConfirm={() => {
                        window.open(pending.href, "_blank", "noopener,noreferrer");
                        setPending(null);
                    }}
                    onCancel={() => setPending(null)}
                />
            )}
        </>
    );
};

export default LinkifiedText;
