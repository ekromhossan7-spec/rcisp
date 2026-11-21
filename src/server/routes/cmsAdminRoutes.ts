import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { ensureDatabase } from '../db.js';
import { requireAdmin, type AuthenticatedRequest } from '../auth.js';
import {
  getCmsWorkspacePayload,
  getPublicSitePayload,
  recordAuditLog,
  sanitizeFileName,
  verifyImageMagicBytes,
} from '../cmsService.js';
import {
  cmsPageSlugSchema,
  cmsReorderSchema,
  cmsSectionCreateSchema,
  cmsSectionUpdateSchema,
  mediaAltUpdateSchema,
  mediaUploadSchema,
  pageSeoUpdateSchema,
  websiteSettingsSchema,
} from '../validations.js';
import type { AuditLogRecord } from '../../types/isp.js';

export const cmsAdminRoutes = Router();

cmsAdminRoutes.use(requireAdmin);

// Load full CMS workspace state (sections, settings, SEO, media, unpublished count)
cmsAdminRoutes.get('/workspace', async (_req, res) => {
  try {
    const payload = await getCmsWorkspacePayload();
    res.json(payload);
  } catch (err) {
    console.error('CMS workspace load error:', err);
    res.status(500).json({ error: 'Unable to load website CMS workspace.' });
  }
});

// Preview unpublished draft site payload
cmsAdminRoutes.get('/preview', async (_req, res) => {
  try {
    const payload = await getPublicSitePayload('draft');
    res.json(payload);
  } catch (err) {
    console.error('CMS preview error:', err);
    res.status(500).json({ error: 'Unable to load draft preview.' });
  }
});

// Update section draft content & visibility
cmsAdminRoutes.put('/sections/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = cmsSectionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid section payload.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const result = await db.execute({
      sql: `UPDATE page_contents
            SET section_title = ?, draft_content = ?, draft_visible = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_in_draft = 0`,
      args: [d.section_title, JSON.stringify(d.draft_content), d.draft_visible ? 1 : 0, req.params.id],
    });

    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }

    await recordAuditLog(
      req.admin,
      'CMS_DRAFT_SAVED',
      'page_section',
      req.params.id,
      `Saved draft changes for section "${d.section_title}"`,
    );

    res.json({ message: 'Section draft saved.' });
  } catch (err) {
    console.error('Update CMS section error:', err);
    res.status(500).json({ error: 'Unable to save section draft.' });
  }
});

// Add custom section to a page (in draft)
cmsAdminRoutes.post('/sections', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = cmsSectionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid section fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const id = randomUUID();
    const sectionKey = `custom_${Date.now()}_${id.slice(0, 4)}`;

    const maxOrderRes = await db.execute({
      sql: 'SELECT COALESCE(MAX(draft_order), 0) AS max_order FROM page_contents WHERE page_slug = ? AND deleted_in_draft = 0',
      args: [d.page_slug],
    });
    const nextOrder = Number(maxOrderRes.rows[0]?.max_order ?? 0) + 1;

    await db.execute({
      sql: `INSERT INTO page_contents
            (id, page_slug, section_key, section_title, draft_content, published_content,
             draft_order, published_order, draft_visible, published_visible, has_unpublished_changes, is_custom, deleted_in_draft)
            VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, 0, 1, 1, 0)`,
      args: [
        id,
        d.page_slug,
        sectionKey,
        d.section_title,
        JSON.stringify(d.draft_content),
        nextOrder,
        nextOrder,
        d.draft_visible ? 1 : 0,
      ],
    });

    await recordAuditLog(
      req.admin,
      'CMS_SECTION_ADDED',
      'page_section',
      id,
      `Added draft section "${d.section_title}" to /${d.page_slug}`,
    );

    res.status(201).json({ id, message: 'Custom section added to draft.' });
  } catch (err) {
    console.error('Create CMS section error:', err);
    res.status(500).json({ error: 'Unable to add custom section.' });
  }
});

// Toggle section visibility in draft
cmsAdminRoutes.patch('/sections/:id/visibility', async (req: AuthenticatedRequest, res) => {
  try {
    const visible = Boolean(req.body?.visible);
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE page_contents
            SET draft_visible = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_in_draft = 0`,
      args: [visible ? 1 : 0, req.params.id],
    });

    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }

    await recordAuditLog(
      req.admin,
      'CMS_SECTION_VISIBILITY',
      'page_section',
      req.params.id,
      `Set section visibility to ${visible ? 'visible' : 'hidden'} in draft`,
    );

    res.json({ message: `Section ${visible ? 'shown' : 'hidden'} in draft.` });
  } catch (err) {
    console.error('Toggle section visibility error:', err);
    res.status(500).json({ error: 'Unable to update section visibility.' });
  }
});

// Reorder sections on a page in draft
cmsAdminRoutes.put('/sections/reorder', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = cmsReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid reorder request.' });
      return;
    }

    const db = await ensureDatabase();
    const tx = await db.transaction('write');
    try {
      for (let idx = 0; idx < parsed.data.ordered_ids.length; idx++) {
        await tx.execute({
          sql: `UPDATE page_contents
                SET draft_order = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND page_slug = ?`,
          args: [idx + 1, parsed.data.ordered_ids[idx], parsed.data.page_slug],
        });
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    await recordAuditLog(
      req.admin,
      'CMS_SECTIONS_REORDERED',
      'page',
      parsed.data.page_slug,
      `Reordered sections on /${parsed.data.page_slug} in draft`,
    );

    res.json({ message: 'Section order updated in draft.' });
  } catch (err) {
    console.error('Reorder sections error:', err);
    res.status(500).json({ error: 'Unable to reorder sections.' });
  }
});

// Remove section in draft
cmsAdminRoutes.delete('/sections/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = await ensureDatabase();
    const existing = await db.execute({
      sql: 'SELECT id, section_title, published_content FROM page_contents WHERE id = ? LIMIT 1',
      args: [req.params.id],
    });
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Section not found.' });
      return;
    }

    const wasNeverPublished = !row.published_content || String(row.published_content) === '';
    if (wasNeverPublished) {
      await db.execute({ sql: 'DELETE FROM page_contents WHERE id = ?', args: [req.params.id] });
    } else {
      await db.execute({
        sql: `UPDATE page_contents
              SET deleted_in_draft = 1, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [req.params.id],
      });
    }

    await recordAuditLog(
      req.admin,
      'CMS_SECTION_REMOVED',
      'page_section',
      req.params.id,
      `Removed section "${String(row.section_title)}" in draft`,
    );

    res.json({ message: 'Section removed from draft.' });
  } catch (err) {
    console.error('Remove CMS section error:', err);
    res.status(500).json({ error: 'Unable to remove section.' });
  }
});

// Save global website settings draft
cmsAdminRoutes.put('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = websiteSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid website settings.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const tx = await db.transaction('write');
    try {
      for (const [key, value] of Object.entries(d)) {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        await tx.execute({
          sql: `INSERT INTO website_settings (id, setting_key, draft_value, published_value, has_unpublished_changes, updated_at)
                VALUES (?, ?, ?, '', 1, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                  draft_value = excluded.draft_value,
                  has_unpublished_changes = CASE WHEN website_settings.published_value != excluded.draft_value THEN 1 ELSE 0 END,
                  updated_at = CURRENT_TIMESTAMP`,
          args: [randomUUID(), key, serialized],
        });
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    await recordAuditLog(
      req.admin,
      'SETTINGS_DRAFT_SAVED',
      'website_settings',
      null,
      'Updated global website settings draft',
    );

    res.json({ message: 'Website settings saved as draft.' });
  } catch (err) {
    console.error('Update website settings error:', err);
    res.status(500).json({ error: 'Unable to save website settings.' });
  }
});

// Save Page SEO draft
cmsAdminRoutes.put('/seo/:slug', async (req: AuthenticatedRequest, res) => {
  try {
    const slugParsed = cmsPageSlugSchema.safeParse(req.params.slug);
    if (!slugParsed.success) {
      res.status(400).json({ error: 'Invalid page slug.' });
      return;
    }
    const parsed = pageSeoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid SEO fields.' });
      return;
    }

    const db = await ensureDatabase();
    const serialized = JSON.stringify(parsed.data);
    await db.execute({
      sql: `UPDATE page_seo
            SET draft_seo = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE page_slug = ?`,
      args: [serialized, slugParsed.data],
    });

    await recordAuditLog(
      req.admin,
      'SEO_DRAFT_SAVED',
      'page_seo',
      slugParsed.data,
      `Saved SEO draft for /${slugParsed.data}`,
    );

    res.json({ message: 'Page SEO saved as draft.' });
  } catch (err) {
    console.error('Update SEO error:', err);
    res.status(500).json({ error: 'Unable to save page SEO.' });
  }
});

// Publish all pending draft changes live
cmsAdminRoutes.post('/publish', async (req: AuthenticatedRequest, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction('write');
    try {
      await tx.execute('DELETE FROM page_contents WHERE deleted_in_draft = 1');
      await tx.execute(`
        UPDATE page_contents
        SET published_content = draft_content,
            published_order = draft_order,
            published_visible = draft_visible,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1
      `);
      await tx.execute(`
        UPDATE website_settings
        SET published_value = draft_value,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1
      `);
      await tx.execute(`
        UPDATE page_seo
        SET published_seo = draft_seo,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1
      `);
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    await recordAuditLog(
      req.admin,
      'CMS_PUBLISHED',
      'website',
      null,
      'Published all website content, global settings, and SEO drafts to live site',
    );

    res.json({ message: 'All website changes published live.' });
  } catch (err) {
    console.error('CMS publish error:', err);
    res.status(500).json({ error: 'Unable to publish changes.' });
  }
});

// Discard all unpublished draft changes
cmsAdminRoutes.post('/discard', async (req: AuthenticatedRequest, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction('write');
    try {
      await tx.execute("DELETE FROM page_contents WHERE published_content = ''");
      await tx.execute(`
        UPDATE page_contents
        SET draft_content = published_content,
            draft_order = published_order,
            draft_visible = published_visible,
            deleted_in_draft = 0,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1 OR deleted_in_draft = 1
      `);
      await tx.execute(`
        UPDATE website_settings
        SET draft_value = published_value,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1
      `);
      await tx.execute(`
        UPDATE page_seo
        SET draft_seo = published_seo,
            has_unpublished_changes = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE has_unpublished_changes = 1
      `);
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    await recordAuditLog(
      req.admin,
      'CMS_DISCARDED',
      'website',
      null,
      'Cancelled all unpublished draft changes',
    );

    res.json({ message: 'Unpublished draft changes discarded.' });
  } catch (err) {
    console.error('CMS discard error:', err);
    res.status(500).json({ error: 'Unable to discard draft changes.' });
  }
});

// ---------------------------------------------------------------------------
// Media Assets Management (Upload, Replace, Edit Alt, Delete)
// ---------------------------------------------------------------------------
cmsAdminRoutes.get('/media', async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(
      'SELECT id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, uploaded_at FROM media_assets ORDER BY is_builtin ASC, uploaded_at DESC',
    );
    res.json({
      media: result.rows.map((r) => ({
        id: String(r.id),
        file_name: String(r.file_name),
        file_url: String(r.file_url),
        alt_text: String(r.alt_text ?? ''),
        file_type: String(r.file_type),
        file_size: Number(r.file_size ?? 0),
        category: String(r.category ?? 'general'),
        is_builtin: Number(r.is_builtin ?? 0) === 1,
        uploaded_at: String(r.uploaded_at),
      })),
    });
  } catch (err) {
    console.error('Load media error:', err);
    res.status(500).json({ error: 'Unable to load media assets.' });
  }
});

cmsAdminRoutes.post('/media', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = mediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid image payload.' });
      return;
    }

    const d = parsed.data;
    const rawBase64 = d.data_base64.includes(',') ? d.data_base64.split(',')[1] || '' : d.data_base64;
    const buf = Buffer.from(rawBase64, 'base64');

    if (!verifyImageMagicBytes(buf, d.file_type)) {
      res.status(400).json({
        error: 'Invalid or unsupported image file. Upload a valid PNG, JPEG, WebP, GIF, or ICO under 2 MB.',
      });
      return;
    }

    const db = await ensureDatabase();
    const id = randomUUID();
    const safeName = sanitizeFileName(d.file_name);
    const fileUrl = `/api/public/media/${id}`;

    await db.execute({
      sql: `INSERT INTO media_assets (id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, data_base64)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      args: [id, safeName, fileUrl, d.alt_text, d.file_type, buf.length, d.category, buf.toString('base64')],
    });

    await recordAuditLog(
      req.admin,
      'MEDIA_UPLOADED',
      'media_asset',
      id,
      `Uploaded image "${safeName}" (${d.category})`,
    );

    res.status(201).json({
      id,
      file_name: safeName,
      file_url: fileUrl,
      alt_text: d.alt_text,
      file_type: d.file_type,
      file_size: buf.length,
      category: d.category,
      is_builtin: false,
      uploaded_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Upload media error:', err);
    res.status(500).json({ error: 'Unable to upload image.' });
  }
});

cmsAdminRoutes.put('/media/:id/replace', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = mediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid replacement image.' });
      return;
    }

    const d = parsed.data;
    const rawBase64 = d.data_base64.includes(',') ? d.data_base64.split(',')[1] || '' : d.data_base64;
    const buf = Buffer.from(rawBase64, 'base64');

    if (!verifyImageMagicBytes(buf, d.file_type)) {
      res.status(400).json({
        error: 'Invalid or unsupported image file. Upload a valid PNG, JPEG, WebP, GIF, or ICO under 2 MB.',
      });
      return;
    }

    const db = await ensureDatabase();
    const existingRes = await db.execute({
      sql: 'SELECT id, file_name, file_url FROM media_assets WHERE id = ? LIMIT 1',
      args: [req.params.id],
    });
    const existing = existingRes.rows[0];
    if (!existing) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    const oldUrl = String(existing.file_url);
    const newUrl = `/api/public/media/${req.params.id}?v=${Date.now()}`;
    const safeName = sanitizeFileName(d.file_name);

    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `UPDATE media_assets
              SET file_name = ?, file_url = ?, alt_text = ?, file_type = ?, file_size = ?, is_builtin = 0, data_base64 = ?, uploaded_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          safeName,
          newUrl,
          d.alt_text,
          d.file_type,
          buf.length,
          buf.toString('base64'),
          req.params.id,
        ],
      });

      // Automatically update references pointing to the replaced asset URL in drafts/packages/offers
      await tx.execute({
        sql: "UPDATE packages SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE image_url = ?",
        args: [newUrl, oldUrl],
      });
      await tx.execute({
        sql: "UPDATE offers SET image_url = ? WHERE image_url = ?",
        args: [newUrl, oldUrl],
      });
      await tx.execute({
        sql: `UPDATE website_settings
              SET draft_value = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
              WHERE draft_value = ?`,
        args: [newUrl, oldUrl],
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    await recordAuditLog(
      req.admin,
      'MEDIA_REPLACED',
      'media_asset',
      req.params.id,
      `Replaced media asset "${safeName}"`,
    );

    res.json({ message: 'Image replaced successfully.', file_url: newUrl });
  } catch (err) {
    console.error('Replace media error:', err);
    res.status(500).json({ error: 'Unable to replace image.' });
  }
});

cmsAdminRoutes.patch('/media/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = mediaAltUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid media metadata.' });
      return;
    }

    const db = await ensureDatabase();
    const result = await db.execute({
      sql: parsed.data.category
        ? 'UPDATE media_assets SET alt_text = ?, category = ? WHERE id = ?'
        : 'UPDATE media_assets SET alt_text = ? WHERE id = ?',
      args: parsed.data.category
        ? [parsed.data.alt_text, parsed.data.category, req.params.id]
        : [parsed.data.alt_text, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }

    await recordAuditLog(
      req.admin,
      'MEDIA_UPDATED',
      'media_asset',
      req.params.id,
      `Updated alt text for media asset`,
    );

    res.json({ message: 'Image metadata updated.' });
  } catch (err) {
    console.error('Update media metadata error:', err);
    res.status(500).json({ error: 'Unable to update image metadata.' });
  }
});

cmsAdminRoutes.delete('/media/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const db = await ensureDatabase();
    const existing = await db.execute({
      sql: 'SELECT id, file_name, is_builtin FROM media_assets WHERE id = ? LIMIT 1',
      args: [req.params.id],
    });
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }
    if (Number(row.is_builtin ?? 0) === 1) {
      res.status(400).json({
        error: 'Built-in default images cannot be deleted directly—use Replace Image to swap them instead.',
      });
      return;
    }

    await db.execute({ sql: 'DELETE FROM media_assets WHERE id = ?', args: [req.params.id] });

    await recordAuditLog(
      req.admin,
      'MEDIA_DELETED',
      'media_asset',
      req.params.id,
      `Deleted uploaded image "${String(row.file_name)}"`,
    );

    res.json({ message: 'Image deleted.' });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Unable to delete image.' });
  }
});

// Audit Trail
cmsAdminRoutes.get('/audit-logs', async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(
      'SELECT id, admin_id, admin_email, action, entity_type, entity_id, summary, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100',
    );
    const logs: AuditLogRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      admin_id: String(r.admin_id),
      admin_email: String(r.admin_email),
      action: String(r.action),
      entity_type: String(r.entity_type),
      entity_id: r.entity_id ? String(r.entity_id) : null,
      summary: String(r.summary),
      created_at: String(r.created_at),
    }));
    res.json({ logs });
  } catch (err) {
    console.error('Load audit logs error:', err);
    res.status(500).json({ error: 'Unable to load audit logs.' });
  }
});
