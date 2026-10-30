export type AdminUser = {
  id: string;
  gymId: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
  consentTracking: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type LoginResponse = {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

export type Area = {
  _id: string;
  name: string;
  description: string;
  isActive: boolean;
};

export type Exercise = {
  _id: string;
  name: string;
  muscleGroup: string;
  steps: string[];
  commonMistakes: string[];
  recommendedSets: number;
  recommendedReps: number;
  media: Media;
  isActive: boolean;
};

export type Media = {
  imageUrl?: string;
  videoUrl?: string;
  instructionUrl?: string;
};

export type Adjustment = {
  name: string;
  instructions: string;
};

export type Equipment = {
  _id: string;
  name: string;
  gymId: string;
  areaId: Area | string;
  beacon: {
    uuid: string;
    major: number;
    minor: number;
    txPower: number;
    rssiEnter: number;
    rssiExit: number;
  };
  adjustments: Adjustment[];
  exerciseIds: (Exercise | string)[];
  media: Media;
  isActive: boolean;
};

export type UsageRow = {
  _id: string;
  name: string;
  sessions: number;
  totalDurationSec: number;
};

export type HourRow = {
  _id: number;
  sessions: number;
  totalDurationSec: number;
};

export type HeatmapRow = {
  areaId: string;
  areaName: string;
  hour: number;
  sessions: number;
  totalDurationSec: number;
};

export type ReportSummary = {
  period: { from: string; to: string };
  totals: {
    sessions: number;
    totalDurationSec: number;
    averageDurationSec: number;
    activeStudents: number;
    occupancyRate: number;
  };
  rankings: { equipment: UsageRow[]; areas: UsageRow[] };
  hourlyUsage: HourRow[];
  idleEquipment: { thresholdDays: number; equipment: { id: string; name: string; areaId: string }[] };
};

export type ReportFilters = {
  from: string;
  to: string;
  areaId?: string;
  equipmentId?: string;
};
