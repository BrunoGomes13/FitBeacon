import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: Types.ObjectId;
        gymId: Types.ObjectId;
        role: 'student' | 'admin';
        consentTracking: boolean;
      };
    }
  }
}

export {};
