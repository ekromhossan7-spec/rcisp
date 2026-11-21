import { randomUUID } from 'node:crypto';
import { ensureDatabase } from './db.js';
import { DEFAULT_PAGE_SEO, DEFAULT_SETTINGS } from './cmsSeed.js';
import type {
  AdminUser,
  CmsAdminWorkspacePayload,
  CmsPageSlug,
  MediaAssetRecord,
  PageContentRecord,
  PageSectionContent,
  PageSeoData,
  PageSeoRecord,
  PublicSitePayload,
  WebsiteSettingsMap,
} from '../types/isp.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

export function verifyImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4 || buf.length > MAX_IMAGE_BYTES) return false;
  switch (mimeType) {
    case 'image/png':
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47
      );
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/gif':
      return (
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x38
      );
    case 'image/webp':
      return (
        buf.length >= 12 &&
        buf.toString('ascii', 0, 4) === 'RIFF' &&
        buf.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return (
        buf[0] === 0x00 &&
        buf[1] === 0x00 &&
        (buf[2] === 0x01 || buf[2] === 0x02) &&
        buf[3] === 0x00
      );
    default:
      return false;
  }
}

export function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return cleaned || `image-${Date.now()}.png`;
}

export async function recordAuditLog(
  admin: AdminUser | undefined,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
): Promise<void> {
  if (!admin) return;
  try {
    const db = await ensureDatabase();
    await db.execute({
      sql: `INSERT INTO audit_logs (id, admin_id, admin_email, action, entity_type, entity_id, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), admin.id, admin.email, action, entityType, entityId, summary],
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function buildSettingsMap(
  rows: Array<Record<string, unknown>>,
  mode: 'draft' | 'published',
): WebsiteSettingsMap {
  const result: WebsiteSettingsMap = { ...DEFAULT_SETTINGS };
  const col = mode === 'draft' ? 'draft_value' : 'published_value';

  for (const row of rows) {
    const key = String(row.setting_key) as keyof WebsiteSettingsMap;
    const val = String(row[col] ?? '');
    if (key === 'other_social_links') {
      result.other_social_links = parseJsonSafe(val, []);
    } else if (key in result) {
      (result as unknown as Record<string, string>)[key] = val;
    }
  }
  return result;
}

export async function getPublicSitePayload(
  mode: 'draft' | 'published',
): Promise<PublicSitePayload> {
  const db = await ensureDatabase();

  const [secRes, setRes, seoRes] = await Promise.all([
    db.execute(
      mode === 'draft'
        ? `SELECT id, page_slug, section_key, section_title, draft_content, draft_order, is_custom
           FROM page_contents
           WHERE deleted_in_draft = 0 AND draft_visible = 1
           ORDER BY page_slug ASC, draft_order ASC`
        : `SELECT id, page_slug, section_key, section_title, published_content, published_order, is_custom
           FROM page_contents
           WHERE published_content != '' AND published_visible = 1
           ORDER BY page_slug ASC, published_order ASC`,
    ),
    db.execute('SELECT setting_key, draft_value, published_value FROM website_settings'),
    db.execute('SELECT page_slug, draft_seo, published_seo FROM page_seo'),
  ]);

  const sections = secRes.rows.map((r) => {
    const contentRaw = mode === 'draft' ? r.draft_content : r.published_content;
    const orderRaw = mode === 'draft' ? r.draft_order : r.published_order;
    return {
      id: String(r.id),
      page_slug: String(r.page_slug) as CmsPageSlug,
      section_key: String(r.section_key),
      section_title: String(r.section_title),
      content: parseJsonSafe<PageSectionContent>(contentRaw, {}),
      section_order: Number(orderRaw ?? 0),
      is_custom: Number(r.is_custom ?? 0) === 1,
    };
  });

  const settings = buildSettingsMap(
    setRes.rows as unknown as Array<Record<string, unknown>>,
    mode,
  );

  const seo: Record<CmsPageSlug, PageSeoData> = {
    home: { ...DEFAULT_PAGE_SEO.home },
    about: { ...DEFAULT_PAGE_SEO.about },
    packages: { ...DEFAULT_PAGE_SEO.packages },
    offers: { ...DEFAULT_PAGE_SEO.offers },
    coverage: { ...DEFAULT_PAGE_SEO.coverage },
    contact: { ...DEFAULT_PAGE_SEO.contact },
  };

  for (const r of seoRes.rows) {
    const slug = String(r.page_slug) as CmsPageSlug;
    if (slug in seo) {
      const raw = mode === 'draft' ? r.draft_seo : r.published_seo;
      seo[slug] = { ...seo[slug], ...parseJsonSafe<Partial<PageSeoData>>(raw, {}) };
    }
  }

  return {
    isPreview: mode === 'draft',
    settings,
    sections,
    seo,
  };
}

export async function getCmsWorkspacePayload(): Promise<CmsAdminWorkspacePayload> {
  const db = await ensureDatabase();

  const [secRes, setRes, seoRes, mediaRes] = await Promise.all([
    db.execute(`
      SELECT id, page_slug, section_key, section_title, draft_content, published_content,
             draft_order, published_order, draft_visible, published_visible,
             has_unpublished_changes, is_custom, deleted_in_draft, updated_at
      FROM page_contents
      ORDER BY page_slug ASC, draft_order ASC
    `),
    db.execute(
      'SELECT setting_key, draft_value, published_value, has_unpublished_changes FROM website_settings',
    ),
    db.execute(
      'SELECT id, page_slug, draft_seo, published_seo, has_unpublished_changes, updated_at FROM page_seo ORDER BY page_slug ASC',
    ),
    db.execute(
      'SELECT id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, uploaded_at FROM media_assets ORDER BY is_builtin ASC, uploaded_at DESC',
    ),
  ]);

  const sections: PageContentRecord[] = secRes.rows.map((r) => ({
    id: String(r.id),
    page_slug: String(r.page_slug) as CmsPageSlug,
    section_key: String(r.section_key),
    section_title: String(r.section_title),
    draft_content: parseJsonSafe<PageSectionContent>(r.draft_content, {}),
    published_content: r.published_content
      ? parseJsonSafe<PageSectionContent | null>(r.published_content, null)
      : null,
    draft_order: Number(r.draft_order ?? 0),
    published_order: Number(r.published_order ?? 0),
    draft_visible: Number(r.draft_visible ?? 1) === 1,
    published_visible: Number(r.published_visible ?? 1) === 1,
    has_unpublished_changes: Number(r.has_unpublished_changes ?? 0) === 1,
    is_custom: Number(r.is_custom ?? 0) === 1,
    deleted_in_draft: Number(r.deleted_in_draft ?? 0) === 1,
    updated_at: String(r.updated_at),
  }));

  const settingsRows = setRes.rows as unknown as Array<Record<string, unknown>>;
  const draftSettings = buildSettingsMap(settingsRows, 'draft');
  const publishedSettings = buildSettingsMap(settingsRows, 'published');
  const settingsHasUnpublished = settingsRows.some(
    (r) => Number(r.has_unpublished_changes ?? 0) === 1,
  );

  const seoRecords: PageSeoRecord[] = seoRes.rows.map((r) => {
    const slug = String(r.page_slug) as CmsPageSlug;
    return {
      id: String(r.id),
      page_slug: slug,
      draft_seo: { ...DEFAULT_PAGE_SEO[slug], ...parseJsonSafe<Partial<PageSeoData>>(r.draft_seo, {}) },
      published_seo: {
        ...DEFAULT_PAGE_SEO[slug],
        ...parseJsonSafe<Partial<PageSeoData>>(r.published_seo, {}),
      },
      has_unpublished_changes: Number(r.has_unpublished_changes ?? 0) === 1,
      updated_at: String(r.updated_at),
    };
  });

  const media: MediaAssetRecord[] = mediaRes.rows.map((r) => ({
    id: String(r.id),
    file_name: String(r.file_name),
    file_url: String(r.file_url),
    alt_text: String(r.alt_text ?? ''),
    file_type: String(r.file_type),
    file_size: Number(r.file_size ?? 0),
    category: String(r.category ?? 'general'),
    is_builtin: Number(r.is_builtin ?? 0) === 1,
    uploaded_at: String(r.uploaded_at),
  }));

  const unpublishedCount =
    sections.filter((s) => s.has_unpublished_changes).length +
    (settingsHasUnpublished ? 1 : 0) +
    seoRecords.filter((s) => s.has_unpublished_changes).length;

  return {
    sections,
    draftSettings,
    publishedSettings,
    settingsHasUnpublished,
    seoRecords,
    media,
    unpublishedCount,
  };
}
