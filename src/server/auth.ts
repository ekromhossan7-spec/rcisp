import type { AdminUser } from '../types/isp.js';
import {
  base64UrlToUtf8,
  hashPasswordPortable,
  randomHex,
  signHmacSha256,
  utf8ToBase64Url,
  verifyHmacSha256,
  verifyPasswordPortable,
} from './cryptoWeb.js';
import { DatabaseConfigError, ensureDatabase } from './db.js';
import type { MiniNext, MiniRequest, MiniResponse } from './miniRouter.js';
import { getEnv } from './runtimeEnv.js';

export const SESSION_COOKIE_NAME = 'rc_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// In-memory fallback secret when no configured secret/seed env vars exist
const EPHEMERAL_SESSION_SECRET = randomHex(32);

async function getSessionSecret(): Promise<string> {
  const configured = getEnv('SESSION_SECRET')?.trim();
  if (configured && configured.length >= 16) return configured;

  // Deterministic cross-isolate fallback on serverless runtimes when SESSION_SECRET is omitted
  const seedMaterial = getEnv('TURSO_AUTH_TOKEN')?.trim() || getEnv('ADMIN_PASSWORD')?.trim();
  if (seedMaterial) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`rc-session-v1:${seedMaterial}`),
    );
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return EPHEMERAL_SESSION_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordPortable(password);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return verifyPasswordPortable(password, storedHash);
}

export interface SessionPayload {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  exp: number;
}

export async function signSessionToken(user: AdminUser): Promise<string> {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = utf8ToBase64Url(JSON.stringify(payload));
  const secret = await getSessionSecret();
  const sig = await signHmacSha256(encoded, secret);
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const secret = await getSessionSecret();
  const validSig = await verifyHmacSha256(encoded, sig, secret);
  if (!validSig) return null;

  try {
    const parsed = JSON.parse(base64UrlToUtf8(encoded)) as SessionPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.role !== 'admin' && parsed.role !== 'super_admin') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isHttpsRequest(req: MiniRequest): boolean {
  return req.secure || req.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
}

export function extractSessionToken(req: MiniRequest): string | undefined {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

export async function setSessionCookie(
  req: MiniRequest,
  res: MiniResponse,
  user: AdminUser,
): Promise<string> {
  const token = await signSessionToken(user);
  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: https,
    sameSite: https ? 'none' : 'lax',
    ...(https ? { partitioned: true } : {}),
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

export function clearSessionCookie(req: MiniRequest, res: MiniResponse): void {
  const https = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: https,
    sameSite: https ? 'none' : 'lax',
    ...(https ? { partitioned: true } : {}),
    path: '/',
  });
}

export interface AuthenticatedRequest extends MiniRequest {
  admin?: AdminUser;
}

export function verifyCsrfProtection(req: MiniRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const requestedWith = req.get('x-requested-with');
  if (requestedWith === 'XMLHttpRequest') {
    return true;
  }

  const origin = req.get('origin');
  const host = req.get('x-forwarded-host') || req.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: MiniResponse,
  next: MiniNext,
): Promise<void> {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }

  const rawToken = extractSessionToken(req);
  const payload = await verifySessionToken(rawToken);
  if (!payload) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }

  const envEmail = getEnv('ADMIN_EMAIL')?.trim().toLowerCase();
  const envPass = getEnv('ADMIN_PASSWORD')?.trim();
  if (envEmail && envPass && payload.id === 'env-admin' && payload.email.toLowerCase() === envEmail) {
    req.admin = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    await next();
    return;
  }

  try {
    const db = await ensureDatabase();
    const resDb = await db.execute({
      sql: 'SELECT id, name, email, role FROM admins WHERE id = ? LIMIT 1',
      args: [payload.id],
    });
    const row = resDb.rows[0];
    if (!row || (row.role !== 'admin' && row.role !== 'super_admin')) {
      res.status(401).json({ error: 'Administrator session is invalid or revoked.' });
      return;
    }
    req.admin = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role as 'super_admin' | 'admin',
    };
    await next();
  } catch (err) {
    if (err instanceof DatabaseConfigError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to verify administrator session.' });
  }
}
