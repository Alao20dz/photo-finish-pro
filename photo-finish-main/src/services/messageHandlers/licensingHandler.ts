import { NetworkPeerMessage, LicensePoolInfo, RaceSettings } from '../../types/race';
import { licenseManager } from '../licenseManager';

export interface LicensingHandlerCallbacks {
  setSharedPoolLicense: (pool: LicensePoolInfo | null) => void;
  setSettings: (settings: RaceSettings | ((prev: RaceSettings) => RaceSettings)) => void;
  getSettings: () => RaceSettings;
}

export function handleLicensingMessage(msg: NetworkPeerMessage, ctx: LicensingHandlerCallbacks): boolean {
  switch (msg.type) {
    case 'LICENSE_SHARE_POOL':
      if (msg.payload) {
        licenseManager.setReceivedSharedPool(msg.payload);
        ctx.setSharedPoolLicense(msg.payload);
        const current = ctx.getSettings();
        if (msg.payload.tier === 'ENTX' && current.laneCount < 10) {
          ctx.setSettings((prev) => ({ ...prev, laneCount: 10 }));
        } else if (msg.payload.tier === 'CLB8' && current.laneCount < 8) {
          ctx.setSettings((prev) => ({ ...prev, laneCount: Math.max(prev.laneCount, 8) }));
        }
      }
      return true;

    case 'LICENSE_REVOKE_AND_TRANSFER':
      if (msg.payload?.sourceDeviceId === licenseManager.deviceId) {
        licenseManager.resetToTrial();
        ctx.setSharedPoolLicense(null);
      }
      return true;

    default:
      return false;
  }
}
