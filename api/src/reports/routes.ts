import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { requireAdmin } from '../auth/middleware.js';
import { getAuth } from '../http.js';
import { Equipment, UsageSession } from '../models/index.js';
import { parseInput } from '../validation.js';

type UsageAggregate = {
  _id: string;
  name: string;
  sessions: number;
  totalDurationSec: number;
};

type HourAggregate = {
  _id: number;
  sessions: number;
  totalDurationSec: number;
};

type SummaryAggregate = {
  _id: null;
  sessions: number;
  totalDurationSec: number;
};

type ActiveStudentAggregate = { count: number };

type HeatmapAggregate = {
  areaId: string;
  areaName: string;
  hour: number;
  sessions: number;
  totalDurationSec: number;
};

const dateSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const reportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  idleDays: z.coerce.number().int().min(1).max(365).default(7),
  areaId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  equipmentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

const groupSchema = z.enum(['equipment', 'area', 'hour']).default('equipment');
const formatSchema = z.enum(['json', 'csv']).default('json');

type ReportGroup = z.infer<typeof groupSchema>;

async function getRange(query: unknown) {
  const parsed = parseInput(reportQuerySchema, query);
  const to = parsed.to ?? new Date();
  const from = parsed.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (from >= to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['from', 'to'],
        message: 'O período deve ser válido e não pode exceder 366 dias.',
      },
    ]);
  }

  return {
    from,
    to,
    idleDays: parsed.idleDays,
    areaId: parsed.areaId,
    equipmentId: parsed.equipmentId,
  };
}

async function getEquipmentIds(
  gymId: Types.ObjectId,
  filters: { areaId?: string; equipmentId?: string },
): Promise<Types.ObjectId[]> {
  const query: { gymId: Types.ObjectId; areaId?: Types.ObjectId; _id?: Types.ObjectId } = {
    gymId,
  };

  if (filters.areaId) {
    query.areaId = new Types.ObjectId(filters.areaId);
  }

  if (filters.equipmentId) {
    query._id = new Types.ObjectId(filters.equipmentId);
  }

  return Equipment.find(query).distinct('_id');
}

async function aggregateUsage(
  gymId: Types.ObjectId,
  from: Date,
  to: Date,
  group: ReportGroup,
  filters: { areaId?: string; equipmentId?: string } = {},
): Promise<UsageAggregate[] | HourAggregate[]> {
  const equipmentIds = await getEquipmentIds(gymId, filters);

  if (group === 'hour') {
    return UsageSession.aggregate<HourAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $hour: { date: '$startedAt', timezone: 'UTC' } },
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  if (group === 'area') {
    return UsageSession.aggregate<UsageAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$areaId',
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
      {
        $lookup: {
          from: 'areas',
          localField: '_id',
          foreignField: '_id',
          as: 'area',
        },
      },
      { $unwind: '$area' },
      {
        $project: {
          _id: { $toString: '$_id' },
          name: '$area.name',
          sessions: 1,
          totalDurationSec: 1,
        },
      },
      { $sort: { sessions: -1, name: 1 } },
    ]);
  }

  return UsageSession.aggregate<UsageAggregate>([
    {
      $match: {
        equipmentId: { $in: equipmentIds },
        startedAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$equipmentId',
        sessions: { $sum: 1 },
        totalDurationSec: { $sum: '$durationSec' },
      },
    },
    {
      $lookup: {
        from: 'equipment',
        localField: '_id',
        foreignField: '_id',
        as: 'equipment',
      },
    },
    { $unwind: '$equipment' },
    {
      $project: {
        _id: { $toString: '$_id' },
        name: '$equipment.name',
        sessions: 1,
        totalDurationSec: 1,
      },
    },
    { $sort: { sessions: -1, name: 1 } },
  ]);
}

function csvCell(value: string | number): string {
  let cell = String(value);

  if (/^[=+\-@\t\r]/.test(cell)) {
    cell = `'${cell}`;
  }

  return `"${cell.replaceAll('"', '""')}"`;
}

function toCsv(rows: readonly (UsageAggregate | HourAggregate)[]): string {
  const header = [
    'identificador',
    'nome_ou_hora_utc',
    'sessoes',
    'duracao_total_segundos',
  ];
  const lines = rows.map((row) => {
    const identifier = row._id;
    const name = 'name' in row ? row.name : `${row._id}:00`;

    return [
      csvCell(identifier),
      csvCell(name),
      csvCell(row.sessions),
      csvCell(row.totalDurationSec),
    ].join(',');
  });

  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}

export function createReportsRouter(config: AppConfig): Router {
  const router = Router();
  router.use(requireAdmin(config));

  router.get('/usage', async (request, response) => {
    const { from, to, areaId, equipmentId } = await getRange(request.query);
    const group = parseInput(groupSchema, request.query.groupBy);
    const format = parseInput(formatSchema, request.query.format);
    const rows = await aggregateUsage(
      getAuth(request).gymId,
      from,
      to,
      group,
      { areaId, equipmentId },
    );

    if (format === 'csv') {
      response
        .type('text/csv')
        .attachment(`fitbeacon-uso-${group}.csv`)
        .send(toCsv(rows));
      return;
    }

    response.json({ data: rows, period: { from, to }, groupBy: group });
  });

  router.get('/summary', async (request, response) => {
    const { from, to, idleDays } = await getRange(request.query);
    const gymId = getAuth(request).gymId;
    const equipment = await Equipment.find({ gymId }).select('_id name areaId');
    const equipmentIds = equipment.map((item) => item._id);
    const equipmentUsage = await UsageSession.aggregate<UsageAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$equipmentId',
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
      {
        $lookup: {
          from: 'equipment',
          localField: '_id',
          foreignField: '_id',
          as: 'equipment',
        },
      },
      { $unwind: '$equipment' },
      {
        $project: {
          _id: { $toString: '$_id' },
          name: '$equipment.name',
          sessions: 1,
          totalDurationSec: 1,
        },
      },
      { $sort: { sessions: -1, name: 1 } },
    ]);
    const areaUsage = await aggregateUsage(gymId, from, to, 'area');
    const hourlyUsage = await aggregateUsage(gymId, from, to, 'hour');
    const [totals] = await UsageSession.aggregate<SummaryAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
    ]);
    const [activeStudents] = await UsageSession.aggregate<ActiveStudentAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
      { $project: { _id: 0, count: 1 } },
    ]);
    const activeEquipment = await Equipment.find({ gymId, isActive: true }).select(
      '_id name areaId',
    );
    const activeEquipmentIds = activeEquipment.map((item) => item._id);
    const idleCutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000);
    const recentEquipmentIds = await UsageSession.distinct('equipmentId', {
      equipmentId: { $in: activeEquipmentIds },
      startedAt: { $gte: idleCutoff },
    });
    const recentIds = new Set(recentEquipmentIds.map((id) => id.toString()));
    const totalSessions = totals?.sessions ?? 0;
    const totalDurationSec = totals?.totalDurationSec ?? 0;
    const idleEquipment = activeEquipment
      .filter((item) => !recentIds.has(item._id.toString()))
      .map((item) => ({
        id: item._id.toString(),
        name: item.name,
        areaId: item.areaId.toString(),
      }));

    response.json({
      period: { from, to },
      totals: {
        sessions: totalSessions,
        totalDurationSec,
        averageDurationSec:
          totalSessions > 0
            ? Math.round((totalDurationSec / totalSessions) * 100) / 100
            : 0,
        activeStudents: activeStudents?.count ?? 0,
        occupancyRate:
          activeEquipment.length > 0
            ? Math.round(
                (totalDurationSec /
                  (activeEquipment.length * (to.getTime() - from.getTime()) / 1_000)) *
                  10_000,
              ) / 100
            : 0,
      },
      rankings: {
        equipment: equipmentUsage,
        areas: areaUsage,
      },
      hourlyUsage,
      idleEquipment: {
        thresholdDays: idleDays,
        equipment: idleEquipment,
      },
    });
  });

  router.get('/heatmap', async (request, response) => {
    const { from, to, areaId, equipmentId } = await getRange(request.query);
    const gymId = getAuth(request).gymId;
    const equipmentIds = await getEquipmentIds(gymId, { areaId, equipmentId });
    const rows = await UsageSession.aggregate<HeatmapAggregate>([
      {
        $match: {
          equipmentId: { $in: equipmentIds },
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            areaId: '$areaId',
            hour: { $hour: { date: '$startedAt', timezone: 'UTC' } },
          },
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
      {
        $lookup: {
          from: 'areas',
          localField: '_id.areaId',
          foreignField: '_id',
          as: 'area',
        },
      },
      { $unwind: '$area' },
      {
        $project: {
          _id: 0,
          areaId: { $toString: '$_id.areaId' },
          areaName: '$area.name',
          hour: '$_id.hour',
          sessions: 1,
          totalDurationSec: 1,
        },
      },
      { $sort: { areaName: 1, hour: 1 } },
    ]);

    response.json({ data: rows, period: { from, to } });
  });

  router.get('/export.csv', async (request, response) => {
    const { from, to, areaId, equipmentId } = await getRange(request.query);
    const group = parseInput(groupSchema, request.query.groupBy);
    const rows = await aggregateUsage(
      getAuth(request).gymId,
      from,
      to,
      group,
      { areaId, equipmentId },
    );

    response.type('text/csv').attachment(`fitbeacon-uso-${group}.csv`).send(toCsv(rows));
  });

  return router;
}
