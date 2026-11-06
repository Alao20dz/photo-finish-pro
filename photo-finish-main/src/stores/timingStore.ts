import { create } from 'zustand';
import { RaceStatus } from '../types/race';

export interface TimingState {
  raceStatus: RaceStatus;
  clockTimeMs: number;
  clockOffsetMs: number;
  isRunning: boolean;
  startTime: number | null;
  dispatchedHeatId: string | null;

  // Actions
  setRaceStatus: (status: RaceStatus) => void;
  setClockTimeMs: (ms: number | ((prev: number) => number)) => void;
  setClockOffsetMs: (offset: number) => void;
  setIsRunning: (running: boolean) => void;
  setStartTime: (time: number | null) => void;
  setDispatchedHeatId: (id: string | null) => void;
  startClock: (startTime: number) => void;
  stopClock: () => void;
  resetTiming: () => void;
}

export const useTimingStore = create<TimingState>((set) => ({
  raceStatus: 'idle',
  clockTimeMs: 0,
  clockOffsetMs: 0,
  isRunning: false,
  startTime: null,
  dispatchedHeatId: null,

  setRaceStatus: (raceStatus) => set({ raceStatus }),
  setClockTimeMs: (val) => set((state) => ({
    clockTimeMs: typeof val === 'function' ? val(state.clockTimeMs) : val
  })),
  setClockOffsetMs: (clockOffsetMs) => set({ clockOffsetMs }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setStartTime: (startTime) => set({ startTime }),
  setDispatchedHeatId: (dispatchedHeatId) => set({ dispatchedHeatId }),

  startClock: (startTime) => set({
    startTime,
    isRunning: true,
    raceStatus: 'racing'
  }),

  stopClock: () => set({
    isRunning: false
  }),

  resetTiming: () => set({
    raceStatus: 'idle',
    clockTimeMs: 0,
    isRunning: false,
    startTime: null,
    dispatchedHeatId: null
  })
}));
