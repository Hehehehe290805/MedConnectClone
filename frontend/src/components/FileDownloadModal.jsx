import { AlertTriangleIcon, DownloadIcon } from "lucide-react";

const FileDownloadModal = ({ filename, url, onClose }) => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
                <AlertTriangleIcon className="size-6 text-warning shrink-0" />
                <h3 className="font-bold text-lg">Download File</h3>
            </div>
            <p className="text-sm opacity-70">
                You are about to download <span className="font-semibold break-all">{filename}</span>.
            </p>
            <p className="text-xs opacity-40">
                MedConnect is not responsible for the contents of files shared in chat.
            </p>
            <div className="flex gap-3 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <a
                    href={url}
                    download={filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm gap-2"
                    onClick={onClose}
                >
                    <DownloadIcon className="size-4" />Download
                </a>
            </div>
        </div>
    </div>
);

export default FileDownloadModal;
