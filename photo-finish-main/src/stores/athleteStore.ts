import { create } from 'zustand';
import { Runner } from '../types/race';
import { Athlete, Club, AthleteDuplicateMatch } from '../types/athletics';
import { athleteClubStorage, INITIAL_CLUBS, INITIAL_ATHLETES } from '../services/athleteClubStorage';
import { AthleteDeduplicationService } from '../services/athleteDeduplicationService';

export const DEFAULT_RUNNERS: Runner[] = [
  { id: 1, bib: 101, name: 'يوسف العبدلي', country: 'الجزائر 🇩🇿', lane: 1, color: '#EF4444', finishTime: 0, status: 'OK' },
  { id: 2, bib: 102, name: 'سفيان البقالي', country: 'المغرب 🇲🇦', lane: 2, color: '#3B82F6', finishTime: 0, status: 'OK' },
  { id: 3, bib: 103, name: 'توفيق مخلوفي', country: 'الجزائر 🇩🇿', lane: 3, color: '#10B981', finishTime: 0, status: 'OK' },
  { id: 4, bib: 104, name: 'معتز برشم', country: 'قطر 🇶🇦', lane: 4, color: '#F59E0B', finishTime: 0, status: 'OK' },
];

export interface AthleteState {
  // سباقات المضمار الحالية (Track Race Runners)
  runners: Runner[];

  // قاعدة بيانات العدائين والأندية الموحدة (Athletics Unified Database)
  athletes: Athlete[];
  clubs: Club[];
  selectedAthlete: Athlete | null;
  duplicateMatches: AthleteDuplicateMatch[];
  searchFilter: string;
  selectedClubFilter: string;
  isLoading: boolean;

  // إجراءات سباقات المضمار (Track Runners Actions)
  setRunners: (runners: Runner[] | ((prev: Runner[]) => Runner[])) => void;
  updateRunner: (lane: number, updates: Partial<Runner>) => void;
  setLaneFinish: (lane: number, finishTime: number, rank?: number, snapshotUrl?: string) => void;
  recalculateRanks: () => void;
  resetRunners: (count?: number) => void;

  // إجراءات قاعدة البيانات والأندية (Athletics Database Actions)
  loadAthletesAndClubs: () => Promise<void>;
  setSearchFilter: (search: string) => void;
  setSelectedClubFilter: (clubId: string) => void;
  setSelectedAthlete: (athlete: Athlete | null) => void;
  checkDeduplication: (candidate: Partial<Athlete>) => AthleteDuplicateMatch[];
  saveAthlete: (athlete: Athlete, forceOverride?: boolean) => Promise<{ success: boolean; athlete?: Athlete; matches?: AthleteDuplicateMatch[]; error?: string }>;
  deleteAthlete: (id: string) => Promise<void>;
  saveClub: (club: Club) => Promise<Club>;
  deleteClub: (id: string) => Promise<void>;
}

export const useAthleteStore = create<AthleteState>((set, get) => ({
  runners: DEFAULT_RUNNERS,
  athletes: INITIAL_ATHLETES,
  clubs: INITIAL_CLUBS,
  selectedAthlete: null,
  duplicateMatches: [],
  searchFilter: '',
  selectedClubFilter: '',
  isLoading: false,

  setRunners: (val) => set((state) => ({
    runners: typeof val === 'function' ? val(state.runners) : val
  })),

  updateRunner: (lane, updates) => set((state) => {
    const updated = state.runners.map((r) =>
      r.lane === lane ? { ...r, ...updates } : r
    );

    // إذا تم تعديل التوقيت، نعيد احتساب الترتيب تلقائياً
    if (updates.finishTime !== undefined) {
      const finished = updated
        .filter((r) => r.finishTime > 0 && r.status === 'OK')
        .sort((a, b) => a.finishTime - b.finishTime);

      const rankMap = new Map<number, number>();
      finished.forEach((r, idx) => {
        rankMap.set(r.lane, idx + 1);
      });

      return {
        runners: updated.map((r) => ({
          ...r,
          rank: rankMap.get(r.lane) ?? (r.finishTime > 0 ? r.rank : undefined)
        }))
      };
    }

    return { runners: updated };
  }),

  setLaneFinish: (lane, finishTime, rank, snapshotUrl) => set((state) => {
    const updated = state.runners.map((r) => {
      if (r.lane !== lane) return r;
      return {
        ...r,
        finishTime,
        rank: rank || r.rank,
        crossingSnapshot: snapshotUrl || r.crossingSnapshot
      };
    });

    const finished = updated
      .filter((r) => r.finishTime > 0 && r.status === 'OK')
      .sort((a, b) => a.finishTime - b.finishTime);

    const rankMap = new Map<number, number>();
    finished.forEach((r, idx) => {
      rankMap.set(r.lane, idx + 1);
    });

    return {
      runners: updated.map((r) => ({
        ...r,
        rank: rankMap.get(r.lane) ?? r.rank
      }))
    };
  }),

  recalculateRanks: () => set((state) => {
    const finished = state.runners
      .filter((r) => r.finishTime > 0 && r.status === 'OK')
      .sort((a, b) => a.finishTime - b.finishTime);

    const rankMap = new Map<number, number>();
    finished.forEach((r, idx) => {
      rankMap.set(r.lane, idx + 1);
    });

    return {
      runners: state.runners.map((r) => ({
        ...r,
        rank: rankMap.get(r.lane) ?? (r.finishTime > 0 ? r.rank : undefined)
      }))
    };
  }),

  resetRunners: (count) => set((state) => {
    const laneCount = count || state.runners.length || 4;
    return {
      runners: Array.from({ length: laneCount }, (_, i) => {
        const lane = i + 1;
        const existing = state.runners.find((r) => r.lane === lane);
        if (existing) {
          return {
            ...existing,
            finishTime: 0,
            reactionTime: undefined,
            rank: undefined,
            status: 'OK',
            crossingSnapshot: undefined
          };
        }
        return {
          id: lane,
          bib: 100 + lane,
          name: `عداء الرواق ${lane}`,
          country: 'نادي محلي',
          lane,
          color: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'][(lane - 1) % 8],
          finishTime: 0,
          status: 'OK'
        };
      })
    };
  }),

  // ═══════════════════════════════════════════════════
  // دوال قاعدة بيانات العدائين والأندية
  // ═══════════════════════════════════════════════════

  loadAthletesAndClubs: async () => {
    set({ isLoading: true });
    try {
      const [athletesList, clubsList] = await Promise.all([
        athleteClubStorage.listAthletes(),
        athleteClubStorage.listClubs(),
      ]);
      set({
        athletes: athletesList.length ? athletesList : INITIAL_ATHLETES,
        clubs: clubsList.length ? clubsList : INITIAL_CLUBS,
      });
    } catch (e) {
      console.warn('Failed loading athletes/clubs from storage:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setSearchFilter: (searchFilter) => set({ searchFilter }),
  setSelectedClubFilter: (selectedClubFilter) => set({ selectedClubFilter }),
  setSelectedAthlete: (selectedAthlete) => set({ selectedAthlete }),

  checkDeduplication: (candidate) => {
    const existing = get().athletes;
    return AthleteDeduplicationService.findDuplicates(candidate, existing);
  },

  saveAthlete: async (athlete, forceOverride = false) => {
    const existing = get().athletes;
    const matches = AthleteDeduplicationService.findDuplicates(athlete, existing);

    const hasBlockConflict = matches.some((m) => m.recommendedAction === 'block');
    if (hasBlockConflict && !forceOverride) {
      set({ duplicateMatches: matches });
      return {
        success: false,
        matches,
        error: matches[0]?.conflictDetails || 'تعارض في بيانات العداء مع ملف مسجل مسبقاً',
      };
    }

    const saved = await athleteClubStorage.saveAthlete(athlete);
    set((state) => {
      const idx = state.athletes.findIndex((a) => a.id === saved.id);
      const updated = idx >= 0
        ? state.athletes.map((a) => (a.id === saved.id ? saved : a))
        : [...state.athletes, saved];
      return {
        athletes: updated,
        duplicateMatches: [],
        selectedAthlete: saved,
      };
    });

    return { success: true, athlete: saved, matches };
  },

  deleteAthlete: async (id) => {
    await athleteClubStorage.deleteAthlete(id);
    set((state) => ({
      athletes: state.athletes.filter((a) => a.id !== id),
      selectedAthlete: state.selectedAthlete?.id === id ? null : state.selectedAthlete,
    }));
  },

  saveClub: async (club) => {
    const saved = await athleteClubStorage.saveClub(club);
    set((state) => {
      const idx = state.clubs.findIndex((c) => c.id === saved.id);
      const updated = idx >= 0
        ? state.clubs.map((c) => (c.id === saved.id ? saved : c))
        : [...state.clubs, saved];
      return { clubs: updated };
    });
    return saved;
  },

  deleteClub: async (id) => {
    await athleteClubStorage.deleteClub(id);
    set((state) => ({
      clubs: state.clubs.filter((c) => c.id !== id),
    }));
  },
}));
