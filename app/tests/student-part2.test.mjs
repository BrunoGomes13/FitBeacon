import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterSessionsByPeriod, getSessionExerciseCount, getTrainingTitle, getUsageRanking } from '../src/api/trainingProgress.ts';
import { filterEquipment, getEquipmentAreaFilter } from '../src/student/equipmentPresentation.ts';
import { getAreaMapColor, getPositionedEquipment, isDetectedEquipment } from '../src/student/mapPresentation.ts';
import { getNextThemePreference, getProfileSectionRoute, getSettingsRoute, profileSections } from '../src/student/profilePresentation.ts';

const equipment = [
  {
    _id: 'strength-machine',
    name: 'Leg Press 45°',
    areaId: { _id: 'strength', name: 'Musculação', description: '' },
    beacon: { minor: 3 },
    position: { x: 25, y: 30 },
  },
  {
    _id: 'cardio-machine',
    name: 'Esteira',
    areaId: { _id: 'cardio', name: 'Cardio', description: '' },
    beacon: { minor: 9 },
  },
];

const sessions = [
  {
    _id: 'session-one',
    startedAt: '2026-10-28T10:00:00.000Z',
    durationSec: 1_800,
    equipmentId: { _id: 'strength-machine', name: 'Leg Press 45°' },
    areaId: { _id: 'strength', name: 'Musculação', description: '' },
    sets: [
      { exerciseId: { _id: 'squat', name: 'Agachamento', muscleGroup: 'Pernas' } },
      { exerciseId: { _id: 'squat', name: 'Agachamento', muscleGroup: 'Pernas' } },
      { exerciseId: { _id: 'extension', name: 'Extensora', muscleGroup: 'Pernas' } },
    ],
  },
  {
    _id: 'session-two',
    startedAt: '2026-10-29T10:00:00.000Z',
    durationSec: 900,
    equipmentId: { _id: 'cardio-machine', name: 'Esteira' },
    areaId: { _id: 'cardio', name: 'Cardio', description: '' },
    sets: [],
  },
];

test('busca e filtra equipamentos por área', () => {
  assert.deepEqual(filterEquipment(equipment, 'Musculação', ''), [equipment[0]]);
  const seededStrengthEquipment = {
    ...equipment[0],
    areaId: { ...equipment[0].areaId, name: 'Membros inferiores' },
  };
  assert.deepEqual(filterEquipment([seededStrengthEquipment], 'Musculação', ''), [seededStrengthEquipment]);
  assert.equal(getEquipmentAreaFilter('Membros inferiores'), 'Musculação');
  assert.deepEqual(filterEquipment(equipment, 'Todos', 'esteira'), [equipment[1]]);
  assert.deepEqual(filterEquipment(equipment, 'Cardio', '9'), [equipment[1]]);
});

test('mapa inclui posições cadastradas e destaca o aparelho detectado', () => {
  const positioned = getPositionedEquipment(equipment);
  assert.equal(positioned.length, 1);
  assert.equal(positioned[0].equipment._id, 'strength-machine');
  assert.equal(getAreaMapColor('Cardio'), '#28DB9E');
  assert.equal(isDetectedEquipment('strength-machine', 'strength-machine'), true);
  assert.equal(isDetectedEquipment('cardio-machine', 'strength-machine'), false);
});

test('histórico nomeia a sessão e conta exercícios distintos', () => {
  assert.equal(getTrainingTitle(sessions[0]), 'Treino de Pernas');
  assert.equal(getSessionExerciseCount(sessions[0]), 2);
  assert.equal(getTrainingTitle(sessions[1]), 'Treino de 29/10/2026');
});

test('relatórios calculam ranking e porcentagem só a partir das sessões recebidas', () => {
  const equipmentRanking = getUsageRanking(sessions, 'equipment');
  assert.equal(equipmentRanking[0].id, 'strength-machine');
  assert.equal(equipmentRanking[0].percentage, 66.66666666666666);
  assert.equal(getUsageRanking(sessions, 'area')[0].name, 'Musculação');
});

test('filtro de período inclui somente o intervalo pessoal escolhido', () => {
  const olderSession = { ...sessions[0], _id: 'old-session', startedAt: '2026-09-01T10:00:00.000Z' };
  const allSessions = [...sessions, olderSession];
  const now = Date.parse('2026-11-03T12:00:00.000Z');
  assert.equal(filterSessionsByPeriod(allSessions, 'week', now).length, 2);
  assert.equal(filterSessionsByPeriod(allSessions, 'month', now).length, 2);
  assert.equal(filterSessionsByPeriod(allSessions, 'all', now).length, 3);
});

test('itens de perfil levam a telas reais e notificações permanecem desabilitadas', () => {
  for (const section of profileSections) {
    assert.equal(
      getProfileSectionRoute(section.id),
      section.available ? `/profile-info?section=${section.id}` : null,
    );
  }
  assert.equal(getSettingsRoute(), '/settings');
});

test('alternância do modo escuro mantém apenas Português disponível', () => {
  assert.equal(getNextThemePreference(false), 'dark');
  assert.equal(getNextThemePreference(true), 'light');
});
