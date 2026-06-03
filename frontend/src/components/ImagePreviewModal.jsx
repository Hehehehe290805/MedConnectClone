import { useState, useEffect } from "react";
import { getSignedUrl } from "../lib/api.js";
import { XIcon, DownloadIcon } from "lucide-react";

/**
 * Fetches a signed URL for a private S3 key and shows the image in a modal.
 * Props:
 *   s3Key   — the private S3 key string
 *   label   — button text (e.g. "View License")
 *   btnCls  — optional extra classes for the trigger button
 */
const ImagePreviewModal = ({ s3Key, label, btnCls = "btn btn-xs btn-outline" }) => {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch signed URL when the modal opens
    useEffect(() => {
        if (!open || url) return;
        const fetch = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await getSignedUrl(s3Key);
                // sendSuccess wraps the URL in { data: { url } }
                const signedUrl = res.data?.signedUrl;
                if (!signedUrl) throw new Error("No URL in response");
                setUrl(signedUrl);
            } catch {
                setError("Could not load image. The key may be invalid or the session expired.");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [open, s3Key, url]);

    if (!s3Key) return null;

    return (
        <>
            <button type="button" className={btnCls} onClick={() => setOpen(true)}>
                {label}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-base-100 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-base-300">
                            <p className="font-semibold text-sm">{label}</p>
                            <div className="flex items-center gap-2">
                                {url && (
                                    <a
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-xs btn-ghost gap-1"
                                    >
                                        <DownloadIcon className="size-3" /> Download
                                    </a>
                                )}
                                <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setOpen(false)}>
                                    <XIcon className="size-4" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-base-200 min-h-[200px]">
                            {loading && <span className="loading loading-spinner loading-lg text-primary" />}
                            {error && <p className="text-sm text-error text-center">{error}</p>}
                            {url && !loading && (
                                <img
                                    src={url}
                                    alt={label}
                                    className="max-w-full max-h-[70vh] object-contain rounded"
                                    onError={() => setError("Image failed to render. Try Download instead.")}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ImagePreviewModal;
