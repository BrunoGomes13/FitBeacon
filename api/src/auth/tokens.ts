import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { User } from '../models/index.js';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

type RefreshClaims = JwtPayload & {
  sub: string;
  jti: string;
};

export function hashTokenId(tokenId: string): string {
  return createHash('sha256').update(tokenId).digest('hex');
}

export function verifyRefreshToken(
  token: string,
  config: AppConfig,
  ignoreExpiration = false,
): RefreshClaims {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
    ignoreExpiration,
  });

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string'
  ) {
    throw new AppError(
      401,
      'INVALID_REFRESH_TOKEN',
      'O token de atualização é inválido.',
    );
  }

  return payload as RefreshClaims;
}

export async function createTokenPair(
  userId: string,
  config: AppConfig,
): Promise<TokenPair> {
  const tokenId = randomUUID();
  const refreshToken = jwt.sign(
    { sub: userId, jti: tokenId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] },
  );
  const accessToken = jwt.sign({ sub: userId }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
  const update = await User.updateOne(
    { _id: userId },
    {
      $push: {
        refreshTokenHashes: { $each: [hashTokenId(tokenId)], $slice: -10 },
      },
    },
  );

  if (update.matchedCount !== 1) {
    throw new AppError(401, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  }

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.JWT_ACCESS_TTL,
  };
}
