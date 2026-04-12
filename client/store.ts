import { create } from "zustand";

interface StoreState {
  events: unknown[];
  addEvent: (event: unknown) => void;
}

export const useStore = create<StoreState>((set) => ({
  events: [],
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
}));
