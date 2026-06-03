import { create } from "zustand";

export const useForgotPasswordStore = create((set) => ({
    email: "",
    code: "",
    setEmail: (email) => set({ email }),
    setCode: (code) => set({ code }),
    reset: () => set({ email: "", code: "" }),
}));
