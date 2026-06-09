import { create } from "zustand";

export const useSignUpStore = create((set) => ({
    email: "",           // the signup identifier (email address or normalized phone)
    step: "form",        // "form" | "verify"
    signupMethod: "email", // "email" | "phone"
    mockCode: null,      // non-null for phone signup (demo mode)
    setEmail: (email) => set({ email }),
    setStep: (step) => set({ step }),
    setSignupMethod: (signupMethod) => set({ signupMethod }),
    setMockCode: (mockCode) => set({ mockCode }),
    reset: () => set({ email: "", step: "form", signupMethod: "email", mockCode: null }),
}));
