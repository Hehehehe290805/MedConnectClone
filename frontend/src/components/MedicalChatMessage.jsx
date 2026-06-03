import { useState, useEffect } from "react";
import { useMessageContext } from "stream-chat-react";
import { axiosInstance } from "../lib/axios";
import { MEDICAL_TERMS } from "../data/medicalTerms";
import TERM_ALIASES from "../data/termAliases.json";
import { DownloadIcon, FileIcon } from "lucide-react";
import FileDownloadModal from "./FileDownloadModal.jsx";

// Build the matching regex once at module level
const ALL_MATCHABLE = [
    ...Object.keys(MEDICAL_TERMS),
    ...Object.keys(TERM_ALIASES),
].sort((a, b) => b.length - a.length);

const TERM_REGEX = new RegExp(
    `\\b(${ALL_MATCHABLE.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
    "gi"
);

function annotateText(text) {
    if (!text) return null;
    const parts = [];
    let lastIndex = 0;
    let match;
    TERM_REGEX.lastIndex = 0;
    while ((match = TERM_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const key = match[0].toLowerCase();
        const canonical = TERM_ALIASES[key] || key;
        const info = MEDICAL_TERMS[canonical];
        parts.push(
            <span
                key={match.index}
                className="tooltip tooltip-bottom cursor-help border-b border-dotted border-primary/60"
                data-tip={info ? `${info.definition} · ${info.specialty}` : match[0]}
            >
                {match[0]}
            </span>
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
}

// Returns false if the translation is clearly bad: error strings, same as original, or empty.
function isUsableTranslation(translated, original) {
    if (!translated || translated.trim() === "") return false;
    if (translated.trim().toLowerCase() === original.trim().toLowerCase()) return false;
    // MyMemory error responses contain LANGPAIR= or INVALID
    if (translated.includes("LANGPAIR=") || translated.includes("INVALID") || translated.includes("EXAMPLE:")) return false;
    return true;
}


const MedicalChatMessage = ({ targetLang }) => {
    const { message, isMyMessage } = useMessageContext("MedicalChatMessage");

    const [translatedText, setTranslatedText] = useState(null);
    const [translating, setTranslating] = useState(false);
    const [showTranslation, setShowTranslation] = useState(false);
    const [fileDownload, setFileDownload] = useState(null); // { filename, url }

    useEffect(() => {
        setTranslatedText(null);
        setShowTranslation(false);
    }, [targetLang]);

    const isMine = isMyMessage();
    const text = message?.text || "";
    const senderName = message?.user?.name || "User";
    const createdAt = message?.created_at
        ? new Date(message.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
        : "";
    const attachments = message?.attachments || [];
    const images = attachments.filter(a => a.type === "image");
    const files  = attachments.filter(a => a.type === "file");

    const handleTranslate = async () => {
        if (translatedText) { setShowTranslation(prev => !prev); return; }
        setTranslating(true);
        try {
            const res = await axiosInstance.post("/chat/translate", { text, targetLang });
            const result = res.data.data?.translatedText || "";
            if (isUsableTranslation(result, text)) {
                setTranslatedText(result);
                setShowTranslation(true);
            } else {
                // Translation came back bad — don't show it, just stop quietly
                setTranslatedText(null);
            }
        } catch {
            // On failure, don't show anything
        } finally {
            setTranslating(false);
        }
    };

    if (message?.type === "system" || message?.type === "deleted") {
        return (
            <div className="text-center py-1">
                <span className="text-xs opacity-40">{text}</span>
            </div>
        );
    }

    const annotated = annotateText(text);

    return (
        <>
            {fileDownload && (
                <FileDownloadModal
                    filename={fileDownload.filename}
                    url={fileDownload.url}
                    onClose={() => setFileDownload(null)}
                />
            )}

            <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-4 py-1 group`}>
                <div className="max-w-[75%] space-y-1">
                    {!isMine && (
                        <p className="text-xs opacity-50 px-1">{senderName}</p>
                    )}

                    {/* Image attachments */}
                    {images.map((img, i) => (
                        <a
                            key={i}
                            href={img.image_url || img.asset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img
                                src={img.image_url || img.asset_url}
                                alt={img.title || "image"}
                                className="rounded-xl max-w-[240px] max-h-[240px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            />
                        </a>
                    ))}

                    {/* File attachments */}
                    {files.map((file, i) => (
                        <button
                            key={i}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm ${
                                isMine ? "bg-primary text-primary-content" : "bg-base-200"
                            }`}
                            onClick={() => setFileDownload({ filename: file.title || "file", url: file.asset_url })}
                        >
                            <FileIcon className="size-4 shrink-0" />
                            <span className="truncate max-w-[160px]">{file.title || "File"}</span>
                            <DownloadIcon className="size-3.5 shrink-0 opacity-60" />
                        </button>
                    ))}

                    {/* Text bubble — only render if there's actual text */}
                    {text && (
                        <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${
                            isMine ? "bg-primary text-primary-content rounded-br-sm" : "bg-base-200 rounded-bl-sm"
                        }`}>
                            {annotated}
                        </div>
                    )}

                    {/* Translation */}
                    {showTranslation && translatedText && (
                        <div className={`px-4 py-2 rounded-xl text-xs bg-base-300 italic opacity-80 ${
                            isMine ? "rounded-br-sm" : "rounded-bl-sm"
                        }`}>
                            <span className="opacity-60 not-italic mr-1">
                                {targetLang === "tl" ? "🇵🇭 Tagalog:" : targetLang === "ceb" ? "🇵🇭 Cebuano:" : "🇺🇸 English:"}
                            </span>
                            {translatedText}
                        </div>
                    )}

                    <div className={`flex items-center gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                        <span className="text-xs opacity-30">{createdAt}</span>
                        {text && (
                            <button
                                onClick={handleTranslate}
                                disabled={translating}
                                className="btn btn-ghost btn-xs h-5 min-h-0 px-1.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                                title="Translate message"
                            >
                                {translating
                                    ? <span className="loading loading-spinner loading-xs" />
                                    : <span className="text-xs">{showTranslation ? "🌐 Hide" : "🌐"}</span>
                                }
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MedicalChatMessage;
