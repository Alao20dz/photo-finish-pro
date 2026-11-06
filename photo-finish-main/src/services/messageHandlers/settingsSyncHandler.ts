import { NetworkPeerMessage, RaceSettings, Runner, Heat, PhoneRole } from '../../types/race';
import { athleticsNetwork } from '../networkService';

export interface SettingsSyncHandlerCallbacks {
  setSettings: (settings: RaceSettings | ((prev: RaceSettings) => RaceSettings)) => void;
  setRunners: (runners: Runner[] | ((prev: Runner[]) => Runner[])) => void;
  setHeats: (heats: Heat[] | ((prev: Heat[]) => Heat[])) => void;
  setRaceStatus: (status: any) => void;
  setClockTimeMs: (ms: number) => void;
  setCurrentHeatIndex: (idx: number) => void;
  getCurrentHeatIndex: () => number;
  getSettings: () => RaceSettings;
  getRunners: () => Runner[];
  getHeats: () => Heat[];
  getRaceStatus: () => any;
  getClockTimeMs: () => number;
  role: PhoneRole;
}

export function handleSettingsSyncMessage(msg: NetworkPeerMessage, ctx: SettingsSyncHandlerCallbacks): boolean {
  switch (msg.type) {
    case 'SETTINGS_SYNC':
      if (msg.payload?.settings) {
        ctx.setSettings(msg.payload.settings);
      }
      if (msg.payload?.runners) {
        const newRunners = msg.payload.runners;
        ctx.setRunners(newRunners);
        ctx.setHeats((prev) => {
          const updated = [...prev];
          const idx = typeof msg.payload?.heatIndex === 'number' ? msg.payload.heatIndex : ctx.getCurrentHeatIndex();
          if (updated[idx]) {
            updated[idx] = { ...updated[idx], runners: newRunners };
          }
          return updated;
        });
      }
      if (msg.payload?.heats) {
        ctx.setHeats(msg.payload.heats);
      }
      return true;

    case 'REQUEST_STATE_SYNC':
      athleticsNetwork.sendMessage({
        type: 'RESPONSE_STATE_SYNC',
        timestamp: Date.now(),
        senderTime: Date.now(),
        payload: {
          settings: ctx.getSettings(),
          runners: ctx.getRunners(),
          raceStatus: ctx.getRaceStatus(),
          clockTimeMs: ctx.getClockTimeMs(),
          heats: ctx.getHeats(),
          currentHeatIndex: ctx.getCurrentHeatIndex(),
          fromRole: ctx.role,
        },
      });
      return true;

    case 'RESPONSE_STATE_SYNC':
      if (msg.payload) {
        if (msg.payload.settings) {
          ctx.setSettings(msg.payload.settings);
        }
        if (msg.payload.runners) ctx.setRunners(msg.payload.runners);
        if (msg.payload.raceStatus) ctx.setRaceStatus(msg.payload.raceStatus);
        if (msg.payload.clockTimeMs) ctx.setClockTimeMs(msg.payload.clockTimeMs);
        if (msg.payload.heats) ctx.setHeats(msg.payload.heats);
        if (typeof msg.payload.currentHeatIndex === 'number') {
          ctx.setCurrentHeatIndex(msg.payload.currentHeatIndex);
        }
      }
      return true;

    default:
      return false;
  }
}
