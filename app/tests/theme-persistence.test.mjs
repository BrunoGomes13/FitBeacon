import assert from 'node:assert/strict';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setImmediate } from 'node:timers';
import { fileURLToPath, URL } from 'node:url';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTranspiled(relativePath, mocks) {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const source = readFileSync(filename, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = new Module(filename);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(dirname(filename));
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === filename && request in mocks) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    loadedModule._compile(javascript, filename);
  } finally {
    Module._load = originalLoad;
  }
  return loadedModule.exports;
}

test('a preferência de tema do app persiste e é reidratada pelo store real', async () => {
  let serializedState = null;
  const { useAppStore } = loadTranspiled('../src/state/store.ts', {
    './secureStorage.ts': {
      secureStateStorage: {
        getItem: async () => serializedState,
        setItem: async (_key, value) => {
          serializedState = value;
        },
        removeItem: async () => {
          serializedState = null;
        },
      },
    },
    '../student/workoutClock.ts': {
      pauseWorkoutClock: (workout) => workout,
      resumeWorkoutClock: (workout) => workout,
    },
  });

  useAppStore.getState().setThemePreference('light');
  await new Promise(setImmediate);
  assert.equal(JSON.parse(serializedState).state.themePreference, 'light');

  const secondStore = loadTranspiled('../src/state/store.ts', {
    './secureStorage.ts': {
      secureStateStorage: {
        getItem: async () => serializedState,
        setItem: async (_key, value) => {
          serializedState = value;
        },
        removeItem: async () => {
          serializedState = null;
        },
      },
    },
    '../student/workoutClock.ts': {
      pauseWorkoutClock: (workout) => workout,
      resumeWorkoutClock: (workout) => workout,
    },
  }).useAppStore;
  await secondStore.persist.rehydrate();
  assert.equal(secondStore.getState().themePreference, 'light');
});
