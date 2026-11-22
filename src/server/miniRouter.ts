import type { Express, NextFunction as ExpressNext, Request as ExpressReq, Response as ExpressRes } from 'express';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none' | boolean;
  partitioned?: boolean;
  path?: string;
  maxAge?: number;
}

export interface MiniRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  cookies: Record<string, string | undefined>;
  secure: boolean;
  get(name: string): string | undefined;
  [key: string]: unknown;
}

export interface MiniResponse {
  status(code: number): MiniResponse;
  json(data: unknown): void;
  send(body: unknown): void;
  setHeader(name: string, value: string): void;
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
}

export type MiniNext = () => void | Promise<void>;
export type MiniHandler = (req: MiniRequest, res: MiniResponse, next: MiniNext) => unknown | Promise<unknown>;

interface RouteEntry {
  method: string;
  pattern: string;
  segments: string[];
  handler: MiniHandler;
}

export class MiniRouter {
  middlewares: MiniHandler[] = [];
  routes: RouteEntry[] = [];

  use(handler: MiniHandler): this {
    this.middlewares.push(handler);
    return this;
  }

  private add(method: string, pattern: string, handler: MiniHandler): this {
    const clean = pattern === '/' ? '' : pattern.replace(/^\/+|\/+$/g, '');
    const segments = clean ? clean.split('/') : [];
    this.routes.push({ method: method.toUpperCase(), pattern, segments, handler });
    return this;
  }

  get(pattern: string, handler: MiniHandler): this {
    return this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: MiniHandler): this {
    return this.add('POST', pattern, handler);
  }

  put(pattern: string, handler: MiniHandler): this {
    return this.add('PUT', pattern, handler);
  }

  patch(pattern: string, handler: MiniHandler): this {
    return this.add('PATCH', pattern, handler);
  }

  delete(pattern: string, handler: MiniHandler): this {
    return this.add('DELETE', pattern, handler);
  }

  match(method: string, subPath: string): { handler: MiniHandler; params: Record<string, string> } | null {
    const upper = method.toUpperCase();
    const clean = subPath === '/' ? '' : subPath.replace(/^\/+|\/+$/g, '');
    const parts = clean ? clean.split('/') : [];

    for (const route of this.routes) {
      if (route.method !== upper) continue;
      if (route.segments.length !== parts.length) continue;

      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        const val = parts[i];
        if (seg.startsWith(':')) {
          try {
            params[seg.slice(1)] = decodeURIComponent(val);
          } catch {
            params[seg.slice(1)] = val;
          }
        } else if (seg !== val) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

export function Router(): MiniRouter {
  return new MiniRouter();
}

function parseCookieHeader(header: string | null): Record<string, string | undefined> {
  const cookies: Record<string, string | undefined> = {};
  if (!header) return cookies;
  const pairs = header.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    let val = pair.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }
  return cookies;
}

function serializeSetCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (typeof options.maxAge === 'number') {
    const seconds = Math.max(0, Math.floor(options.maxAge / 1000));
    parts.push(`Max-Age=${seconds}`);
    if (seconds === 0) {
      parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  }
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite === 'none') parts.push('SameSite=None');
  else if (options.sameSite === 'strict') parts.push('SameSite=Strict');
  else if (options.sameSite === 'lax') parts.push('SameSite=Lax');
  if (options.partitioned) parts.push('Partitioned');
  return parts.join('; ');
}

export function mountMiniRouterOnExpress(app: Express, prefix: string, router: MiniRouter): void {
  const normalizedPrefix = prefix.replace(/\/+$/, '');
  app.use(normalizedPrefix, async (req: ExpressReq, res: ExpressRes, next: ExpressNext) => {
    const subPath = req.path || '/';
    const matched = router.match(req.method, subPath);
    if (!matched) {
      next();
      return;
    }

    const query: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.query || {})) {
      if (typeof v === 'string') query[k] = v;
      else if (Array.isArray(v) && typeof v[0] === 'string') query[k] = v[0];
    }

    const miniReq: MiniRequest = {
      method: req.method,
      path: subPath,
      params: matched.params,
      query,
      body: req.body,
      cookies: (req.cookies as Record<string, string | undefined>) || {},
      secure: req.secure,
      get(name: string) {
        return req.get(name);
      },
    };

    const miniRes: MiniResponse = {
      status(code: number) {
        res.status(code);
        return miniRes;
      },
      json(data: unknown) {
        if (!res.headersSent) res.json(data);
      },
      send(body: unknown) {
        if (!res.headersSent) {
          if (body instanceof Uint8Array && !Buffer.isBuffer(body)) {
            res.send(Buffer.from(body));
          } else {
            res.send(body);
          }
        }
      },
      setHeader(name: string, value: string) {
        res.setHeader(name, value);
      },
      cookie(name: string, value: string, options?: CookieOptions) {
        res.cookie(name, value, options || {});
      },
      clearCookie(name: string, options?: CookieOptions) {
        res.clearCookie(name, options || {});
      },
    };

    try {
      let idx = 0;
      const runChain = async (): Promise<void> => {
        if (res.headersSent) return;
        if (idx < router.middlewares.length) {
          const mw = router.middlewares[idx++];
          await mw(miniReq, miniRes, runChain);
          return;
        }
        await matched.handler(miniReq, miniRes, () => {});
      };
      await runChain();
    } catch (err) {
      next(err);
    }
  });
}

export interface MountedRoute {
  prefix: string;
  router: MiniRouter;
}

export function createFetchApiHandler(mounts: MountedRoute[]) {
  // Sort longest prefix first so /api/admin/auth & /api/admin/cms match before /api/admin
  const orderedMounts = [...mounts].sort((a, b) => b.prefix.length - a.prefix.length);

  return async function handleApiFetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = request.headers.get('origin');

    const applySecurityAndCors = (headers: Headers) => {
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        headers.set('Vary', 'Origin');
      }
    };

    if (request.method.toUpperCase() === 'OPTIONS') {
      const headers = new Headers();
      applySecurityAndCors(headers);
      return new Response(null, { status: 204, headers });
    }

    if (pathname === '/api/health' && request.method.toUpperCase() === 'GET') {
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    let targetMount: MountedRoute | null = null;
    let subPath = '/';
    for (const mount of orderedMounts) {
      const cleanPrefix = mount.prefix.replace(/\/+$/, '');
      if (pathname === cleanPrefix || pathname.startsWith(`${cleanPrefix}/`)) {
        targetMount = mount;
        subPath = pathname.slice(cleanPrefix.length) || '/';
        break;
      }
    }

    if (!targetMount) {
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: 'API endpoint not found.' }), {
        status: 404,
        headers,
      });
    }

    const matched = targetMount.router.match(request.method, subPath);
    if (!matched) {
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: 'API endpoint not found.' }), {
        status: 404,
        headers,
      });
    }

    let parsedBody: unknown = undefined;
    const methodUpper = request.method.toUpperCase();
    if (methodUpper !== 'GET' && methodUpper !== 'HEAD') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          parsedBody = await request.json();
        } catch {
          const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
          applySecurityAndCors(headers);
          return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
            status: 400,
            headers,
          });
        }
      }
    }

    const query: Record<string, string | undefined> = {};
    url.searchParams.forEach((value, key) => {
      if (!(key in query)) query[key] = value;
    });

    const miniReq: MiniRequest = {
      method: methodUpper,
      path: subPath,
      params: matched.params,
      query,
      body: parsedBody,
      cookies: parseCookieHeader(request.headers.get('cookie')),
      secure: url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
      get(name: string) {
        return request.headers.get(name) ?? undefined;
      },
    };

    let statusCode = 200;
    const resHeaders = new Headers();
    const setCookies: string[] = [];
    let finalResponse: Response | null = null;

    const finalize = (body: BodyInit | null, defaultContentType?: string) => {
      if (finalResponse) return;
      if (defaultContentType && !resHeaders.has('Content-Type')) {
        resHeaders.set('Content-Type', defaultContentType);
      }
      applySecurityAndCors(resHeaders);
      for (const sc of setCookies) {
        resHeaders.append('Set-Cookie', sc);
      }
      finalResponse = new Response(body, { status: statusCode, headers: resHeaders });
    };

    const miniRes: MiniResponse = {
      status(code: number) {
        statusCode = code;
        return miniRes;
      },
      json(data: unknown) {
        finalize(JSON.stringify(data), 'application/json; charset=utf-8');
      },
      send(body: unknown) {
        if (body instanceof Uint8Array) {
          finalize(body as Uint8Array<ArrayBuffer>, 'application/octet-stream');
        } else if (typeof body === 'string') {
          finalize(body, 'text/plain; charset=utf-8');
        } else {
          finalize(JSON.stringify(body), 'application/json; charset=utf-8');
        }
      },
      setHeader(name: string, value: string) {
        resHeaders.set(name, value);
      },
      cookie(name: string, value: string, options?: CookieOptions) {
        setCookies.push(serializeSetCookie(name, value, options));
      },
      clearCookie(name: string, options?: CookieOptions) {
        setCookies.push(serializeSetCookie(name, '', { ...options, maxAge: 0 }));
      },
    };

    try {
      let idx = 0;
      const runChain = async (): Promise<void> => {
        if (finalResponse) return;
        if (idx < targetMount!.router.middlewares.length) {
          const mw = targetMount!.router.middlewares[idx++];
          await mw(miniReq, miniRes, runChain);
          return;
        }
        await matched.handler(miniReq, miniRes, () => {});
      };
      await runChain();

      if (!finalResponse) {
        finalize(JSON.stringify({ error: 'Empty response from handler.' }), 'application/json; charset=utf-8');
      }
      return finalResponse!;
    } catch (err) {
      console.error('API fetch error:', err);
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: 'Internal server error.' }), {
        status: 500,
        headers,
      });
    }
  };
}
