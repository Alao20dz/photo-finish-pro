import { create } from 'zustand';

export interface NetworkState {
  connectionMode: 'ws' | 'mqtt' | 'peer' | 'offline';
  latencyMs: number;
  mqttLatencyMs: number;
  isMqttConnected: boolean;
  isWsConnected: boolean;
  isPeerConnected: boolean;
  pendingSyncCount: number;

  // إشارات الأجراس والتنبيه الميداني
  isHoldingBell: boolean;
  isPeerSirenRinging: boolean;
  isReceivingBellAlert: boolean;

  // Actions
  setConnectionMode: (mode: 'ws' | 'mqtt' | 'peer' | 'offline') => void;
  setLatencyMs: (ms: number) => void;
  setMqttLatencyMs: (ms: number) => void;
  setIsMqttConnected: (connected: boolean) => void;
  setIsWsConnected: (connected: boolean) => void;
  setIsPeerConnected: (connected: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setIsHoldingBell: (holding: boolean) => void;
  setIsPeerSirenRinging: (ringing: boolean) => void;
  setIsReceivingBellAlert: (receiving: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  connectionMode: 'offline',
  latencyMs: 0,
  mqttLatencyMs: 0,
  isMqttConnected: false,
  isWsConnected: false,
  isPeerConnected: false,
  pendingSyncCount: 0,
  isHoldingBell: false,
  isPeerSirenRinging: false,
  isReceivingBellAlert: false,

  setConnectionMode: (connectionMode) => set({ connectionMode }),
  setLatencyMs: (latencyMs) => set({ latencyMs }),
  setMqttLatencyMs: (mqttLatencyMs) => set({ mqttLatencyMs }),
  setIsMqttConnected: (isMqttConnected) => set({ isMqttConnected }),
  setIsWsConnected: (isWsConnected) => set({ isWsConnected }),
  setIsPeerConnected: (isPeerConnected) => set({ isPeerConnected }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setIsHoldingBell: (isHoldingBell) => set({ isHoldingBell }),
  setIsPeerSirenRinging: (isPeerSirenRinging) => set({ isPeerSirenRinging }),
  setIsReceivingBellAlert: (isReceivingBellAlert) => set({ isReceivingBellAlert })
}));
