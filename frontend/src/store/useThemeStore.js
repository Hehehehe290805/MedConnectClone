import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("medconnect-theme") || "light",
  setTheme: (theme) => {
    localStorage.setItem("medconnect-theme", theme);
    set({ theme });
  },
}));