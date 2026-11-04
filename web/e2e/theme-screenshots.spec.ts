import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const admin = {
  id: 'student-theme-test',
  gymId: 'gym-theme-test',
  name: 'Administrador Teste',
  email: 'admin@example.test',
  role: 'admin',
  consentTracking: true,
};
const area = { _id: 'area-test', name: 'Área de musculação', description: '', isActive: true };
const areas = [
  area,
  { _id: 'cardio', name: 'Cardio', description: '', isActive: true },
  { _id: 'functional', name: 'Funcional', description: '', isActive: true },
  { _id: 'upper', name: 'Membros superiores', description: '', isActive: true },
];
const exercise = {
  _id: 'exercise-test',
  name: 'Exercício de demonstração',
  muscleGroup: 'Quadríceps',
  steps: ['Posicionar os pés'],
  commonMistakes: ['Perder o alinhamento'],
  recommendedSets: 3,
  recommendedReps: 10,
  media: {},
  isActive: true,
};
const equipment = {
  _id: 'equipment-test',
  gymId: admin.gymId,
  areaId: area,
  name: 'Leg press',
  beacon: {
    uuid: 'b6f2d3b0-2a7c-4c52-8e90-02bd52100001',
    major: 12,
    minor: 34,
    txPower: -59,
    rssiEnter: -70,
    rssiExit: -78,
  },
  adjustments: [],
  exerciseIds: [exercise],
  media: {},
  isActive: true,
};
const summary = {
  period: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-30T23:59:59.999Z' },
  totals: { sessions: 1, totalDurationSec: 600, averageDurationSec: 600, activeStudents: 1, occupancyRate: 1 },
  rankings: {
    equipment: [{ _id: equipment._id, name: equipment.name, sessions: 1, totalDurationSec: 600 }],
    areas: [{ _id: area._id, name: area.name, sessions: 1, totalDurationSec: 600 }],
  },
  hourlyUsage: [{ _id: 12, sessions: 1, totalDurationSec: 600 }],
  idleEquipment: { thresholdDays: 7, equipment: [] },
};

async function mockApi(page: import('@playwright/test').Page): Promise<void> {
  await page.route('http://localhost:3000/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/auth/login') {
      await route.fulfill({
        json: {
          user: admin,
          accessToken: 'access-test',
          refreshToken: 'refresh-test',
          tokenType: 'Bearer',
          expiresIn: '15m',
        },
      });
    } else if (path === '/auth/logout') {
      await route.fulfill({ status: 204 });
    } else if (path.startsWith('/admin/equipment')) {
      await route.fulfill({ json: { data: [equipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } });
    } else if (path.startsWith('/admin/areas')) {
      await route.fulfill({ json: { data: areas, pagination: { page: 1, limit: 100, total: areas.length, pages: 1 } } });
    } else if (path.startsWith('/admin/exercises')) {
      await route.fulfill({ json: { data: [exercise], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } });
    } else if (path === '/reports/summary') {
      await route.fulfill({ json: summary });
    } else if (path === '/reports/usage') {
      await route.fulfill({ json: { data: summary.rankings.equipment, period: summary.period, groupBy: 'equipment' } });
    } else if (path === '/reports/heatmap') {
      await route.fulfill({
        json: {
          data: [{ areaId: area._id, areaName: area.name, hour: 12, sessions: 1, totalDurationSec: 600 }],
          period: summary.period,
        },
      });
    } else if (path === '/admin/gym/settings') {
      await route.fulfill({
        json: { data: { timeZone: 'America/Fortaleza', openingHour: 6, closingHour: 22 } },
      });
    } else {
      await route.fulfill({ json: { data: [] } });
    }
  });
}

async function navigateTo(page: import('@playwright/test').Page, label: string): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
  if (await link.isVisible()) {
    await link.click();
    return;
  }
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('link', { name: label }).click();
}

test('captura telas principais em claro e escuro, a 390 e 1440 px', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const screenshotDirectory = join(testInfo.project.testDir, '__screenshots__');
  mkdirSync(screenshotDirectory, { recursive: true });

  const screens = [
    { label: 'Visão geral', heading: 'Visão geral', name: 'dashboard' },
    { label: 'Mapa de calor', heading: 'Mapa de calor', name: 'heatmap' },
    { label: 'Mapa da academia', heading: 'Mapa da academia', name: 'gym-map' },
    { label: 'Equipamentos', heading: 'Equipamentos', name: 'equipment' },
    { label: 'Áreas', heading: 'Áreas', name: 'areas' },
    { label: 'Exercícios', heading: 'Exercícios', name: 'exercises' },
    { label: 'Relatórios', heading: 'Relatórios', name: 'reports' },
  ] as const;

  for (const mode of ['light', 'dark'] as const) {
    for (const width of [390, 1440] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: 'reduce',
        colorScheme: mode,
      });
      const page = await context.newPage();
      await mockApi(page);
      await page.goto('/login');
      await page.getByLabel('E-mail').fill('admin@example.test');
      await page.getByLabel('Senha').fill('senha-de-teste');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
      await page.locator('.theme-select:visible').first().selectOption(mode);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);

      for (const [index, screen] of screens.entries()) {
        if (index > 0) await navigateTo(page, screen.label);
        await expect(page.getByRole('heading', { name: screen.heading }).first()).toBeVisible();
        if (screen.name === 'dashboard') {
          await expect(page.locator('.recharts-wrapper')).toBeVisible();
        }
        await page.screenshot({
          path: join(screenshotDirectory, `${screen.name}-${mode}-${width}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      await context.close();
    }
  }
});
