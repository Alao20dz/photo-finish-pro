import { create } from 'zustand';
import { AthleticsJudge } from '../types/athletics';

export interface JudgeState {
  judges: AthleticsJudge[];
  activeJudge: AthleticsJudge | null;

  // Actions
  setJudges: (judges: AthleticsJudge[] | ((prev: AthleticsJudge[]) => AthleticsJudge[])) => void;
  updateJudge: (judge: AthleticsJudge) => void;
  setActiveJudge: (judge: AthleticsJudge | null) => void;
  removeJudge: (judgeId: string) => void;
}

export const useJudgeStore = create<JudgeState>((set) => ({
  judges: [],
  activeJudge: null,

  setJudges: (val) => set((state) => ({
    judges: typeof val === 'function' ? val(state.judges) : val
  })),

  updateJudge: (judge) => set((state) => {
    const existingIndex = state.judges.findIndex((j) => j.id === judge.id);
    if (existingIndex >= 0) {
      const updated = [...state.judges];
      updated[existingIndex] = { ...updated[existingIndex], ...judge };
      return { judges: updated };
    }
    return { judges: [...state.judges, judge] };
  }),

  setActiveJudge: (activeJudge) => set({ activeJudge }),

  removeJudge: (judgeId) => set((state) => ({
    judges: state.judges.filter((j) => j.id !== judgeId)
  }))
}));
