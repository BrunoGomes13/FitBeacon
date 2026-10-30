import { expect, test, type Page } from '@playwright/test';

const widths = [320, 360, 390, 412, 768, 1024, 1440];
const admin = {
  id: 'student-1',
  gymId: 'gym-1',
  name: 'Administrador Teste',
  email: 'admin@example.test',
  role: 'admin',
  consentTracking: true,
};
const area = { _id: 'area-1', name: 'Área de musculação com nome comprido', description: 'Descrição da área', isActive: true };
const exercise = {
  _id: 'exercise-1',
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
  _id: 'equipment-1',
  gymId: 'gym-1',
  areaId: area,
  name: 'Aparelho com nome longo para testar quebra de texto no celular',
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
    equipment: [{ _id: 'equipment-1', name: equipment.name, sessions: 1, totalDurationSec: 600 }],
    areas: [{ _id: 'area-1', name: area.name, sessions: 1, totalDurationSec: 600 }],
  },
  hourlyUsage: [{ _id: 12, sessions: 1, totalDurationSec: 600 }],
  idleEquipment: { thresholdDays: 7, equipment: [] },
};

async function mockApi(page: Page): Promise<void> {
  await page.route('http://localhost:3000/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/auth/login') {
      await route.fulfill({ json: { user: admin, accessToken: 'access-test', refreshToken: 'refresh-test', tokenType: 'Bearer', expiresIn: '15m' } });
      return;
    }
    if (path === '/auth/logout') {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.startsWith('/admin/equipment')) {
      await route.fulfill({ json: { data: [equipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } });
      return;
    }
    if (path.startsWith('/admin/areas')) {
      await route.fulfill({ json: { data: [area], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } });
      return;
    }
    if (path.startsWith('/admin/exercises')) {
      await route.fulfill({ json: { data: [exercise], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } });
      return;
    }
    if (path === '/reports/summary') {
      await route.fulfill({ json: summary });
      return;
    }
    if (path === '/reports/usage') {
      await route.fulfill({ json: { data: summary.rankings.equipment, period: summary.period, groupBy: 'equipment' } });
      return;
    }
    if (path === '/reports/heatmap') {
      await route.fulfill({ json: { data: [{ areaId: area._id, areaName: area.name, hour: 12, sessions: 1, totalDurationSec: 600 }], period: summary.period } });
      return;
    }
    await route.fulfill({ json: { data: [] } });
  });
}

async function verifyNoHorizontalPageScroll(page: Page, screenName: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    overflowing: Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
      .filter(({ bounds }) => bounds.right > window.innerWidth + 1)
      .slice(0, 8)
      .map(({ element, bounds }) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)} right=${Math.round(bounds.right)}`),
  }));
  expect(dimensions.document, `${screenName}: document width ${dimensions.document} exceeds viewport ${dimensions.viewport}`).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body, `${screenName}: body width ${dimensions.body} exceeds viewport ${dimensions.viewport}; ${dimensions.overflowing.join(', ')}`).toBeLessThanOrEqual(dimensions.viewport);
}

async function goTo(page: Page, label: string): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
  if (await link.isVisible()) {
    await link.click();
    return;
  }
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('link', { name: label }).click();
}

test('não existe rolagem horizontal nas telas e larguras solicitadas', async ({ page }) => {
  test.setTimeout(180_000);
  await mockApi(page);

  for (const width of widths) {
    for (const landscape of [false, true]) {
      const height = landscape ? Math.max(240, Math.floor(width * 0.6)) : Math.floor(width * 1.6);
      await page.setViewportSize({ width, height });
      await page.goto('/login');
      await verifyNoHorizontalPageScroll(page, `login ${width}px ${landscape ? 'paisagem' : 'retrato'}`);
      await page.getByLabel('E-mail').fill('admin@example.test');
      await page.getByLabel('Senha').fill('senha-de-teste');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
      await verifyNoHorizontalPageScroll(page, `dashboard ${width}px`);

      for (const [label, heading] of [
        ['Mapa de calor', 'Mapa de calor'],
        ['Equipamentos', 'Equipamentos'],
        ['Áreas', 'Áreas'],
        ['Exercícios', 'Exercícios'],
        ['Relatórios', 'Relatórios'],
      ] as const) {
        await goTo(page, label);
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
        await verifyNoHorizontalPageScroll(page, `${heading} ${width}px ${landscape ? 'paisagem' : 'retrato'}`);

        if (label === 'Equipamentos' || label === 'Áreas' || label === 'Exercícios') {
          await expect(page.locator('.mobile-card-table :visible').getByText(/Aparelho com nome longo|Área de musculação|Exercício de demonstração/).first()).toBeVisible();
          await page.getByRole('button', { name: 'Novo' }).click();
          await verifyNoHorizontalPageScroll(page, `formulário ${heading} ${width}px`);
          await page.getByRole('button', { name: 'Cancelar' }).click();
        }
      }

      await page.goto('/login');
    }
  }
});
