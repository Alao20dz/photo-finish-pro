import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useAuthStore,
  useTimingStore,
  useAthleteStore,
  useCompetitionStore,
  useJudgeStore,
  useResultStore,
  useNetworkStore,
  useSettingsStore,
  DEFAULT_RUNNERS,
  DEFAULT_SETTINGS,
} from '../src/stores';
import { dispatchNetworkMessage } from '../src/services/messageHandlers/messageDispatcher';
import { NetworkPeerMessage, Runner } from '../src/types/race';
import { AthleticsJudge, RunnerLiveRanking } from '../src/types/athletics';

describe('Zustand Modular Stores & Immutability Architecture', () => {
  beforeEach(() => {
    useAuthStore.getState().resetAuth();
    useTimingStore.getState().resetTiming();
    useAthleteStore.getState().resetRunners();
    useResultStore.getState().resetResults();
    useSettingsStore.getState().resetSettings();
  });

  // ═══════════════════════════════════════════════════
  // 1. authStore Tests
  // ═══════════════════════════════════════════════════
  describe('authStore', () => {
    it('initializes with default values and allows role and tier updates', () => {
      const auth = useAuthStore.getState();
      expect(auth.role).toBeNull();
      expect(auth.effectiveTier).toBe('TRIAL');
      expect(auth.isAuthenticated).toBe(false);

      auth.setRole('judge');
      auth.setEffectiveTier('ENTX');
      auth.setSessionToken('jwt-session-xyz');

      const updated = useAuthStore.getState();
      expect(updated.role).toBe('judge');
      expect(updated.effectiveTier).toBe('ENTX');
      expect(updated.sessionToken).toBe('jwt-session-xyz');
      expect(updated.isAuthenticated).toBe(true);

      updated.resetAuth();
      const reset = useAuthStore.getState();
      expect(reset.role).toBeNull();
      expect(reset.effectiveTier).toBe('TRIAL');
      expect(reset.isAuthenticated).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════
  // 2. timingStore Tests
  // ═══════════════════════════════════════════════════
  describe('timingStore', () => {
    it('manages race clock state transitions with precision', () => {
      const timing = useTimingStore.getState();
      expect(timing.raceStatus).toBe('idle');
      expect(timing.isRunning).toBe(false);

      const startTime = Date.now();
      timing.startClock(startTime);

      const running = useTimingStore.getState();
      expect(running.raceStatus).toBe('racing');
      expect(running.isRunning).toBe(true);
      expect(running.startTime).toBe(startTime);

      // Support functional update for clockTimeMs
      timing.setClockTimeMs(1500);
      expect(useTimingStore.getState().clockTimeMs).toBe(1500);
      timing.setClockTimeMs((prev) => prev + 500);
      expect(useTimingStore.getState().clockTimeMs).toBe(2000);

      // Clock offset for NTP synchronization
      timing.setClockOffsetMs(-12);
      expect(useTimingStore.getState().clockOffsetMs).toBe(-12);

      timing.stopClock();
      expect(useTimingStore.getState().isRunning).toBe(false);

      timing.resetTiming();
      expect(useTimingStore.getState().raceStatus).toBe('idle');
      expect(useTimingStore.getState().clockTimeMs).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // 3. athleteStore & Pure Immutability Tests
  // ═══════════════════════════════════════════════════
  describe('athleteStore & Immutability', () => {
    it('performs pure immutable updates and automatically calculates ranks', () => {
      const store = useAthleteStore.getState();
      const initialRunners = store.runners;
      expect(initialRunners.length).toBe(4);

      // Set finish time for lane 3: 10.15s (10150ms)
      store.setLaneFinish(3, 10150);
      // Set finish time for lane 1: 9.98s (9980ms)
      store.setLaneFinish(1, 9980);

      const updatedRunners = useAthleteStore.getState().runners;
      // Immutability: initialRunners array reference must NOT be mutated
      expect(updatedRunners).not.toBe(initialRunners);

      const runner1 = updatedRunners.find((r) => r.lane === 1);
      const runner3 = updatedRunners.find((r) => r.lane === 3);

      expect(runner1?.finishTime).toBe(9980);
      expect(runner1?.rank).toBe(1); // Fast time -> Rank 1

      expect(runner3?.finishTime).toBe(10150);
      expect(runner3?.rank).toBe(2); // Slower time -> Rank 2

      // Modifying note on lane 2
      store.updateRunner(2, { notes: 'تحذير مسار' });
      const runner2 = useAthleteStore.getState().runners.find((r) => r.lane === 2);
      expect(runner2?.notes).toBe('تحذير مسار');
    });
  });

  // ═══════════════════════════════════════════════════
  // 4. competitionStore Tests
  // ═══════════════════════════════════════════════════
  describe('competitionStore', () => {
    it('manages heats, ordering, and heat index transitions', () => {
      const comp = useCompetitionStore.getState();
      expect(comp.heats.length).toBe(3);
      expect(comp.currentHeatIndex).toBe(0);

      comp.setCurrentHeatIndex(1);
      expect(useCompetitionStore.getState().currentHeatIndex).toBe(1);

      comp.updateHeat(0, { windSpeed: '+2.1 m/s' });
      expect(useCompetitionStore.getState().heats[0].windSpeed).toBe('+2.1 m/s');

      // Reordering
      const reversed = [...comp.heats].reverse();
      comp.reorderHeats(reversed);
      expect(useCompetitionStore.getState().heats[0].id).toBe('heat-final');

      // Deletion
      comp.deleteHeat('heat-final');
      expect(useCompetitionStore.getState().heats.some((h) => h.id === 'heat-final')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════
  // 5. judgeStore Tests
  // ═══════════════════════════════════════════════════
  describe('judgeStore', () => {
    it('registers and updates field judges with heartbeat tracking', () => {
      const judgeStore = useJudgeStore.getState();
      const testJudge: AthleticsJudge = {
        id: 'judge_cp01',
        name: 'الأستاذ فاروق بلحاج',
        pinCode: '4321',
        role: 'checkpoint_judge',
        assignedCheckpointId: 'cp_01',
        isOnline: false,
      };

      judgeStore.updateJudge(testJudge);
      expect(useJudgeStore.getState().judges.length).toBe(1);
      expect(useJudgeStore.getState().judges[0].isOnline).toBe(false);

      // Heartbeat coming online
      judgeStore.updateJudge({ ...testJudge, isOnline: true, latencyMs: 4 });
      const onlineJudge = useJudgeStore.getState().judges.find((j) => j.id === 'judge_cp01');
      expect(onlineJudge?.isOnline).toBe(true);
      expect(onlineJudge?.latencyMs).toBe(4);

      judgeStore.removeJudge('judge_cp01');
      expect(useJudgeStore.getState().judges.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // 6. resultStore Tests
  // ═══════════════════════════════════════════════════
  describe('resultStore', () => {
    it('manages provisional standings and official result locking mechanism', () => {
      const resultStore = useResultStore.getState();
      expect(resultStore.officialLocked).toBe(false);

      const mockRankings: RunnerLiveRanking[] = [
        {
          bibNumber: 101,
          athleteName: 'سفيان البقالي',
          lapsCompleted: 4,
          lastCheckpointCode: 'FINISH',
          lastCheckpointDistanceKm: 8,
          lastPassageTime: Date.now(),
          totalElapsedTimeMs: 1324000,
          rank: 1,
          gapToLeaderMs: 0,
          status: 'finished',
          hasAnomaly: false,
          passages: [],
        },
      ];

      resultStore.setProvisionalRankings(mockRankings);
      expect(useResultStore.getState().provisionalRankings.length).toBe(1);

      // Lock results officially by Chief Judge
      resultStore.lockResults('chief_judge_01');
      const locked = useResultStore.getState();
      expect(locked.officialLocked).toBe(true);
      expect(locked.lockedBy).toBe('chief_judge_01');
      expect(typeof locked.lockedAt).toBe('number');

      // Reopening locked results with reason
      resultStore.unlockResults('chief_judge_01', 'مراجعة اعتراض رسمي من نادي الوفاق');
      const unlocked = useResultStore.getState();
      expect(unlocked.officialLocked).toBe(false);
      expect(unlocked.unlockReason).toBe('مراجعة اعتراض رسمي من نادي الوفاق');
    });
  });

  // ═══════════════════════════════════════════════════
  // 7. networkStore & settingsStore Tests
  // ═══════════════════════════════════════════════════
  describe('networkStore & settingsStore', () => {
    it('tracks connection modes and audio alert states', () => {
      const net = useNetworkStore.getState();
      expect(net.connectionMode).toBe('offline');

      net.setConnectionMode('ws');
      net.setLatencyMs(3);
      net.setIsHoldingBell(true);

      const updated = useNetworkStore.getState();
      expect(updated.connectionMode).toBe('ws');
      expect(updated.latencyMs).toBe(3);
      expect(updated.isHoldingBell).toBe(true);
    });

    it('updates camera placement geometry and resets cleanly to defaults', () => {
      const settingsStore = useSettingsStore.getState();
      expect(settingsStore.settings.cameraPlacement).toBe('side_classic');

      // Switch to recommended Olympic tele_parallel placement
      settingsStore.updateSettings({
        cameraPlacement: 'tele_parallel',
        laneCount: 8,
      });

      const updated = useSettingsStore.getState().settings;
      expect(updated.cameraPlacement).toBe('tele_parallel');
      expect(updated.laneCount).toBe(8);

      settingsStore.resetSettings();
      expect(useSettingsStore.getState().settings.cameraPlacement).toBe('side_classic');
    });
  });

  // ═══════════════════════════════════════════════════
  // 8. messageDispatcher Routing Integration Tests
  // ═══════════════════════════════════════════════════
  describe('dispatchNetworkMessage Integration', () => {
    it('dispatches START_GUN message with synchronized NTP calculation', () => {
      const setRaceStatus = vi.fn();
      const startLocalClock = vi.fn();
      const stopLocalClock = vi.fn();
      const handleLocalReset = vi.fn();

      const msg: NetworkPeerMessage = {
        type: 'START_GUN',
        timestamp: 1700000000000,
        senderTime: 1700000000000,
        payload: {
          startTime: 1700000000000,
          soundVolume: 1.5,
          soundPitch: 1.0,
        },
      };

      const result = dispatchNetworkMessage(msg, {
        role: 'judge',
        clockOffsetMs: -15, // 15ms clock difference
        getSettings: () => DEFAULT_SETTINGS,
        getRunners: () => DEFAULT_RUNNERS,
        getHeats: () => [],
        getCurrentHeatIndex: () => 0,
        getRaceStatus: () => 'idle',
        getClockTimeMs: () => 0,

        setRaceStatus,
        startLocalClock,
        stopLocalClock,
        handleLocalReset,

        setRunners: vi.fn(),
        setSettings: vi.fn(),
        setHeats: vi.fn(),
        setCurrentHeatIndex: vi.fn(),
        setDispatchedHeatId: vi.fn(),
        setShowPodium: vi.fn(),
        setSharedPoolLicense: vi.fn(),
      });

      expect(result).toBe(true);
      expect(setRaceStatus).toHaveBeenCalledWith('racing');
      // Must apply clock offset (-15ms)
      expect(startLocalClock).toHaveBeenCalledWith(1700000000000 - 15);
    });

    it('dispatches LANE_FINISH message and triggers runner update', () => {
      const setRunners = vi.fn();

      const msg: NetworkPeerMessage = {
        type: 'LANE_FINISH',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: {
          lane: 2,
          timeMs: 10450,
          rank: 1,
        },
      };

      const result = dispatchNetworkMessage(msg, {
        role: 'judge',
        clockOffsetMs: 0,
        getSettings: () => DEFAULT_SETTINGS,
        getRunners: () => DEFAULT_RUNNERS,
        getHeats: () => [],
        getCurrentHeatIndex: () => 0,
        getRaceStatus: () => 'racing',
        getClockTimeMs: () => 10450,

        setRaceStatus: vi.fn(),
        startLocalClock: vi.fn(),
        stopLocalClock: vi.fn(),
        handleLocalReset: vi.fn(),

        setRunners,
        setSettings: vi.fn(),
        setHeats: vi.fn(),
        setCurrentHeatIndex: vi.fn(),
        setDispatchedHeatId: vi.fn(),
        setShowPodium: vi.fn(),
        setSharedPoolLicense: vi.fn(),
      });

      expect(result).toBe(true);
      expect(setRunners).toHaveBeenCalled();
    });
  });
});
