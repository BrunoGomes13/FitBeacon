import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { requireAdmin } from '../auth/middleware.js';
import { getAuth } from '../http.js';
import { Equipment, Gym, UsageSession } from '../models/index.js';
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

type DayAggregate = {
  _id: string;
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

const dateSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

const reportQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  idleDays: z.coerce.number().int().min(1).max(365).default(7),
  areaId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  equipmentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  includeDemo: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  origin: z.enum(['beacon', 'manual']).optional(),
});

const groupSchema = z.enum(['equipment', 'area', 'hour', 'day']).default('equipment');
const formatSchema = z.enum(['json', 'csv']).default('json');

type ReportGroup = z.infer<typeof groupSchema>;

function dateInTimeZone(value: string, timeZone: string, endOfDate: boolean): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  const [year, month, day] = value.split('-').map(Number);
  const date = endOfDate
    ? new Date(Date.UTC(year, month - 1, day + 1))
    : new Date(Date.UTC(year, month - 1, day));
  const parts = {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
  const start = localDateTimeToUtc(parts, 0, timeZone);
  return endOfDate ? new Date(start.getTime() - 1) : start;
}

async function getRange(query: unknown, timeZone = 'America/Fortaleza') {
  const parsed = parseInput(reportQuerySchema, query);
  const end = parsed.to
    ? dateInTimeZone(parsed.to, timeZone, true)
    : new Date();
  const from = parsed.from
    ? dateInTimeZone(parsed.from, timeZone, false)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (from >= end || end.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
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
    to: end,
    idleDays: parsed.idleDays,
    areaId: parsed.areaId,
    equipmentId: parsed.equipmentId,
    includeDemo: parsed.includeDemo,
    origin: parsed.origin,
  };
}

type ReportOptions = {
  includeDemo: boolean;
  origin?: 'beacon' | 'manual';
  timeZone: string;
};

async function getEquipmentIds(
  gymId: Types.ObjectId,
  filters: { areaId?: string; equipmentId?: string; includeDemo?: boolean },
): Promise<Types.ObjectId[]> {
  const query: {
    gymId: Types.ObjectId;
    areaId?: Types.ObjectId;
    _id?: Types.ObjectId;
    isDemo?: { $ne: boolean };
  } = {
    gymId,
  };
  if (!filters.includeDemo) query.isDemo = { $ne: true };

  if (filters.areaId) {
    query.areaId = new Types.ObjectId(filters.areaId);
  }

  if (filters.equipmentId) {
    query._id = new Types.ObjectId(filters.equipmentId);
  }

  return Equipment.find(query).distinct('_id');
}

function sessionMatch(
  equipmentIds: Types.ObjectId[],
  from: Date,
  to: Date,
  options: ReportOptions,
) {
  return {
    equipmentId: { $in: equipmentIds },
    startedAt: { $gte: from, $lte: to },
    ...(!options.includeDemo ? { isDemo: { $ne: true } } : {}),
    ...(options.origin ? { origin: options.origin } : {}),
  };
}

function localDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function localDateTimeToUtc(
  parts: { year: number; month: number; day: number },
  hour: number,
  timeZone: string,
): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, hour);
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const value = (type: string): number =>
      Number(formatted.find((part) => part.type === type)?.value);
    const represented = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'));
    timestamp += target - represented;
  }
  return new Date(timestamp);
}

function availableSeconds(
  from: Date,
  to: Date,
  timeZone: string,
  openingHour: number,
  closingHour: number,
): number {
  let day = localDateParts(from, timeZone);
  const last = localDateParts(to, timeZone);
  let total = 0;
  for (let count = 0; count <= 367; count += 1) {
    const opens = localDateTimeToUtc(day, openingHour, timeZone);
    const closes = localDateTimeToUtc(day, closingHour, timeZone);
    const start = Math.max(from.getTime(), opens.getTime());
    const end = Math.min(to.getTime(), closes.getTime());
    if (end > start) total += (end - start) / 1_000;
    if (day.year === last.year && day.month === last.month && day.day === last.day) break;
    const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
    day = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
  }
  return total;
}

function localDayRange(now: Date, timeZone: string): { from: Date; to: Date } {
  const today = localDateParts(now, timeZone);
  const tomorrowDate = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const tomorrow = {
    year: tomorrowDate.getUTCFullYear(),
    month: tomorrowDate.getUTCMonth() + 1,
    day: tomorrowDate.getUTCDate(),
  };
  return {
    from: localDateTimeToUtc(today, 0, timeZone),
    to: new Date(localDateTimeToUtc(tomorrow, 0, timeZone).getTime() - 1),
  };
}

async function getReportOptions(
  gymId: Types.ObjectId,
  includeDemo: boolean,
  origin?: 'beacon' | 'manual',
): Promise<ReportOptions & { openingHour: number; closingHour: number }> {
  const gym = await Gym.findById(gymId).select('timeZone openingHour closingHour').lean();
  return {
    includeDemo,
    ...(origin ? { origin } : {}),
    timeZone: gym?.timeZone ?? 'America/Fortaleza',
    openingHour: gym?.openingHour ?? 6,
    closingHour: gym?.closingHour ?? 22,
  };
}

async function aggregateUsage(
  gymId: Types.ObjectId,
  from: Date,
  to: Date,
  group: ReportGroup,
  filters: { areaId?: string; equipmentId?: string } = {},
  options: ReportOptions = { includeDemo: false, timeZone: 'America/Fortaleza' },
): Promise<UsageAggregate[] | HourAggregate[] | DayAggregate[]> {
  const equipmentIds = await getEquipmentIds(gymId, { ...filters, includeDemo: options.includeDemo });

  if (group === 'hour') {
    return UsageSession.aggregate<HourAggregate>([
      {
        $match: {
          ...sessionMatch(equipmentIds, from, to, options),
        },
      },
      {
        $group: {
          _id: { $hour: { date: '$startedAt', timezone: options.timeZone } },
          sessions: { $sum: 1 },
          totalDurationSec: { $sum: '$durationSec' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  if (group === 'day') {
    return UsageSession.aggregate<DayAggregate>([
      { $match: sessionMatch(equipmentIds, from, to, options) },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$startedAt',
              timezone: options.timeZone,
            },
          },
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
          ...sessionMatch(equipmentIds, from, to, options),
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
        ...sessionMatch(equipmentIds, from, to, options),
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

function toCsv(rows: readonly (UsageAggregate | HourAggregate | DayAggregate)[]): string {
  const header = [
    'identificador',
    'nome_ou_hora_local',
    'sessoes',
    'duracao_total_segundos',
  ];
  const lines = rows.map((row) => {
    const identifier = row._id;
    const name = 'name' in row ? row.name : typeof row._id === 'number' ? `${row._id}:00` : row._id;

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
    const gymId = getAuth(request).gymId;
    const parsedFilters = parseInput(reportQuerySchema, request.query);
    const options = await getReportOptions(gymId, parsedFilters.includeDemo, parsedFilters.origin);
    const { from, to, areaId, equipmentId } = await getRange(request.query, options.timeZone);
    const group = parseInput(groupSchema, request.query.groupBy);
    const format = parseInput(formatSchema, request.query.format);
    const rows = await aggregateUsage(
      gymId,
      from,
      to,
      group,
      { areaId, equipmentId },
      options,
    );

    if (format === 'csv') {
      response
        .type('text/csv')
        .attachment(`fitbeacon-uso-${group}.csv`)
        .send(toCsv(rows));
      return;
    }

    response.json({
      data: rows,
      period: { from, to },
      groupBy: group,
      timeZone: options.timeZone,
    });
  });

  router.get('/summary', async (request, response) => {
    const gymId = getAuth(request).gymId;
    const parsedFilters = parseInput(reportQuerySchema, request.query);
    const options = await getReportOptions(gymId, parsedFilters.includeDemo, parsedFilters.origin);
    const { from, to, idleDays, includeDemo, origin } = await getRange(request.query, options.timeZone);
    const equipment = await Equipment.find({
      gymId,
      isActive: true,
      ...(!includeDemo ? { isDemo: { $ne: true } } : {}),
    }).select('_id name areaId');
    const equipmentIds = equipment.map((item) => item._id);
    const equipmentUsage = await UsageSession.aggregate<UsageAggregate>([
      {
        $match: {
          ...sessionMatch(equipmentIds, from, to, options),
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
    const areaUsage = await aggregateUsage(gymId, from, to, 'area', {}, options);
    const hourlyUsage = await aggregateUsage(gymId, from, to, 'hour', {}, options);
    const dailyUsage = await aggregateUsage(gymId, from, to, 'day', {}, options);
    const [totals] = await UsageSession.aggregate<SummaryAggregate>([
      {
        $match: sessionMatch(equipmentIds, from, to, options),
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
        $match: sessionMatch(equipmentIds, from, to, options),
      },
      { $group: { _id: '$userId' } },
      { $count: 'count' },
      { $project: { _id: 0, count: 1 } },
    ]);
    const activeEquipment = await Equipment.find({
      gymId,
      isActive: true,
      ...(!includeDemo ? { isDemo: { $ne: true } } : {}),
    }).select(
      '_id name areaId',
    );
    const activeEquipmentIds = activeEquipment.map((item) => item._id);
    const idleCutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000);
    const recentEquipmentIds = await UsageSession.distinct('equipmentId', {
      equipmentId: { $in: activeEquipmentIds },
      startedAt: { $gte: idleCutoff },
      ...(!includeDemo ? { isDemo: { $ne: true } } : {}),
      ...(origin ? { origin } : {}),
    });
    const todayRange = localDayRange(new Date(), options.timeZone);
    const [todayTotals] = await UsageSession.aggregate<SummaryAggregate>([
      { $match: sessionMatch(equipmentIds, todayRange.from, todayRange.to, options) },
      { $group: { _id: null, sessions: { $sum: 1 }, totalDurationSec: { $sum: '$durationSec' } } },
    ]);
    const recentIds = new Set(recentEquipmentIds.map((id) => id.toString()));
    const totalSessions = totals?.sessions ?? 0;
    const totalDurationSec = totals?.totalDurationSec ?? 0;
    const availableSecondsTotal = activeEquipment.length > 0
      ? availableSeconds(from, to, options.timeZone, options.openingHour, options.closingHour) *
        activeEquipment.length
      : 0;
    const idleEquipment = activeEquipment
      .filter((item) => !recentIds.has(item._id.toString()))
      .map((item) => ({
        id: item._id.toString(),
        name: item.name,
        areaId: item.areaId.toString(),
      }));

    response.json({
      period: { from, to },
      timeZone: options.timeZone,
      openingHours: { open: options.openingHour, close: options.closingHour },
      totals: {
        sessions: totalSessions,
        sessionsToday: todayTotals?.sessions ?? 0,
        totalDurationSec,
        averageDurationSec:
          totalSessions > 0
            ? Math.round((totalDurationSec / totalSessions) * 100) / 100
            : 0,
        activeStudents: activeStudents?.count ?? 0,
        occupancyRate: availableSecondsTotal > 0
          ? Math.round((totalDurationSec / availableSecondsTotal) * 10_000) / 100
          : 0,
      },
      rankings: {
        equipment: equipmentUsage,
        areas: areaUsage,
      },
      hourlyUsage,
      dailyUsage,
      idleEquipment: {
        thresholdDays: idleDays,
        equipment: idleEquipment,
      },
    });
  });

  router.get('/heatmap', async (request, response) => {
    const gymId = getAuth(request).gymId;
    const parsedFilters = parseInput(reportQuerySchema, request.query);
    const options = await getReportOptions(gymId, parsedFilters.includeDemo, parsedFilters.origin);
    const { from, to, areaId, equipmentId, includeDemo } = await getRange(request.query, options.timeZone);
    const equipmentIds = await getEquipmentIds(gymId, { areaId, equipmentId, includeDemo });
    const rows = await UsageSession.aggregate<HeatmapAggregate>([
      {
        $match: sessionMatch(equipmentIds, from, to, options),
      },
      {
        $group: {
          _id: {
            areaId: '$areaId',
            hour: { $hour: { date: '$startedAt', timezone: options.timeZone } },
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

    response.json({ data: rows, period: { from, to }, timeZone: options.timeZone });
  });

  router.get('/export.csv', async (request, response) => {
    const gymId = getAuth(request).gymId;
    const parsedFilters = parseInput(reportQuerySchema, request.query);
    const options = await getReportOptions(gymId, parsedFilters.includeDemo, parsedFilters.origin);
    const { from, to, areaId, equipmentId } = await getRange(request.query, options.timeZone);
    const group = parseInput(groupSchema, request.query.groupBy);
    const rows = await aggregateUsage(
      gymId,
      from,
      to,
      group,
      { areaId, equipmentId },
      options,
    );

    response.type('text/csv').attachment(`fitbeacon-uso-${group}.csv`).send(toCsv(rows));
  });

  return router;
}
