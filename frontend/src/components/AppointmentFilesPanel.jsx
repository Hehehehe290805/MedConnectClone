import { useEffect, useState, useRef } from "react";
import useAuthUser from "../hooks/useAuthUser";
import {
    listAppointmentFiles,
    uploadAppointmentFile,
    getAppointmentFileSignedUrl,
    deleteAppointmentFile,
} from "../lib/api.js";
import { convertToWebP, validateAppointmentFile, formatFileSize } from "../lib/webpConverter.js";
import {
    UploadCloudIcon, DownloadIcon, Trash2Icon, FileTextIcon,
    ImageIcon, FlaskConicalIcon, FileIcon, ClipboardListIcon, PrinterIcon,
} from "lucide-react";
import toast from "react-hot-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

const FILE_TYPE_META = {
    preconsultation: { label: "Pre-Consultation",  icon: ClipboardListIcon, cls: "badge-primary" },
    note:            { label: "Note",               icon: FileTextIcon,       cls: "badge-info" },
    image:           { label: "Image",              icon: ImageIcon,          cls: "badge-secondary" },
    lab_report:      { label: "Lab Report",         icon: FlaskConicalIcon,   cls: "badge-accent" },
    document:        { label: "Document",           icon: FileIcon,           cls: "badge-ghost" },
};

const ROLE_UPLOAD_TYPES = {
    patient:    ["image", "document", "note"],
    doctor:     ["note", "image", "document"],
    department: ["lab_report", "image", "document"],
};

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── PDF export ───────────────────────────────────────────────────────────────
// Opens a print-ready HTML page in a new tab. The user can save it as PDF
// using the browser's built-in Print → Save as PDF.
function exportAsPdf(files, textContents) {
    const rows = files.map((f) => {
        const meta = FILE_TYPE_META[f.fileType] || FILE_TYPE_META.document;
        const body = textContents[f._id] ?? "(binary file — not included in text export)";
        return `
            <section>
                <h3>${f.originalName}</h3>
                <p class="meta">${meta.label} · Uploaded by ${f.uploaderRole} · ${fmtDate(f.createdAt)} · ${formatFileSize(f.sizeBytes)}</p>
                ${f.description ? `<p class="desc">${f.description}</p>` : ""}
                <pre class="content">${body.replace(/</g, "&lt;")}</pre>
            </section>
        `;
    }).join("<hr>");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Appointment Files</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #111; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  h3 { font-size: 1rem; margin: 0 0 4px; }
  .meta { font-size: 0.75rem; color: #666; margin: 0 0 4px; }
  .desc { font-size: 0.85rem; font-style: italic; color: #555; }
  pre.content { white-space: pre-wrap; font-size: 0.85rem; background: #f5f5f5; padding: 12px; border-radius: 6px; }
  section { margin-bottom: 28px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Appointment Files</h1>
<p class="meta">Exported from MedConnect · ${new Date().toLocaleString("en-PH")}</p>
<hr>
${rows}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { toast.error("Pop-up blocked. Allow pop-ups to export PDF."); return; }
    win.document.write(html);
    win.document.close();
    // Small delay to let styles render before print dialog
    setTimeout(() => win.print(), 400);
}

// ── main component ────────────────────────────────────────────────────────────

/**
 * Reusable panel for viewing and managing files attached to an appointment.
 * Props:
 *   appointmentId  — the appointment's _id
 *   participantRole — "patient" | "doctor" | "department" (the calling user's role in this appointment)
 *   readOnly        — if true, hides upload/delete controls
 */
const AppointmentFilesPanel = ({ appointmentId, participantRole, readOnly = false }) => {
    const { authUser } = useAuthUser();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [textContents, setTextContents] = useState({}); // fileId → text string for PDF export

    // Upload form state
    const [fileType, setFileType] = useState(ROLE_UPLOAD_TYPES[participantRole]?.[0] ?? "document");
    const [description, setDescription] = useState("");
    const fileInputRef = useRef(null);

    const isAdmin = authUser?.role === "admin";
    const uploadTypes = ROLE_UPLOAD_TYPES[participantRole] ?? [];

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await listAppointmentFiles(appointmentId);
                setFiles(data.data?.files ?? []);
            } catch {
                toast.error("Could not load appointment files.");
            } finally { setLoading(false); }
        };
        fetch();
    }, [appointmentId]);

    // ── upload ────────────────────────────────────────────────────────────────

    const handleUpload = async (e) => {
        const raw = e.target.files?.[0];
        if (!raw) return;

        const err = validateAppointmentFile(raw);
        if (err) { toast.error(err); return; }

        setUploading(true);
        try {
            // Convert images to WebP for compact storage
            const file = raw.type.startsWith("image/") ? await convertToWebP(raw) : raw;

            const formData = new FormData();
            formData.append("file", file);
            formData.append("fileType", fileType);
            if (description.trim()) formData.append("description", description.trim());

            const res = await uploadAppointmentFile(appointmentId, formData);
            setFiles(prev => [...prev, res.data.file]);
            setDescription("");
            toast.success("File uploaded.");
        } catch (err) {
            toast.error(err?.response?.data?.message || "Upload failed.");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // ── download ──────────────────────────────────────────────────────────────

    const handleDownload = async (file) => {
        try {
            const data = await getAppointmentFileSignedUrl(file._id);
            const a = document.createElement("a");
            a.href = data.data.url;
            a.download = file.originalName;
            a.target = "_blank";
            a.rel = "noopener";
            a.click();
        } catch {
            toast.error("Could not generate download link.");
        }
    };

    // ── delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (file) => {
        if (!window.confirm(`Delete "${file.originalName}"?`)) return;
        try {
            await deleteAppointmentFile(file._id);
            setFiles(prev => prev.filter(f => f._id !== file._id));
            toast.success("File deleted.");
        } catch (err) {
            toast.error(err?.response?.data?.message || "Delete failed.");
        }
    };

    // ── PDF export ────────────────────────────────────────────────────────────

    const handleExportPdf = async () => {
        const toFetch = files.filter(f =>
            ["text/plain", "text/markdown"].includes(f.mimeType) && !textContents[f._id]
        );

        // Fetch all un-cached text files in parallel — they are independent requests
        const fetched = { ...textContents };
        await Promise.all(toFetch.map(async (f) => {
            try {
                const data = await getAppointmentFileSignedUrl(f._id);
                const res = await fetch(data.data.url);
                fetched[f._id] = await res.text();
            } catch {
                fetched[f._id] = "(could not load content)";
            }
        }));

        setTextContents(fetched);
        exportAsPdf(files, fetched);
    };

    // ── render ────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <span className="loading loading-spinner loading-md text-primary" />
            </div>
        );
    }

    // uploadedBy is a plain string from JSON; authUser._id may be an ObjectId — compare as strings
    const canDelete = (file) =>
        !readOnly && (
            isAdmin ||
            (String(file.uploadedBy) === String(authUser?._id) && file.fileType !== "preconsultation")
        );

    return (
        <div className="space-y-4">
            {/* File list */}
            {files.length === 0 ? (
                <p className="text-sm opacity-50 text-center py-4">No files attached yet.</p>
            ) : (
                <div className="space-y-2">
                    {files.map(f => {
                        const meta = FILE_TYPE_META[f.fileType] ?? FILE_TYPE_META.document;
                        const Icon = meta.icon;
                        return (
                            <div key={f._id} className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
                                <Icon className="size-4 shrink-0 mt-0.5 opacity-60" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{f.originalName}</p>
                                    <div className="flex gap-2 flex-wrap mt-0.5">
                                        <span className={`badge badge-xs ${meta.cls}`}>{meta.label}</span>
                                        <span className="badge badge-xs badge-ghost capitalize">{f.uploaderRole}</span>
                                        <span className="text-xs opacity-40">{formatFileSize(f.sizeBytes)}</span>
                                        <span className="text-xs opacity-40">{fmtDate(f.createdAt)}</span>
                                    </div>
                                    {f.description && <p className="text-xs opacity-60 mt-0.5">{f.description}</p>}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        className="btn btn-xs btn-ghost"
                                        title="Download"
                                        onClick={() => handleDownload(f)}
                                    >
                                        <DownloadIcon className="size-3" />
                                    </button>
                                    {canDelete(f) && (
                                        <button
                                            className="btn btn-xs btn-ghost text-error"
                                            title="Delete"
                                            onClick={() => handleDelete(f)}
                                        >
                                            <Trash2Icon className="size-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Actions bar */}
            <div className="flex flex-wrap gap-2">
                {files.length > 0 && (
                    <button className="btn btn-xs btn-outline gap-1" onClick={handleExportPdf}>
                        <PrinterIcon className="size-3" />Export as PDF
                    </button>
                )}
            </div>

            {/* Upload form */}
            {!readOnly && uploadTypes.length > 0 && (
                <div className="border-t border-base-300 pt-4 space-y-2">
                    <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Attach a File</p>

                    <div className="flex flex-wrap gap-2">
                        <select
                            className="select select-bordered select-sm"
                            value={fileType}
                            onChange={e => setFileType(e.target.value)}
                        >
                            {uploadTypes.map(t => (
                                <option key={t} value={t}>{FILE_TYPE_META[t]?.label ?? t}</option>
                            ))}
                        </select>
                        <input
                            className="input input-bordered input-sm flex-1 min-w-0"
                            placeholder="Description (optional)"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="file-input file-input-bordered file-input-sm flex-1"
                            accept="image/*,.pdf,.txt,.md"
                            onChange={handleUpload}
                            disabled={uploading}
                        />
                        {uploading && <span className="loading loading-spinner loading-sm text-primary" />}
                    </div>
                    <p className="text-xs opacity-40">
                        Max 5 MB. Images are converted to WebP automatically.
                        Allowed: images, PDF, plain text, Markdown.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AppointmentFilesPanel;
