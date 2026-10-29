import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themes } from '../src/theme.ts';

test('both themes define the complete semantic color palette', () => {
  const requiredColors = [
    'background',
    'surface',
    'elevated',
    'border',
    'text',
    'secondary',
    'primary',
    'onPrimary',
    'info',
    'success',
    'warning',
    'error',
    'overlay',
  ];

  for (const theme of Object.values(themes)) {
    for (const color of requiredColors) {
      assert.ok(color in theme.colors, `Missing ${color} in ${theme.mode} theme`);
    }
    assert.equal(theme.sizes.controlHeight, 48);
    assert.equal(theme.sizes.chipHeight, 48);
  }
});

test('dark palette matches the product design tokens', () => {
  assert.equal(themes.dark.colors.background, '#0A0E14');
  assert.equal(themes.dark.colors.surface, '#131A24');
  assert.equal(themes.dark.colors.elevated, '#1B2431');
  assert.equal(themes.dark.colors.border, '#263041');
  assert.equal(themes.dark.colors.text, '#F3F6FA');
  assert.equal(themes.dark.colors.secondary, '#9AA7B8');
  assert.equal(themes.dark.colors.primary, '#C8FF3D');
});
