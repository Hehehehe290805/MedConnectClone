// Shared utilities used by both HomePageAdmin and AdminReportsPage.
// Centralised here so label changes and bug fixes apply to both.

export const OUTCOME_LABELS = {
    patient_right: "Patient is right",
    provider_right: "Provider is right",
    split: "Split / both at fault",
};

export function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}
