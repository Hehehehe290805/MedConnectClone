import Log from "../models/Log.js";

export async function logError(controller, error) {
    try {
        const log = new Log({
            level: "error",
            message: error.message || String(error),
            stack: error.stack || "",
            controller,
        });
        await log.save();
    } catch (err) {
        console.error("Failed to log error to MongoDB:", err);
    }
}
