import { create } from 'zustand';
import { Heat } from '../types/race';
import { AthleticsCompetition } from '../types/athletics';
import { DEFAULT_RUNNERS } from './athleteStore';

export const DEFAULT_HEATS: Heat[] = [
  {
    id: 'heat-1',
    number: 1,
    name: 'قائمة 1 (تصفية أولى)',
    distance: '100m',
    windSpeed: '+1.2 m/s',
    runners: DEFAULT_RUNNERS,
    status: 'pending'
  },
  {
    id: 'heat-2',
    number: 2,
    name: 'قائمة 2 (تصفية ثانية)',
    distance: '100m',
    windSpeed: '+1.2 m/s',
    runners: [
      { id: 21, bib: 201, name: 'عدنان الطاهر', country: 'الجزائر 🇩🇿', lane: 1, color: '#EF4444', finishTime: 0, status: 'OK' },
      { id: 22, bib: 202, name: 'حكيم الصالحي', country: 'تونس 🇹🇳', lane: 2, color: '#3B82F6', finishTime: 0, status: 'OK' },
      { id: 23, bib: 203, name: 'طارق بوكنزة', country: 'المغرب 🇲🇦', lane: 3, color: '#10B981', finishTime: 0, status: 'OK' },
      { id: 24, bib: 204, name: 'عبد الرحمن صمبا', country: 'قطر 🇶🇦', lane: 4, color: '#F59E0B', finishTime: 0, status: 'OK' },
    ],
    status: 'pending'
  },
  {
    id: 'heat-final',
    number: 3,
    name: 'النهائي الكبير (Final)',
    distance: '100m',
    windSpeed: '+1.2 m/s',
    runners: [
      { id: 31, bib: 301, name: 'أفضل متأهل 1', country: 'المتأهلين', lane: 1, color: '#EF4444', finishTime: 0, status: 'OK' },
      { id: 32, bib: 302, name: 'أفضل متأهل 2', country: 'المتأهلين', lane: 2, color: '#3B82F6', finishTime: 0, status: 'OK' },
      { id: 33, bib: 303, name: 'أفضل متأهل 3', country: 'المتأهلين', lane: 3, color: '#10B981', finishTime: 0, status: 'OK' },
      { id: 34, bib: 304, name: 'أفضل متأهل 4', country: 'المتأهلين', lane: 4, color: '#F59E0B', finishTime: 0, status: 'OK' },
    ],
    status: 'pending'
  }
];

export interface CompetitionState {
  heats: Heat[];
  currentHeatIndex: number;
  activeCompetition: AthleticsCompetition | null;

  // Actions
  setHeats: (heats: Heat[] | ((prev: Heat[]) => Heat[])) => void;
  setCurrentHeatIndex: (index: number) => void;
  updateHeat: (index: number, partial: Partial<Heat>) => void;
  reorderHeats: (newHeats: Heat[]) => void;
  deleteHeat: (heatId: string) => void;
  setActiveCompetition: (comp: AthleticsCompetition | null) => void;
}

export const useCompetitionStore = create<CompetitionState>((set) => ({
  heats: DEFAULT_HEATS,
  currentHeatIndex: 0,
  activeCompetition: null,

  setHeats: (val) => set((state) => ({
    heats: typeof val === 'function' ? val(state.heats) : val
  })),

  setCurrentHeatIndex: (currentHeatIndex) => set({ currentHeatIndex }),

  updateHeat: (index, partial) => set((state) => {
    const updated = [...state.heats];
    if (updated[index]) {
      updated[index] = { ...updated[index], ...partial };
    }
    return { heats: updated };
  }),

  reorderHeats: (heats) => set({ heats }),

  deleteHeat: (heatId) => set((state) => ({
    heats: state.heats.filter((h) => h.id !== heatId)
  })),

  setActiveCompetition: (activeCompetition) => set({ activeCompetition })
}));
