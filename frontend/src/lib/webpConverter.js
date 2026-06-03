// Client-side image → WebP converter.
// Uses the Canvas API to re-encode images at quality=1.0 (maximum fidelity lossy WebP).
// Note: the Canvas API does NOT support true lossless WebP — quality=1.0 is the
// highest-quality lossy setting, not lossless. For clinical images (X-rays, lab scans)
// the department uploader should use PDF instead to guarantee pixel fidelity.
//
// Falls back to the original file if:
//   - The browser doesn't support canvas.toBlob with WebP
//   - The converted file would be larger than the original (some PNGs compress better as-is)

export async function convertToWebP(file) {
    if (!file.type.startsWith("image/")) return file; // PDFs, text etc. pass through
    if (file.type === "image/webp") return file;      // already WebP

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(objectUrl);
                    if (!blob || blob.size >= file.size) {
                        // Conversion produced a larger file or failed — keep original
                        resolve(file);
                        return;
                    }
                    const webpFile = new File(
                        [blob],
                        file.name.replace(/\.[^.]+$/, ".webp"),
                        { type: "image/webp" }
                    );
                    resolve(webpFile);
                },
                "image/webp",
                1.0 // max-quality lossy (Canvas API has no lossless WebP mode)
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file); // fallback to original on error
        };

        img.src = objectUrl;
    });
}

// Returns a human-readable file size string (e.g. "2.4 MB")
export function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Validates a file against the allowed types and 5 MB limit.
// Returns null if valid, or an error message string if not.
export function validateAppointmentFile(file) {
    const MAX = 5 * 1024 * 1024;
    const ALLOWED_TYPES = [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "application/pdf",
        "text/plain", "text/markdown",
    ];

    if (file.size > MAX) return `"${file.name}" exceeds the 5 MB limit.`;
    if (!ALLOWED_TYPES.includes(file.type)) {
        return `"${file.name}" is not a supported file type. Allowed: images, PDF, text.`;
    }
    return null;
}
