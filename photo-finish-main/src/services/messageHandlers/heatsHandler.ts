import { NetworkPeerMessage, Heat, Runner, RaceSettings } from '../../types/race';
import { athleticsAudio } from '../audioService';

export interface HeatsHandlerCallbacks {
  setCurrentHeatIndex: (idx: number) => void;
  setRunners: (runners: Runner[] | ((prev: Runner[]) => Runner[])) => void;
  setSettings: (settings: RaceSettings | ((prev: RaceSettings) => RaceSettings)) => void;
  setHeats: (heats: Heat[] | ((prev: Heat[]) => Heat[])) => void;
  setDispatchedHeatId: (id: string | null) => void;
  setRaceStatus: (status: any) => void;
  handleLocalReset: () => void;
}

export function handleHeatsMessage(msg: NetworkPeerMessage, ctx: HeatsHandlerCallbacks): boolean {
  switch (msg.type) {
    case 'HEAT_CHANGE': {
      const { heatIndex, heat } = msg.payload || {};
      if (typeof heatIndex === 'number') {
        ctx.setCurrentHeatIndex(heatIndex);
        if (heat?.runners) ctx.setRunners(heat.runners);
        if (heat) {
          ctx.setSettings((prev) => ({
            ...prev,
            distance: heat.distance || prev.distance,
            heatNumber: heat.number,
            heatName: heat.name,
          }));
        }
        ctx.handleLocalReset();
      }
      return true;
    }

    case 'HEATS_SYNC':
      if (msg.payload?.heats) {
        ctx.setHeats(msg.payload.heats);
      }
      return true;

    case 'HEAT_DISPATCH': {
      const { heatId, heatIndex } = msg.payload || {};
      ctx.setDispatchedHeatId(heatId || null);
      ctx.setHeats((prev) =>
        prev.map((h, idx) => ({
          ...h,
          isDispatched: h.id === heatId || idx === heatIndex,
          dispatchedAt: h.id === heatId || idx === heatIndex ? Date.now() : h.dispatchedAt,
        }))
      );
      if (typeof heatIndex === 'number') {
        ctx.setCurrentHeatIndex(heatIndex);
      }
      athleticsAudio.playWhistle(0.3, 1, 1.2, 1.2);
      return true;
    }

    case 'HEAT_CANCEL_DISPATCH':
      ctx.setDispatchedHeatId(null);
      ctx.setHeats((prev) =>
        prev.map((h) => ({
          ...h,
          isDispatched: false,
          dispatchedAt: undefined,
        }))
      );
      ctx.setRaceStatus('waiting');
      athleticsAudio.playBeep(300, 0.3);
      return true;

    case 'HEATS_REORDER':
      if (msg.payload?.heats) {
        ctx.setHeats(msg.payload.heats);
      }
      return true;

    case 'DELETE_HEAT': {
      const { heatId } = msg.payload || {};
      if (heatId) {
        ctx.setHeats((prev) => prev.filter((h) => h.id !== heatId));
      }
      return true;
    }

    default:
      return false;
  }
}
