import { create } from 'zustand';
import { PhoneRole, LicensePoolInfo, LicenseTierCode } from '../types/race';

export interface AuthState {
  role: PhoneRole;
  deviceId: string;
  roomCode: string;
  sessionToken: string | null;
  adminToken: string | null;
  effectiveTier: LicenseTierCode | 'TRIAL';
  licensePool: LicensePoolInfo | null;
  isAuthenticated: boolean;

  // Actions
  setRole: (role: PhoneRole) => void;
  setDeviceId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setSessionToken: (token: string | null) => void;
  setAdminToken: (token: string | null) => void;
  setEffectiveTier: (tier: LicenseTierCode | 'TRIAL') => void;
  setLicensePool: (pool: LicensePoolInfo | null) => void;
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: null,
  deviceId: '',
  roomCode: 'RACE-100',
  sessionToken: null,
  adminToken: null,
  effectiveTier: 'TRIAL',
  licensePool: null,
  isAuthenticated: false,

  setRole: (role) => set({ role }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setSessionToken: (sessionToken) => set({ sessionToken, isAuthenticated: !!sessionToken }),
  setAdminToken: (adminToken) => set({ adminToken }),
  setEffectiveTier: (effectiveTier) => set({ effectiveTier }),
  setLicensePool: (licensePool) => set({ licensePool }),
  resetAuth: () => set({
    role: null,
    sessionToken: null,
    adminToken: null,
    effectiveTier: 'TRIAL',
    licensePool: null,
    isAuthenticated: false
  })
}));
