import { createFetchApiHandler, type MountedRoute } from './miniRouter.js';
import { adminAuthRoutes } from './routes/adminAuthRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { cmsAdminRoutes } from './routes/cmsAdminRoutes.js';
import { publicRoutes } from './routes/publicRoutes.js';

export const mountedApiRoutes: MountedRoute[] = [
  { prefix: '/api/public', router: publicRoutes },
  { prefix: '/api/admin/auth', router: adminAuthRoutes },
  { prefix: '/api/admin/cms', router: cmsAdminRoutes },
  { prefix: '/api/admin', router: adminRoutes },
];

export const handleApiFetch = createFetchApiHandler(mountedApiRoutes);
