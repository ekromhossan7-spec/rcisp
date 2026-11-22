import 'dotenv/config';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import cookieParser from 'cookie-parser';
import express from 'express';
import { mountedApiRoutes } from './src/server/apiMounts.js';
import { registerLegacyScryptVerifier } from './src/server/cryptoWeb.js';
import { ensureDatabase } from './src/server/db.js';
import { mountMiniRouterOnExpress } from './src/server/miniRouter.js';

const scryptAsync = promisify(scryptCallback);

registerLegacyScryptVerifier(async (password: string, storedHash: string) => {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (expectedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, derivedBuf);
});

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  await ensureDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());

  // Security headers compatible with iframe preview & optional cross-origin VITE_API_BASE_URL
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const origin = req.get('origin');
    if (origin && req.path.startsWith('/api/')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Vary', 'Origin');
      if (req.method.toUpperCase() === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  for (const mount of mountedApiRoutes) {
    mountMiniRouterOnExpress(app, mount.prefix, mount.router);
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Catch unmatched /api/* routes with clean 404 JSON
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use('/src/assets/images', express.static(path.resolve(process.cwd(), 'src/assets/images')));
    app.use((req, res, next) => {
      if (req.path === '/_worker.js' || req.path === '/_routes.json') {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Roman Communication server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Roman Communication server:', err);
  process.exit(1);
});
