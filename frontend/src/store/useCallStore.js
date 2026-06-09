import { create } from "zustand";

const useCallStore = create((set) => ({
    activeCallId: null,
    setActiveCallId: (id) => set({ activeCallId: id }),
    clearActiveCallId: () => set({ activeCallId: null }),
}));

export default useCallStore;
