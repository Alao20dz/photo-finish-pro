import { NetworkPeerMessage, Runner, Heat, RaceSettings } from '../../types/race';
import { athleticsAudio } from '../audioService';

export interface RaceFinishHandlerCallbacks {
  setRaceStatus: (status: any) => void;
  stopLocalClock: () => void;
  setRunners: (runners: Runner[] | ((prev: Runner[]) => Runner[])) => void;
  setHeats: (heats: Heat[] | ((prev: Heat[]) => Heat[])) => void;
  setShowPodium: (show: boolean) => void;
  saveRaceToArchive?: (race: { runners: Runner[]; fullPhotoFinishUrl?: string }) => void;
  getCurrentHeatIndex: () => number;
  getRunners: () => Runner[];
  getSettings: () => RaceSettings;
}

export function handleRaceFinishMessage(msg: NetworkPeerMessage, ctx: RaceFinishHandlerCallbacks): boolean {
  const current = ctx.getSettings();

  switch (msg.type) {
    case 'LANE_FINISH': {
      const { lane, timeMs, rank, snapshotUrl } = msg.payload || {};
      if (typeof lane === 'number') {
        ctx.setRunners((prev) =>
          prev.map((r) =>
            r.lane === lane
              ? {
                  ...r,
                  finishTime: typeof timeMs === 'number' ? timeMs : r.finishTime,
                  rank: rank || r.rank,
                  crossingSnapshot: snapshotUrl || r.crossingSnapshot,
                }
              : r
          )
        );
      }
      return true;
    }

    case 'RACE_COMPLETE':
      ctx.setRaceStatus('finished');
      ctx.stopLocalClock();
      athleticsAudio.playWhistle(0.5, 2, current.soundVolume, current.soundPitch);
      if (msg.payload?.runners) {
        ctx.setRunners(msg.payload.runners);
      }
      if (msg.payload && 'fullPhotoFinishUrl' in msg.payload && msg.payload.fullPhotoFinishUrl) {
        const photoUrl = msg.payload.fullPhotoFinishUrl;
        ctx.setHeats((prev) => {
          const updated = [...prev];
          const idx = ctx.getCurrentHeatIndex();
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], fullPhotoFinishUrl: photoUrl };
          }
          return updated;
        });
      }
      if (ctx.saveRaceToArchive) {
        ctx.saveRaceToArchive({
          runners: msg.payload?.runners || ctx.getRunners(),
          fullPhotoFinishUrl: msg.payload && 'fullPhotoFinishUrl' in msg.payload ? msg.payload.fullPhotoFinishUrl : undefined,
        });
      }
      ctx.setShowPodium(true);
      return true;

    case 'SLIT_SCAN_IMAGE':
      if (msg.payload && 'fullPhotoFinishUrl' in msg.payload && msg.payload.fullPhotoFinishUrl) {
        const photoUrl = msg.payload.fullPhotoFinishUrl;
        ctx.setHeats((prev) => {
          const updated = [...prev];
          const idx = ctx.getCurrentHeatIndex();
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], fullPhotoFinishUrl: photoUrl };
          }
          return updated;
        });
      }
      return true;

    case 'JUDGE_UPDATE_RUNNER': {
      const { lane, updates } = msg.payload || {};
      if (typeof lane === 'number' && updates) {
        ctx.setRunners((prev) => {
          const updated = prev.map((r) => (r.lane === lane ? { ...r, ...updates } : r));
          if (updates.finishTime !== undefined) {
            const sorted = [...updated]
              .filter((r) => r.finishTime > 0)
              .sort((a, b) => a.finishTime - b.finishTime);
            sorted.forEach((r, idx) => {
              r.rank = idx + 1;
            });
          }
          return updated;
        });
      }
      return true;
    }

    default:
      return false;
  }
}
