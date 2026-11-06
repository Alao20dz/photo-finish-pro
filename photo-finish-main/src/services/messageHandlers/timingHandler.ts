import { NetworkPeerMessage, RaceSettings } from '../../types/race';
import { athleticsAudio } from '../audioService';

export interface TimingHandlerCallbacks {
  setRaceStatus: (status: any) => void;
  startLocalClock: (startTime: number) => void;
  stopLocalClock: () => void;
  handleLocalReset: () => void;
  clockOffsetMs: number;
  getSettings: () => RaceSettings;
}

export function handleTimingMessage(msg: NetworkPeerMessage, ctx: TimingHandlerCallbacks): boolean {
  const current = ctx.getSettings();

  switch (msg.type) {
    case 'ON_MARKS':
      ctx.setRaceStatus('on_marks');
      athleticsAudio.playBeep(440, 0.2);
      athleticsAudio.speakArabic('خذ مكانك');
      return true;

    case 'SET':
      ctx.setRaceStatus('set');
      athleticsAudio.playBeep(660, 0.25);
      athleticsAudio.speakArabic('استعد');
      return true;

    case 'START_GUN': {
      ctx.setRaceStatus('racing');
      const soundVol = msg.payload?.soundVolume ?? current.soundVolume;
      const soundPitch = msg.payload?.soundPitch ?? current.soundPitch;
      athleticsAudio.playStarterSound(soundVol, soundPitch);

      // توقيت البداية الدقيق مع تطبيق تصحيح فارق التوقيت NTP
      const rawStartTime = msg.payload?.startTime || msg.timestamp || Date.now();
      const synchronizedStartTime = rawStartTime + (ctx.clockOffsetMs || 0);
      ctx.startLocalClock(synchronizedStartTime);
      return true;
    }

    case 'RECALL_GUN':
      ctx.setRaceStatus('false_start');
      athleticsAudio.playRecallGun(current.soundVolume, current.soundPitch);
      ctx.stopLocalClock();
      return true;

    case 'SYNC_RESET_ALL':
      ctx.handleLocalReset();
      return true;

    default:
      return false;
  }
}
