import { Schema, model, type InferSchemaType } from 'mongoose';

const mediaSchema = new Schema(
  {
    imageUrl: { type: String },
    videoUrl: { type: String },
    instructionUrl: { type: String },
  },
  { _id: false },
);

const gymSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  },
  { timestamps: true },
);

const userSchema = new Schema(
  {
    gymId: { type: Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
      required: true,
    },
    consentTracking: { type: Boolean, required: true, default: false },
    refreshTokenHashes: { type: [String], default: [], select: false },
  },
  { timestamps: true },
);

const areaSchema = new Schema(
  {
    gymId: { type: Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

const beaconSchema = new Schema(
  {
    uuid: { type: String, required: true, lowercase: true, trim: true },
    major: { type: Number, required: true, min: 0, max: 65535 },
    minor: { type: Number, required: true, min: 0, max: 65535 },
    txPower: { type: Number, required: true, min: -127, max: 20 },
    rssiEnter: { type: Number, required: true, min: -127, max: 0 },
    rssiExit: { type: Number, required: true, min: -127, max: 0 },
  },
  { _id: false },
);

const adjustmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    instructions: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const equipmentSchema = new Schema(
  {
    gymId: { type: Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    areaId: { type: Schema.Types.ObjectId, ref: 'Area', required: true, index: true },
    name: { type: String, required: true, trim: true },
    beacon: { type: beaconSchema, required: true },
    adjustments: { type: [adjustmentSchema], default: [] },
    exerciseIds: [{ type: Schema.Types.ObjectId, ref: 'Exercise' }],
    media: { type: mediaSchema, default: () => ({}) },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

equipmentSchema.index(
  { 'beacon.uuid': 1, 'beacon.major': 1, 'beacon.minor': 1 },
  { unique: true },
);

const exerciseSchema = new Schema(
  {
    gymId: { type: Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    name: { type: String, required: true, trim: true },
    muscleGroup: { type: String, required: true, trim: true },
    steps: {
      type: [String],
      required: true,
      validate: [(value: string[]) => value.length > 0, 'Inclua ao menos uma etapa.'],
    },
    commonMistakes: { type: [String], default: [] },
    media: { type: mediaSchema, default: () => ({}) },
    recommendedSets: { type: Number, required: true, min: 1, max: 20 },
    recommendedReps: { type: Number, required: true, min: 1, max: 100 },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

const usageSessionSchema = new Schema(
  {
    clientSessionId: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
    areaId: { type: Schema.Types.ObjectId, ref: 'Area', required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationSec: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

usageSessionSchema.index({ clientSessionId: 1 }, { unique: true });
usageSessionSchema.index({ equipmentId: 1, startedAt: 1 });
usageSessionSchema.index({ areaId: 1, startedAt: 1 });

const setLogSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'UsageSession', required: true },
    exerciseId: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
    setNumber: { type: Number, required: true, min: 1 },
    load: { type: Number, required: true, min: 0 },
    reps: { type: Number, required: true, min: 1 },
  },
  { timestamps: true },
);

setLogSchema.index({ sessionId: 1, exerciseId: 1, setNumber: 1 }, { unique: true });

export type GymDocument = InferSchemaType<typeof gymSchema>;
export type UserDocument = InferSchemaType<typeof userSchema>;
export type AreaDocument = InferSchemaType<typeof areaSchema>;
export type EquipmentDocument = InferSchemaType<typeof equipmentSchema>;
export type ExerciseDocument = InferSchemaType<typeof exerciseSchema>;
export type UsageSessionDocument = InferSchemaType<typeof usageSessionSchema>;
export type SetLogDocument = InferSchemaType<typeof setLogSchema>;

export const Gym = model('Gym', gymSchema);
export const User = model('User', userSchema);
export const Area = model('Area', areaSchema);
export const Equipment = model('Equipment', equipmentSchema);
export const Exercise = model('Exercise', exerciseSchema);
export const UsageSession = model('UsageSession', usageSessionSchema);
export const SetLog = model('SetLog', setLogSchema);

export async function initializeModels(): Promise<void> {
  await Promise.all([
    Gym.init(),
    User.init(),
    Area.init(),
    Equipment.init(),
    Exercise.init(),
    UsageSession.init(),
    SetLog.init(),
  ]);
}
