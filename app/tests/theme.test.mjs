import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themes } from '../src/theme.ts';

function luminance(color) {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('both themes define the complete semantic color palette', () => {
  const requiredColors = [
    'background',
    'surface',
    'elevated',
    'border',
    'text',
    'secondary',
    'primary',
    'primaryStart',
    'primaryEnd',
    'onPrimary',
    'info',
    'success',
    'warning',
    'error',
    'overlay',
    'brandSurface',
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
  assert.equal(themes.dark.colors.background, '#040B14');
  assert.equal(themes.dark.colors.surface, '#071B30');
  assert.equal(themes.dark.colors.elevated, '#0C2744');
  assert.equal(themes.dark.colors.border, '#1E3F63');
  assert.equal(themes.dark.colors.text, '#FFFFFF');
  assert.equal(themes.dark.colors.secondary, '#8FA3BA');
  assert.equal(themes.dark.colors.primary, '#00B6F7');
  assert.equal(themes.dark.colors.primaryStart, '#007FA3');
  assert.equal(themes.dark.colors.primaryEnd, '#006FE0');
});

test('secondary text and white primary labels meet WCAG AA in both themes', () => {
  for (const theme of Object.values(themes)) {
    assert.ok(contrast(theme.colors.secondary, theme.colors.background) >= 4.5);
    assert.ok(contrast(theme.colors.secondary, theme.colors.surface) >= 4.5);
    assert.ok(contrast(theme.colors.onPrimary, theme.colors.primaryStart) >= 4.5);
    assert.ok(contrast(theme.colors.onPrimary, theme.colors.primaryEnd) >= 4.5);
  }
});
