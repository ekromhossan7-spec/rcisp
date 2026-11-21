import type {
  AdminUser,
  AuditLogRecord,
  CmsAdminWorkspacePayload,
  CmsPageSlug,
  CustomerRecord,
  DashboardOverview,
  InquiryCategory,
  InquiryRecord,
  InquiryStatus,
  MediaAssetRecord,
  OfferRecord,
  PackageRecord,
  PageSectionContent,
  PageSeoData,
  PublicSitePayload,
  RecordStatus,
  SubscriptionRecord,
  WebsiteSettingsMap,
} from '../types/isp';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const targetUrl = url.startsWith('/') && API_BASE ? `${API_BASE}${url}` : url;

  const res = await fetch(targetUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  let data: Record<string, unknown> | null = null;

  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // Handled below if response wasn't valid JSON
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  if (!data || (!contentType.includes('application/json') && text.trim().startsWith('<'))) {
    throw new ApiError(
      'Backend API is unavailable at this host (received non-JSON response).',
      502,
    );
  }

  return data as T;
}

export const publicApi = {
  getSite: (preview = false) =>
    request<PublicSitePayload>(`/api/public/site${preview ? '?preview=1' : ''}`),
  getPackages: () => request<{ packages: PackageRecord[] }>('/api/public/packages'),
  getOffers: () => request<{ offers: OfferRecord[] }>('/api/public/offers'),
  submitInquiry: (payload: {
    type: InquiryCategory;
    full_name: string;
    mobile: string;
    email?: string;
    address: string;
    package_id?: string | null;
    inquiry_type?: string;
    message?: string;
  }) =>
    request<{ id: string; reference: string; message: string }>('/api/public/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const adminAuthApi = {
  getStatus: () =>
    request<{ authenticated: boolean; needsSetup: boolean; admin: AdminUser | null }>(
      '/api/admin/auth/status',
    ),
  setup: (payload: { name: string; email: string; password: string }) =>
    request<{ admin: AdminUser }>('/api/admin/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ admin: AdminUser }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ ok: boolean }>('/api/admin/auth/logout', {
      method: 'POST',
    }),
};

export const adminApi = {
  getOverview: () => request<DashboardOverview>('/api/admin/overview'),

  // Packages
  getPackages: () => request<{ packages: PackageRecord[] }>('/api/admin/packages'),
  createPackage: (payload: {
    name: string;
    speed_mbps: number;
    monthly_price: number;
    description: string;
    features: string[];
    image_url?: string | null;
    show_on_home?: boolean;
    status: RecordStatus;
  }) =>
    request<{ id: string; message: string }>('/api/admin/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePackage: (
    id: string,
    payload: {
      name: string;
      speed_mbps: number;
      monthly_price: number;
      description: string;
      features: string[];
      image_url?: string | null;
      show_on_home?: boolean;
      status: RecordStatus;
    },
  ) =>
    request<{ message: string }>(`/api/admin/packages/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  togglePackageStatus: (id: string, status: RecordStatus) =>
    request<{ message: string }>(`/api/admin/packages/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deletePackage: (id: string) =>
    request<{ softDeleted: boolean; message: string }>(
      `/api/admin/packages/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  getPackageCustomers: (id: string) =>
    request<{
      subscribers: Array<{
        customer_id: string;
        customer_code: string;
        name: string;
        mobile: string;
        address: string;
        customer_status: string;
        subscription_id: string;
        monthly_price: number;
        start_date: string;
        end_date: string | null;
      }>;
    }>(`/api/admin/packages/${encodeURIComponent(id)}/customers`),

  // Offers
  getOffers: () => request<{ offers: OfferRecord[] }>('/api/admin/offers'),
  createOffer: (payload: {
    title: string;
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    package_id: string | null;
    start_date: string;
    expiry_date: string;
    image_url?: string | null;
    show_on_home?: boolean;
    status: RecordStatus;
  }) =>
    request<{ id: string; message: string }>('/api/admin/offers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateOffer: (
    id: string,
    payload: {
      title: string;
      description: string;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      package_id: string | null;
      start_date: string;
      expiry_date: string;
      image_url?: string | null;
      show_on_home?: boolean;
      status: RecordStatus;
    },
  ) =>
    request<{ message: string }>(`/api/admin/offers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleOfferStatus: (id: string, status: RecordStatus) =>
    request<{ message: string }>(`/api/admin/offers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteOffer: (id: string) =>
    request<{ message: string }>(`/api/admin/offers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Customers
  getCustomers: (params: {
    q?: string;
    status?: string;
    packageId?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.status) search.set('status', params.status);
    if (params.packageId) search.set('packageId', params.packageId);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    return request<{ customers: CustomerRecord[]; total: number; page: number; limit: number }>(
      `/api/admin/customers?${search.toString()}`,
    );
  },
  createCustomer: (payload: {
    name: string;
    mobile: string;
    email?: string;
    address: string;
    status: RecordStatus;
    initial_package_id?: string | null;
  }) =>
    request<{ id: string; customer_code: string; message: string }>('/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCustomer: (
    id: string,
    payload: {
      name: string;
      mobile: string;
      email?: string;
      address: string;
      status: RecordStatus;
    },
  ) =>
    request<{ message: string }>(`/api/admin/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  toggleCustomerStatus: (id: string, status: RecordStatus) =>
    request<{ message: string }>(`/api/admin/customers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteCustomer: (id: string) =>
    request<{ message: string }>(`/api/admin/customers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getCustomerHistory: (id: string) =>
    request<{ history: SubscriptionRecord[] }>(
      `/api/admin/customers/${encodeURIComponent(id)}/subscriptions`,
    ),

  // Subscriptions & Reports
  getSubscriptions: (params: {
    q?: string;
    status?: string;
    packageId?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.status) search.set('status', params.status);
    if (params.packageId) search.set('packageId', params.packageId);
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    return request<{ subscriptions: SubscriptionRecord[] }>(
      `/api/admin/subscriptions?${search.toString()}`,
    );
  },
  assignPackage: (payload: {
    customer_id: string;
    package_id: string;
    end_date?: string | null;
  }) =>
    request<{ id: string; message: string }>('/api/admin/subscriptions/assign', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelSubscription: (id: string) =>
    request<{ message: string }>(`/api/admin/subscriptions/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
    }),

  // Inquiries
  getInquiries: () => request<{ inquiries: InquiryRecord[] }>('/api/admin/inquiries'),
  updateInquiryStatus: (id: string, status: InquiryStatus) =>
    request<{ message: string }>(`/api/admin/inquiries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Website CMS & Settings (Section 5.8)
  getCmsWorkspace: () => request<CmsAdminWorkspacePayload>('/api/admin/cms/workspace'),
  getCmsPreview: () => request<PublicSitePayload>('/api/admin/cms/preview'),
  updateCmsSection: (
    id: string,
    payload: {
      section_title: string;
      draft_content: PageSectionContent;
      draft_visible: boolean;
    },
  ) =>
    request<{ message: string }>(`/api/admin/cms/sections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  createCmsSection: (payload: {
    page_slug: CmsPageSlug;
    section_title: string;
    draft_content: PageSectionContent;
    draft_visible: boolean;
  }) =>
    request<{ id: string; message: string }>('/api/admin/cms/sections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  toggleCmsSectionVisibility: (id: string, visible: boolean) =>
    request<{ message: string }>(
      `/api/admin/cms/sections/${encodeURIComponent(id)}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ visible }),
      },
    ),
  reorderCmsSections: (page_slug: CmsPageSlug, ordered_ids: string[]) =>
    request<{ message: string }>('/api/admin/cms/sections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ page_slug, ordered_ids }),
    }),
  deleteCmsSection: (id: string) =>
    request<{ message: string }>(`/api/admin/cms/sections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  saveWebsiteSettings: (payload: WebsiteSettingsMap) =>
    request<{ message: string }>('/api/admin/cms/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  savePageSeo: (slug: CmsPageSlug, payload: PageSeoData) =>
    request<{ message: string }>(`/api/admin/cms/seo/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  publishCms: () =>
    request<{ message: string }>('/api/admin/cms/publish', { method: 'POST' }),
  discardCms: () =>
    request<{ message: string }>('/api/admin/cms/discard', { method: 'POST' }),

  // Media Assets
  getMedia: () => request<{ media: MediaAssetRecord[] }>('/api/admin/cms/media'),
  uploadMedia: (payload: {
    file_name: string;
    file_type: string;
    alt_text: string;
    category: string;
    data_base64: string;
  }) =>
    request<MediaAssetRecord>('/api/admin/cms/media', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  replaceMedia: (
    id: string,
    payload: {
      file_name: string;
      file_type: string;
      alt_text: string;
      category: string;
      data_base64: string;
    },
  ) =>
    request<{ message: string; file_url: string }>(
      `/api/admin/cms/media/${encodeURIComponent(id)}/replace`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),
  updateMediaAlt: (id: string, payload: { alt_text: string; category?: string }) =>
    request<{ message: string }>(`/api/admin/cms/media/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteMedia: (id: string) =>
    request<{ message: string }>(`/api/admin/cms/media/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getAuditLogs: () => request<{ logs: AuditLogRecord[] }>('/api/admin/cms/audit-logs'),
};
