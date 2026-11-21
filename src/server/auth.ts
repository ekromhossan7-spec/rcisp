import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import type { AdminUser } from '../types/isp.js';
import { ensureDatabase } from './db.js';

const scryptAsync = promisify(scryptCallback);

export const SESSION_COOKIE_NAME = 'rc_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// In-memory fallback secret when SESSION_SECRET env var is unset
const EPHEMERAL_SESSION_SECRET = randomBytes(32).toString('hex');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (expectedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, derivedBuf);
}

interface SessionPayload {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  exp: number;
}

export function signSessionToken(user: AdminUser): string {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;

  const expectedSig = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
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

export function setSessionCookie(res: Response, user: AdminUser): void {
  const token = signSessionToken(user);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminUser;
}

export function verifyCsrfProtection(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  // Verify custom header or matching Origin against Host / X-Forwarded-Host
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
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }

  const rawToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  const payload = verifySessionToken(rawToken);
  if (!payload) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }

  // Verify env-configured admin or database admin record
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envEmail && envPass && payload.id === 'env-admin' && payload.email.toLowerCase() === envEmail) {
    req.admin = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
    next();
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
    next();
  } catch {
    res.status(500).json({ error: 'Failed to verify administrator session.' });
  }
}
