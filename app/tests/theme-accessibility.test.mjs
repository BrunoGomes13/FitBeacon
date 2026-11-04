import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themes } from '../src/theme.ts';
import { selectThemeAsset } from '../src/brand/selectThemeAsset.ts';
import { getMapZones } from '../src/student/mapPresentation.ts';

function luminance(hex) {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('texto, links, estados e gradiente atendem WCAG AA nos dois temas', () => {
  for (const [mode, theme] of Object.entries(themes)) {
    const surfaces = [theme.colors.background, theme.colors.surface, theme.colors.elevated];
    for (const surface of surfaces) {
      assert.ok(contrast(theme.colors.text, surface) >= 4.5, `${mode}: texto em ${surface}`);
      assert.ok(contrast(theme.colors.secondary, surface) >= 4.5, `${mode}: texto secundário em ${surface}`);
      assert.ok(contrast(theme.colors.primary, surface) >= 4.5, `${mode}: link em ${surface}`);
      assert.ok(contrast(theme.colors.success, surface) >= 4.5, `${mode}: sucesso em ${surface}`);
      assert.ok(contrast(theme.colors.warning, surface) >= 4.5, `${mode}: alerta em ${surface}`);
      assert.ok(contrast(theme.colors.error, surface) >= 4.5, `${mode}: erro em ${surface}`);
      assert.ok(contrast(theme.colors.border, surface) >= 3, `${mode}: borda em ${surface}`);
    }
    assert.ok(contrast(theme.colors.onPrimary, theme.colors.primaryStart) >= 4.5, `${mode}: início do gradiente`);
    assert.ok(contrast(theme.colors.onPrimary, theme.colors.primaryEnd) >= 4.5, `${mode}: fim do gradiente`);
  }
});

test('seleção da marca acompanha o tema sem substituir o asset de fallback', () => {
  const lightLogo = { uri: 'logo-fitbeacon-claro.png' };
  const darkLogo = { uri: 'logo-fitbeacon-transparente.png' };
  assert.equal(selectThemeAsset('light', lightLogo, darkLogo), lightLogo);
  assert.equal(selectThemeAsset('dark', lightLogo, darkLogo), darkLogo);
});

test('cores das áreas mantêm contraste legível no mapa em ambos os temas', () => {
  const areas = Array.from({ length: 8 }, (_, index) => ({
    _id: `area-${index}`,
    name: `Área ${index}`,
  }));
  for (const mode of ['light', 'dark']) {
    for (const zone of getMapZones(areas, mode)) {
      assert.ok(
        contrast(zone.color, themes[mode].colors.elevated) >= 4.5,
        `${mode}: ${zone.color} em ${themes[mode].colors.elevated}`,
      );
    }
  }
});
