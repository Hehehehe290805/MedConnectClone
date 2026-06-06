import { create } from "zustand";

export const useSignUpStore = create((set) => ({
    email: "",
    step: "form", // "form" | "verify"
    setEmail: (email) => set({ email }),
    setStep: (step) => set({ step }),
    reset: () => set({ email: "", step: "form" }),
}));