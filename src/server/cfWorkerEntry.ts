import { handleApiFetch } from './apiMounts.js';
import { setRuntimeEnv } from './runtimeEnv.js';

interface AssetsFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CloudflarePagesEnv extends Record<string, unknown> {
  ASSETS?: AssetsFetcher;
}

export default {
  async fetch(request: Request, env: CloudflarePagesEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      setRuntimeEnv(env);
      return handleApiFetch(request);
    }

    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const lastSegment = url.pathname.split('/').pop() || '';
      if (assetRes.status === 404 && !lastSegment.includes('.')) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request));
      }
      return assetRes;
    }

    return new Response('Not found', { status: 404 });
  },
};
