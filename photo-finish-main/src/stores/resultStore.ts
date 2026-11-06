import { create } from 'zustand';
import { RunnerLiveRanking } from '../types/athletics';

export interface ResultState {
  provisionalRankings: RunnerLiveRanking[];
  officialLocked: boolean;
  lockedBy: string | null;
  lockedAt: number | null;
  unlockReason: string | null;
  isPodiumVisible: boolean;

  // Actions
  setProvisionalRankings: (rankings: RunnerLiveRanking[]) => void;
  lockResults: (lockedBy: string) => void;
  unlockResults: (unlockedBy: string, reason: string) => void;
  setPodiumVisible: (visible: boolean) => void;
  resetResults: () => void;
}

export const useResultStore = create<ResultState>((set) => ({
  provisionalRankings: [],
  officialLocked: false,
  lockedBy: null,
  lockedAt: null,
  unlockReason: null,
  isPodiumVisible: false,

  setProvisionalRankings: (provisionalRankings) => set({ provisionalRankings }),

  lockResults: (lockedBy) => set({
    officialLocked: true,
    lockedBy,
    lockedAt: Date.now(),
    unlockReason: null
  }),

  unlockResults: (_unlockedBy, reason) => set({
    officialLocked: false,
    unlockReason: reason
  }),

  setPodiumVisible: (isPodiumVisible) => set({ isPodiumVisible }),

  resetResults: () => set({
    provisionalRankings: [],
    officialLocked: false,
    lockedBy: null,
    lockedAt: null,
    unlockReason: null,
    isPodiumVisible: false
  })
}));
