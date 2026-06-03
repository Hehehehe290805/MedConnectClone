import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { FileIcon, DownloadIcon, ImageIcon } from "lucide-react";
import FileDownloadModal from "./FileDownloadModal.jsx";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const ChatAttachmentsSection = ({ appointmentId }) => {
    const [fileDownload, setFileDownload] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ["chatAttachments", appointmentId],
        queryFn: () => axiosInstance
            .get(`/chat/appointment-attachments?appointmentId=${appointmentId}`)
            .then(r => r.data?.data?.attachments || []),
        enabled: Boolean(appointmentId),
        staleTime: 2 * 60 * 1000,
    });

    const attachments = data || [];
    const images = attachments.filter(a => a.type === "image");
    const files  = attachments.filter(a => a.type === "file");

    if (isLoading) {
        return (
            <div className="pt-2 border-t border-base-300">
                <p className="text-xs font-semibold opacity-50 mb-2">Chat Attachments</p>
                <span className="loading loading-spinner loading-xs" />
            </div>
        );
    }

    if (!attachments.length) return null;

    return (
        <>
            {fileDownload && (
                <FileDownloadModal
                    filename={fileDownload.filename}
                    url={fileDownload.url}
                    onClose={() => setFileDownload(null)}
                />
            )}

            {/* Full-size image lightbox */}
            {expandedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={expandedImage}
                        alt="attachment"
                        className="max-w-full max-h-full rounded-xl object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            <div className="pt-2 border-t border-base-300 space-y-2">
                <p className="text-xs font-semibold opacity-50">Shared in Chat</p>

                {images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {images.map((img, i) => (
                            <button
                                key={i}
                                onClick={() => setExpandedImage(img.url)}
                                className="relative group"
                                title={img.senderName}
                            >
                                <img
                                    src={img.url}
                                    alt={img.title}
                                    className="w-16 h-16 rounded-lg object-cover border border-base-300 hover:opacity-80 transition-opacity"
                                />
                                <ImageIcon className="absolute bottom-1 right-1 size-3 text-white drop-shadow" />
                            </button>
                        ))}
                    </div>
                )}

                {files.map((file, i) => (
                    <button
                        key={i}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-base-200 hover:bg-base-300 transition-colors text-sm"
                        onClick={() => setFileDownload({ filename: file.title, url: file.url })}
                    >
                        <FileIcon className="size-4 shrink-0 opacity-60" />
                        <span className="flex-1 truncate">{file.title}</span>
                        <span className="text-xs opacity-40 shrink-0">
                            {dayjs(file.sentAt).tz(PH_TZ).format("MMM D")}
                        </span>
                        <DownloadIcon className="size-3.5 shrink-0 opacity-40" />
                    </button>
                ))}
            </div>
        </>
    );
};

export default ChatAttachmentsSection;
