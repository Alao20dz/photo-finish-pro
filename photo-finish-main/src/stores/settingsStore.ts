import { create } from 'zustand';
import { RaceSettings } from '../types/race';

export const DEFAULT_SETTINGS: RaceSettings = {
  distance: '100m',
  availableDistances: ['50m', '60m', '100m', '200m', '400m', '800m', '1500m', '4x100m'],
  heatNumber: 1,
  heatName: 'قائمة 1 (تصفية أولى)',
  laneCount: 4,
  finishLineXPercent: 0.35,
  finishLineColor: '#EF4444',
  finishLineWidth: 2,
  preFinishLineXPercent: 0.22,
  preFinishLineColor: '#00E5FF',
  postFinishLineXPercent: 0.52,
  postFinishLineColor: '#A855F7',
  motionThreshold: 20,
  laserBeamVisible: true,
  gunSoundType: 'official_starter_gun',
  soundVolume: 1.8,
  soundPitch: 1.0,
  stadiumAcoustics: true,
  stadiumReverbLevel: 0.65,
  stadiumAmbience: true,
  hapticFeedback: true,
  starterMode: 'auto_random',
  autoDelayDuration: 2.0,
  slitScanWidth: 2,
  windSpeed: '+1.2 m/s',
  autoStopAfterLastRunner: true,
  cameraPlacement: 'side_classic', // الوضعية التاريخية الافتراضية
};

export interface SettingsState {
  settings: RaceSettings;

  // Actions
  setSettings: (settings: RaceSettings | ((prev: RaceSettings) => RaceSettings)) => void;
  updateSettings: (partial: Partial<RaceSettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,

  setSettings: (val) => set((state) => ({
    settings: typeof val === 'function' ? val(state.settings) : val
  })),

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial }
  })),

  resetSettings: () => set({ settings: DEFAULT_SETTINGS })
}));
