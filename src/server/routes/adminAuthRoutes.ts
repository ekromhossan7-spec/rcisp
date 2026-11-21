import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { ensureDatabase } from '../db.js';
import {
  clearSessionCookie,
  hashPassword,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyCsrfProtection,
  verifyPassword,
  verifySessionToken,
} from '../auth.js';
import { adminLoginSchema, adminSetupSchema } from '../validations.js';
import type { AdminUser } from '../../types/isp.js';

export const adminAuthRoutes = Router();

function safeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

adminAuthRoutes.get('/status', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const envPassword = process.env.ADMIN_PASSWORD?.trim();
    const countRes = await db.execute('SELECT COUNT(*) as total FROM admins');
    const adminCount = Number(countRes.rows[0]?.total ?? 0);

    const needsSetup = adminCount === 0 && !envPassword;

    const rawToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const payload = verifySessionToken(rawToken);
    if (!payload) {
      res.json({ authenticated: false, needsSetup, admin: null });
      return;
    }

    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (envEmail && envPassword && payload.id === 'env-admin' && payload.email.toLowerCase() === envEmail) {
      res.json({
        authenticated: true,
        needsSetup: false,
        admin: {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
        },
      });
      return;
    }

    const adminRes = await db.execute({
      sql: 'SELECT id, name, email, role FROM admins WHERE id = ? LIMIT 1',
      args: [payload.id],
    });
    const row = adminRes.rows[0];
    if (!row) {
      res.json({ authenticated: false, needsSetup, admin: null });
      return;
    }

    res.json({
      authenticated: true,
      needsSetup: false,
      admin: {
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role) as AdminUser['role'],
      },
    });
  } catch (err) {
    console.error('Auth status error:', err);
    res.status(500).json({ error: 'Failed to inspect authentication state.' });
  }
});

// One-time initial administrator setup route (locked automatically once claimed or when ADMIN_PASSWORD is set)
adminAuthRoutes.post('/setup', async (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }

  try {
    if (process.env.ADMIN_PASSWORD?.trim()) {
      res.status(403).json({ error: 'Initial setup is disabled because environment credentials are configured.' });
      return;
    }

    const parsed = adminSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid setup fields.' });
      return;
    }

    const db = await ensureDatabase();
    const passwordHash = await hashPassword(parsed.data.password);
    const adminId = randomUUID();
    const emailNormalized = parsed.data.email.toLowerCase();

    const tx = await db.transaction('write');
    try {
      const countRes = await tx.execute('SELECT COUNT(*) as total FROM admins');
      const existing = Number(countRes.rows[0]?.total ?? 0);
      if (existing > 0) {
        await tx.rollback();
        res.status(403).json({ error: 'Administrator account has already been claimed.' });
        return;
      }

      await tx.execute({
        sql: `INSERT INTO admins (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'super_admin')`,
        args: [adminId, parsed.data.name, emailNormalized, passwordHash],
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    const admin: AdminUser = {
      id: adminId,
      name: parsed.data.name,
      email: emailNormalized,
      role: 'super_admin',
    };
    setSessionCookie(res, admin);
    res.status(201).json({ admin });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: 'Failed to initialize administrator account.' });
  }
});

adminAuthRoutes.post('/login', async (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }

  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Email and password are required.' });
      return;
    }

    const emailNormalized = parsed.data.email.toLowerCase();
    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envPass = process.env.ADMIN_PASSWORD?.trim();

    if (envEmail && envPass && safeCompareStrings(emailNormalized, envEmail) && safeCompareStrings(parsed.data.password, envPass)) {
      const admin: AdminUser = {
        id: 'env-admin',
        name: 'System Administrator',
        email: envEmail,
        role: 'super_admin',
      };
      setSessionCookie(res, admin);
      res.json({ admin });
      return;
    }

    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'SELECT id, name, email, password_hash, role FROM admins WHERE lower(email) = ? LIMIT 1',
      args: [emailNormalized],
    });
    const row = result.rows[0];
    if (!row) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    const valid = await verifyPassword(parsed.data.password, String(row.password_hash));
    if (!valid) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    const admin: AdminUser = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as AdminUser['role'],
    };

    setSessionCookie(res, admin);
    res.json({ admin });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Unable to authenticate administrator.' });
  }
});

adminAuthRoutes.post('/logout', (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: 'Cross-site request blocked.' });
    return;
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});
