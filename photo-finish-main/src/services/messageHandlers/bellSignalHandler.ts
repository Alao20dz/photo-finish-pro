import { NetworkPeerMessage, RaceSettings } from '../../types/race';
import { athleticsAudio } from '../audioService';
import { athleticsNetwork } from '../networkService';

export interface BellSignalHandlerCallbacks {
  setIsReceivingBellAlert: (receiving: boolean) => void;
  setIsPeerSirenRinging: (ringing: boolean) => void;
  getSettings: () => RaceSettings;
}

export function handleBellSignalMessage(msg: NetworkPeerMessage, ctx: BellSignalHandlerCallbacks): boolean {
  const current = ctx.getSettings();

  switch (msg.type) {
    case 'BELL_SIGNAL_START':
      ctx.setIsReceivingBellAlert(true);
      athleticsAudio.startPoliceSiren(current.soundVolume);
      athleticsNetwork.sendMessage({
        type: 'BELL_SIGNAL_ACK',
        timestamp: Date.now(),
        senderTime: Date.now(),
      });
      return true;

    case 'BELL_SIGNAL_STOP':
      ctx.setIsReceivingBellAlert(false);
      athleticsAudio.stopPoliceSiren();
      return true;

    case 'BELL_SIGNAL_ACK':
      ctx.setIsPeerSirenRinging(true);
      return true;

    default:
      return false;
  }
}
