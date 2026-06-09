import { create } from "zustand";

export const useForgotPasswordStore = create((set) => ({
    email: "",       // the identifier used (email address or phone number)
    code: "",
    mockCode: "",    // non-empty for phone recovery (demo mode)
    recoveryMethod: "email", // "email" | "phone"
    setEmail: (email) => set({ email }),
    setCode: (code) => set({ code }),
    setMockCode: (mockCode) => set({ mockCode }),
    setRecoveryMethod: (recoveryMethod) => set({ recoveryMethod }),
    reset: () => set({ email: "", code: "", mockCode: "", recoveryMethod: "email" }),
}));
