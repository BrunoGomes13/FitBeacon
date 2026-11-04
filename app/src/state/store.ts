import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppUser, Equipment, SessionSetInput } from '../api/schemas.ts';
import { secureStateStorage } from './secureStorage.ts';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ActiveWorkout = {
  clientSessionId: string;
  equipment: Equipment;
  startedAt: string;
  elapsedSeconds: number;
  exerciseIndex: number;
  sets: SessionSetInput[];
};

type AppState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AppUser | null;
  rememberSession: boolean;
  onboardingComplete: boolean;
  themePreference: ThemePreference;
  trackingConsent: boolean;
  developerMode: boolean;
  useMockBeacons: boolean;
  activeWorkout: ActiveWorkout | null;
  detectedEquipment: Equipment | null;
  profilePhotoUri: string | null;
  hasHydrated: boolean;
  setSession: (
    tokens: { accessToken: string; refreshToken: string },
    user: AppUser,
    rememberSession?: boolean,
  ) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
  completeOnboarding: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  setTrackingConsent: (consent: boolean, user?: AppUser) => void;
  setDeveloperMode: (enabled: boolean) => void;
  setUseMockBeacons: (enabled: boolean) => void;
  startWorkout: (workout: ActiveWorkout) => void;
  setDetectedEquipment: (equipment: Equipment | null) => void;
  setProfilePhotoUri: (uri: string | null) => void;
  addWorkoutSet: (set: SessionSetInput) => void;
  setWorkoutProgress: (progress: { elapsedSeconds?: number; exerciseIndex?: number }) => void;
  clearWorkout: () => void;
  setHasHydrated: (hydrated: boolean) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      rememberSession: true,
      onboardingComplete: false,
      themePreference: 'system',
      trackingConsent: false,
      developerMode: false,
      useMockBeacons: true,
      activeWorkout: null,
      detectedEquipment: null,
      profilePhotoUri: null,
      hasHydrated: false,
      setSession: (tokens, user, rememberSession = true) =>
        set({
          ...tokens,
          user,
          rememberSession,
          trackingConsent: user.consentTracking,
        }),
      setTokens: (tokens) => set(tokens),
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          rememberSession: true,
          trackingConsent: false,
          activeWorkout: null,
          detectedEquipment: null,
          profilePhotoUri: null,
        }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setTrackingConsent: (trackingConsent, user) =>
        set((state) => ({
          trackingConsent,
          user: user ?? (state.user ? { ...state.user, consentTracking: trackingConsent } : null),
        })),
      setDeveloperMode: (developerMode) => set({ developerMode }),
      setUseMockBeacons: (useMockBeacons) => set({ useMockBeacons }),
      startWorkout: (activeWorkout) => set({ activeWorkout }),
      setDetectedEquipment: (detectedEquipment) => set({ detectedEquipment }),
      setProfilePhotoUri: (profilePhotoUri) => set({ profilePhotoUri }),
      addWorkoutSet: (workoutSet) =>
        set((state) =>
          state.activeWorkout
            ? {
                activeWorkout: {
                  ...state.activeWorkout,
                  sets: [...state.activeWorkout.sets, workoutSet],
                },
              }
            : state,
        ),
      setWorkoutProgress: (progress) =>
        set((state) => state.activeWorkout
          ? {
              activeWorkout: {
                ...state.activeWorkout,
                ...progress,
              },
            }
          : state),
      clearWorkout: () => set({ activeWorkout: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'fitbeacon-private-state',
      storage: createJSONStorage(() => secureStateStorage),
      partialize: (state) => ({
        ...(state.rememberSession
          ? {
              accessToken: state.accessToken,
              refreshToken: state.refreshToken,
              user: state.user,
            }
          : {}),
        rememberSession: state.rememberSession,
        onboardingComplete: state.onboardingComplete,
        themePreference: state.themePreference,
        trackingConsent: state.trackingConsent,
        profilePhotoUri: state.profilePhotoUri,
        developerMode: state.developerMode,
        useMockBeacons: state.useMockBeacons,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
