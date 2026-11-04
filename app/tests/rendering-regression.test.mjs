import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act as rendererAct } from 'react-test-renderer';
import test from 'node:test';
import { MockBeaconProvider } from '../src/beacon/MockBeaconProvider.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const element = (tag) => {
  const Component = ({ children }) => React.createElement(tag, null, children);
  Component.displayName = tag;
  return Component;
};
const View = element('div');
const Text = element('span');
const Pressable = element('button');
const icons = new Proxy({}, { get: () => () => null });
const theme = {
  colors: {
    background: '#040B14',
    surface: '#071B30',
    elevated: '#0C2744',
    border: '#64798E',
    text: '#FFFFFF',
    secondary: '#8FA3BA',
    primary: '#00B6F7',
    primaryStart: '#00C6FF',
    primaryEnd: '#0084FD',
    onPrimary: '#FFFFFF',
    success: '#28DB9E',
    warning: '#E0B24A',
    danger: '#FF6B4A',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '5xl': 48 },
  sizes: {
    controlHeight: 48,
    border: 1,
    contentMaxWidth: 720,
    pagePadding: 20,
    pageTopPadding: 20,
    fullWidth: '100%',
  },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  typography: {
    fontFamily: { regular: 'Inter', medium: 'Inter', semiBold: 'Inter', bold: 'Inter' },
    fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '3xl': 32 },
    lineHeight: { sm: 16, md: 22, lg: 26, xl: 30, '3xl': 38 },
  },
};

const exercise = {
  _id: 'exercise-selected',
  name: 'Agachamento',
  recommendedSets: 3,
  recommendedReps: 12,
  steps: [],
  commonMistakes: [],
  media: {},
};
const equipment = {
  _id: 'equipment-selected',
  name: 'Leg press',
  areaId: { _id: 'area-id', name: 'Musculação', description: '' },
  beacon: { uuid: 'b6f2d3b0-2a7c-4c52-8e90-02bd52100001', major: 12, minor: 34 },
  adjustments: [],
  exerciseIds: [exercise],
  media: {},
};
let appState;
let routeParams;
const routerCalls = [];
const screenRenderCounts = { home: 0, equipment: 0 };
const storeSubscribers = new Set();
let activeStoreHook = (selector) => React.useSyncExternalStore(
  (listener) => {
    storeSubscribers.add(listener);
    return () => storeSubscribers.delete(listener);
  },
  () => selector(appState),
  () => selector(appState),
);
let activeGetState = () => appState;
const updateAppState = (updates) => {
  appState = { ...appState, ...updates };
  for (const listener of storeSubscribers) listener();
};
const useAppStore = (selector) => activeStoreHook(selector);
useAppStore.getState = () => activeGetState();
const router = {
  push: (...args) => routerCalls.push(['push', ...args]),
  replace: (...args) => routerCalls.push(['replace', ...args]),
  back: () => routerCalls.push(['back']),
  setParams: (...args) => routerCalls.push(['setParams', ...args]),
};

const component = (tag = 'div') => {
  const Base = element(tag);
  return (props) => React.createElement(Base, null, props.children ?? props.label ?? null);
};
const components = {
  Button: component('button'),
  Card: component(),
  EmptyState: component(),
  ErrorState: component(),
  Skeleton: component(),
  Tabs: (props) => {
    screenRenderCounts.equipment += 1;
    return React.createElement('div', null, props.children);
  },
  Toast: () => null,
};
const mockModules = {
  'react-native': {
    View,
    Text,
    Pressable,
    Image: element('img'),
    AppState: { addEventListener: () => ({ remove() {} }) },
  },
  'expo-router': {
    useRouter: () => router,
    useLocalSearchParams: () => routeParams,
  },
  'lucide-react-native': icons,
  'expo-linear-gradient': { LinearGradient: component() },
  'expo-video': { useVideoPlayer: () => null, VideoView: component() },
  '@tanstack/react-query': {
    useQuery: ({ queryKey }) => ({
      data: queryKey?.[0] === 'equipment' ? equipment : [],
      isSuccess: true,
      isLoading: false,
      isError: false,
    }),
  },
  'react-hook-form': {
    Controller: ({ render }) => render({
      field: { onBlur() {}, onChange() {}, value: 0 },
      fieldState: { error: undefined },
    }),
    useForm: () => ({
      control: {},
      handleSubmit: () => () => undefined,
      setValue() {},
    }),
  },
  '@hookform/resolvers/zod': { zodResolver: () => () => ({ values: {}, errors: {} }) },
  '../src/components': components,
  '../src/components/BrandLockup': {
    BrandLockup: () => {
      screenRenderCounts.home += 1;
      return React.createElement('div');
    },
  },
  '../src/components/ScreenContainer': { ScreenContainer: component() },
  '../src/components/ScreenHeader': { ScreenHeader: component() },
  '../src/components/AppTextInput': { AppTextInput: () => null },
  '../src/components/StudentTabBar': { StudentTabBar: () => null },
  '../src/api/services': {
    fetchAreas: async () => [],
    fetchAllTrainingSessions: async () => [],
  },
  '../src/api/trainingProgress': {
    formatDurationMinutes: (minutes) => `${minutes} min`,
    getTrainingProgress: () => ({ workouts: 0, durationMinutes: 0, sets: 0 }),
  },
  '../src/student/homePresentation': {
    getEquipmentRoute: () => '/equipment',
    shouldShowNearbyEquipmentBanner: (item) => item !== null,
  },
  '../src/student/workoutPresentation': {
    getWorkoutRoute: () => '/workout',
  },
  '../src/student/workoutClock': loadTranspiled('../src/student/workoutClock.ts', {}),
  '../src/student/StudentBeaconRuntime': {
    useStudentBeacon: () => ({
      status: 'scanning',
      message: null,
      isMock: true,
      canSimulateExit: false,
      simulate(scenario) {
        if (scenario === 'approach') updateAppState({ detectedEquipment: equipment });
      },
      finishSession: async () => {},
      checkpointWorkout: async () => {},
      retryFinish: async () => {},
      startWorkout: async () => {},
      forceEndSession() {},
      lastWorkoutConclusion: null,
      sessionFeedback: null,
    }),
  },
  '../src/state/store': {
    useAppStore,
  },
  '../src/theme/ThemeProvider': { useTheme: () => theme },
};

function loadTranspiled(relativePath, mocks) {
  const filename = fileURLToPath(new globalThis.URL(relativePath, import.meta.url));
  const source = readFileSync(filename, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const screenModule = new Module(filename);
  screenModule.filename = filename;
  screenModule.paths = Module._nodeModulePaths(dirname(filename));
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === filename && request in mocks) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    screenModule._compile(javascript, filename);
  } finally {
    Module._load = originalLoad;
  }
  return screenModule.exports;
}

function loadScreen(relativePath) {
  return loadTranspiled(relativePath, mockModules).default;
}

let persistWriteCount = 0;
const persistedPayloads = [];
function loadRealStore() {
  const workoutClock = loadTranspiled('../src/student/workoutClock.ts', {});
  return loadTranspiled('../src/state/store.ts', {
    './secureStorage.ts': {
      secureStateStorage: {
        getItem: () => null,
        setItem: (_key, value) => {
          persistWriteCount += 1;
          persistedPayloads.push(value);
        },
        removeItem() {},
      },
    },
    '../student/workoutClock.ts': workoutClock,
  });
}

const HomeScreen = loadScreen('../app/home.tsx');
const EquipmentScreen = loadScreen('../app/equipment.tsx');
const WorkoutScreen = loadScreen('../app/workout.tsx');

test('Home and Workout render with a nearby Mock beacon without React or navigation errors', () => {
  appState = {
    user: { id: 'student-id', name: 'Atleta FitBeacon' },
    activeWorkout: {
      clientSessionId: 'session-id',
      equipment,
      origin: 'beacon',
      exerciseId: exercise._id,
      startedAt: new Date(1_000).toISOString(),
      resumedAt: new Date(1_000).toISOString(),
      accumulatedSeconds: 0,
      pausedAt: null,
      timerStatus: 'running',
      exerciseIndex: 0,
      sets: [],
    },
    trackingConsent: true,
    developerMode: false,
    detectedEquipment: equipment,
    addWorkoutSet() {},
    setWorkoutProgress() {},
    pauseWorkout() {},
    resumeWorkout() {},
  };
  routeParams = {
    equipmentId: equipment._id,
    exerciseId: exercise._id,
    origin: 'beacon',
  };
  routerCalls.length = 0;
  const errors = [];
  const originalConsoleError = globalThis.console.error;
  globalThis.console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    renderToStaticMarkup(React.createElement(HomeScreen));
    renderToStaticMarkup(React.createElement(WorkoutScreen));
  } finally {
    globalThis.console.error = originalConsoleError;
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(routerCalls, []);
});

test('Home, Equipamento e Treino com store real e Mock não atualizam outras telas a cada tick', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000 });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const realStore = loadRealStore().useAppStore;
  activeStoreHook = realStore;
  activeGetState = realStore.getState;
  realStore.getState().clearSession();
  realStore.getState().setSession(
    { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' },
    { id: 'student-id', name: 'Atleta FitBeacon', consentTracking: true },
  );
  realStore.getState().setDeveloperMode(true);
  realStore.getState().setDetectedEquipment(null);
  realStore.getState().startWorkout({
    clientSessionId: 'session-id',
    equipment,
    origin: 'beacon',
    exerciseId: exercise._id,
    startedAt: new Date(1_000).toISOString(),
    resumedAt: new Date(1_000).toISOString(),
    accumulatedSeconds: 0,
    pausedAt: null,
    timerStatus: 'running',
    exerciseIndex: 0,
    sets: [],
  });
  assert.equal(
    Object.hasOwn(JSON.parse(persistedPayloads.at(-1)).state, 'activeWorkout'),
    false,
  );
  storeSubscribers.clear();
  routeParams = { equipmentId: equipment._id, exerciseId: exercise._id, origin: 'beacon' };
  screenRenderCounts.home = 0;
  screenRenderCounts.equipment = 0;
  const errors = [];
  const originalConsoleError = globalThis.console.error;
  let tree;
  const provider = new MockBeaconProvider(equipment.beacon);
  let readingsAboveThreshold = 0;
  let approachDetected = false;
  const startPersistWrites = persistWriteCount;
  globalThis.console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    await provider.start((reading) => {
      if (reading.rssi > -70 && ++readingsAboveThreshold === 3) {
        approachDetected = true;
        realStore.getState().setDetectedEquipment(equipment);
      }
    }, () => {});
    rendererAct(() => {
      tree = TestRenderer.create(React.createElement(
        React.Fragment,
        null,
        React.createElement(HomeScreen),
        React.createElement(EquipmentScreen),
        React.createElement(WorkoutScreen),
      ));
    });
    const rendersBeforeTicks = { ...screenRenderCounts };
    rendererAct(() => {
      provider.simulate('approach');
      context.mock.timers.tick(30_000);
    });
    assert.equal(approachDetected, true);
    assert.equal(realStore.getState().detectedEquipment, equipment);
    assert.ok(screenRenderCounts.home <= rendersBeforeTicks.home + 1);
    assert.equal(screenRenderCounts.equipment, rendersBeforeTicks.equipment);
    assert.equal(persistWriteCount - startPersistWrites, 1);
    assert.equal(
      errors.some((error) =>
        /Cannot update a component|while rendering a different component/i.test(error),
      ),
      false,
      errors.join('\n'),
    );
  } finally {
    rendererAct(() => tree?.unmount());
    await provider.stop();
    activeStoreHook = (selector) => React.useSyncExternalStore(
      (listener) => {
        storeSubscribers.add(listener);
        return () => storeSubscribers.delete(listener);
      },
      () => selector(appState),
      () => selector(appState),
    );
    activeGetState = () => appState;
    globalThis.console.error = originalConsoleError;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
