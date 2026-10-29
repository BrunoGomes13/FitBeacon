import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { Gym, User } from '../models/index.js';
import { parseInput, isObjectId } from '../validation.js';
import { createTokenPair, hashTokenId, verifyRefreshToken } from './tokens.js';
import { requireAuth } from './middleware.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(128),
  gymId: z.string().regex(/^[a-f\d]{24}$/i),
  consentTracking: z.boolean(),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

function publicUser(user: {
  _id: { toString(): string };
  gymId: { toString(): string };
  name: string;
  email: string;
  role: 'student' | 'admin';
  consentTracking: boolean;
}) {
  return {
    id: user._id.toString(),
    gymId: user.gymId.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    consentTracking: user.consentTracking,
  };
}

export function createAuthRouter(config: AppConfig): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: config.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      code: 'RATE_LIMITED',
      message: 'Muitas tentativas de acesso. Aguarde e tente novamente.',
      details: null,
    },
  });

  router.post('/register', async (request, response) => {
    const input = parseInput(registerSchema, request.body);
    const gym = await Gym.findById(input.gymId).select('_id');

    if (!gym) {
      throw new AppError(404, 'GYM_NOT_FOUND', 'Academia não encontrada.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      gymId: gym._id,
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'student',
      consentTracking: input.consentTracking,
    });
    const tokens = await createTokenPair(user._id.toString(), config);

    response.status(201).json({ user: publicUser(user), ...tokens });
  });

  router.post('/login', loginLimiter, async (request, response) => {
    const input = parseInput(loginSchema, request.body);
    const user = await User.findOne({ email: input.email }).select('+passwordHash');
    const passwordMatches = user
      ? await bcrypt.compare(input.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }

    const tokens = await createTokenPair(user._id.toString(), config);
    response.json({ user: publicUser(user), ...tokens });
  });

  router.post('/refresh', async (request, response) => {
    const { refreshToken } = parseInput(refreshSchema, request.body);
    const claims = verifyRefreshToken(refreshToken, config);

    if (!isObjectId(claims.sub)) {
      throw new AppError(
        401,
        'INVALID_REFRESH_TOKEN',
        'O token de atualização é inválido.',
      );
    }

    const user = await User.findById(claims.sub).select('+refreshTokenHashes');
    const previousHash = hashTokenId(claims.jti);

    if (!user || !user.refreshTokenHashes.includes(previousHash)) {
      throw new AppError(
        401,
        'INVALID_REFRESH_TOKEN',
        'O token de atualização foi revogado.',
      );
    }

    const tokenId = randomUUID();
    const newRefreshToken = jwt.sign(
      { sub: user._id.toString(), jti: tokenId },
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] },
    );
    const newAccessToken = jwt.sign(
      { sub: user._id.toString() },
      config.JWT_ACCESS_SECRET,
      { expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] },
    );
    const rotation = await User.updateOne(
      { _id: user._id, refreshTokenHashes: previousHash },
      {
        $set: {
          refreshTokenHashes: [
            ...user.refreshTokenHashes.filter((hash) => hash !== previousHash),
            hashTokenId(tokenId),
          ].slice(-10),
        },
      },
    );

    if (rotation.modifiedCount !== 1) {
      throw new AppError(
        401,
        'INVALID_REFRESH_TOKEN',
        'O token de atualização foi revogado.',
      );
    }

    response.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: config.JWT_ACCESS_TTL,
    });
  });

  router.post('/logout', requireAuth(config), async (request, response) => {
    const { refreshToken } = parseInput(logoutSchema, request.body ?? {});

    if (refreshToken) {
      const claims = verifyRefreshToken(refreshToken, config, true);

      if (claims.sub !== request.auth?.userId.toString()) {
        throw new AppError(403, 'FORBIDDEN', 'O token pertence a outro usuário.');
      }

      await User.updateOne(
        { _id: request.auth.userId },
        { $pull: { refreshTokenHashes: hashTokenId(claims.jti) } },
      );
    }

    response.status(204).end();
  });

  router.get('/me', requireAuth(config), async (request, response) => {
    const user = await User.findById(request.auth?.userId);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }

    response.json({ user: publicUser(user) });
  });

  router.patch('/me/consent', requireAuth(config), async (request, response) => {
    const input = parseInput(z.object({ consentTracking: z.boolean() }), request.body);
    const user = await User.findByIdAndUpdate(
      request.auth?.userId,
      { $set: { consentTracking: input.consentTracking } },
      { returnDocument: 'after', runValidators: true },
    );

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }

    response.json({ user: publicUser(user) });
  });

  return router;
}
