import { Router } from '../miniRouter.js';
import { base64ToBytes, randomUUID } from '../cryptoWeb.js';
import { ensureDatabase } from '../db.js';
import { extractSessionToken, verifySessionToken } from '../auth.js';
import { getPublicSitePayload } from '../cmsService.js';
import { inquiryCreateSchema } from '../validations.js';
import type { OfferRecord, OfferSummary, PackageRecord } from '../../types/isp.js';

export const publicRoutes = Router();

function parseFeatures(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Public CMS site content, settings, and SEO (draft preview allowed only for authenticated admin)
publicRoutes.get('/site', async (req, res) => {
  try {
    let mode: 'draft' | 'published' = 'published';
    if (req.query.preview === '1') {
      const token = extractSessionToken(req);
      const payload = await verifySessionToken(token);
      if (payload && (payload.role === 'admin' || payload.role === 'super_admin')) {
        mode = 'draft';
      }
    }
    const sitePayload = await getPublicSitePayload(mode);
    res.json(sitePayload);
  } catch (err) {
    console.error('Error loading public site content:', err);
    res.status(500).json({ error: 'Unable to load website content.' });
  }
});

// Serve uploaded media assets stored in Turso/LibSQL
publicRoutes.get('/media/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'SELECT file_type, data_base64 FROM media_assets WHERE id = ? LIMIT 1',
      args: [req.params.id],
    });
    const row = result.rows[0];
    if (!row || !row.data_base64) {
      res.status(404).send('Image not found.');
      return;
    }

    const fileType = String(row.file_type);
    const bytes = base64ToBytes(String(row.data_base64));
    res.setHeader('Content-Type', fileType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(bytes);
  } catch (err) {
    console.error('Media serve error:', err);
    res.status(500).send('Unable to serve media asset.');
  }
});

publicRoutes.get('/packages', async (_req, res) => {
  try {
    const db = await ensureDatabase();

    const pkgRes = await db.execute(`
      SELECT id, name, speed_mbps, monthly_price, description, features, image_url, show_on_home, status, created_at, updated_at
      FROM packages
      WHERE status = 'active'
      ORDER BY speed_mbps ASC, monthly_price ASC
    `);

    const offersRes = await db.execute(`
      SELECT id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, image_url
      FROM offers
      WHERE status = 'active'
        AND date(start_date) <= date('now')
        AND date(expiry_date) >= date('now')
      ORDER BY created_at DESC
    `);

    const offerByPackage = new Map<string, OfferSummary>();
    for (const row of offersRes.rows) {
      const pkgId = row.package_id ? String(row.package_id) : null;
      if (pkgId && !offerByPackage.has(pkgId)) {
        offerByPackage.set(pkgId, {
          id: String(row.id),
          title: String(row.title),
          description: String(row.description),
          discount_type: String(row.discount_type) as OfferSummary['discount_type'],
          discount_value: Number(row.discount_value),
          start_date: String(row.start_date),
          expiry_date: String(row.expiry_date),
          image_url: row.image_url ? String(row.image_url) : null,
        });
      }
    }

    const packages: PackageRecord[] = pkgRes.rows.map((row) => {
      const id = String(row.id);
      return {
        id,
        name: String(row.name),
        speed_mbps: Number(row.speed_mbps),
        monthly_price: Number(row.monthly_price),
        description: String(row.description),
        features: parseFeatures(row.features),
        image_url: row.image_url ? String(row.image_url) : null,
        show_on_home: Number(row.show_on_home ?? 1) === 1,
        status: 'active',
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        active_offer: offerByPackage.get(id) ?? null,
      };
    });

    res.json({ packages });
  } catch (err) {
    console.error('Error loading public packages:', err);
    res.status(500).json({ error: 'Unable to load internet packages.' });
  }
});

publicRoutes.get('/offers', async (_req, res) => {
  try {
    const db = await ensureDatabase();

    const result = await db.execute(`
      SELECT
        o.id,
        o.title,
        o.description,
        o.discount_type,
        o.discount_value,
        o.package_id,
        o.start_date,
        o.expiry_date,
        o.image_url,
        o.show_on_home,
        o.status,
        o.created_at,
        p.name AS package_name,
        p.speed_mbps AS package_speed_mbps,
        p.monthly_price AS package_monthly_price,
        p.status AS package_status
      FROM offers o
      LEFT JOIN packages p ON o.package_id = p.id
      WHERE o.status = 'active'
        AND date(o.start_date) <= date('now')
        AND date(o.expiry_date) >= date('now')
        AND (o.package_id IS NULL OR p.status = 'active')
      ORDER BY o.expiry_date ASC, o.created_at DESC
    `);

    const offers: OfferRecord[] = result.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      discount_type: String(row.discount_type) as OfferRecord['discount_type'],
      discount_value: Number(row.discount_value),
      package_id: row.package_id ? String(row.package_id) : null,
      package_name: row.package_name ? String(row.package_name) : null,
      package_speed_mbps:
        row.package_speed_mbps !== null && row.package_speed_mbps !== undefined
          ? Number(row.package_speed_mbps)
          : null,
      package_monthly_price:
        row.package_monthly_price !== null && row.package_monthly_price !== undefined
          ? Number(row.package_monthly_price)
          : null,
      start_date: String(row.start_date),
      expiry_date: String(row.expiry_date),
      image_url: row.image_url ? String(row.image_url) : null,
      show_on_home: Number(row.show_on_home ?? 1) === 1,
      status: 'active',
      created_at: String(row.created_at),
    }));

    res.json({ offers });
  } catch (err) {
    console.error('Error loading public offers:', err);
    res.status(500).json({ error: 'Unable to load promotional offers.' });
  }
});

publicRoutes.post('/inquiries', async (req, res) => {
  try {
    const parsed = inquiryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid inquiry submission.',
      });
      return;
    }

    const db = await ensureDatabase();
    const data = parsed.data;
    const id = randomUUID();
    const packageId = data.package_id && data.package_id.length > 0 ? data.package_id : null;

    if (packageId) {
      const pkgCheck = await db.execute({
        sql: "SELECT id FROM packages WHERE id = ? AND status = 'active' LIMIT 1",
        args: [packageId],
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: 'Selected package is not currently available.' });
        return;
      }
    }

    await db.execute({
      sql: `INSERT INTO inquiries (id, type, full_name, mobile, email, address, package_id, inquiry_type, message, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      args: [
        id,
        data.type,
        data.full_name,
        data.mobile,
        data.email ? data.email : null,
        data.address,
        packageId,
        data.inquiry_type ? data.inquiry_type : null,
        data.message ? data.message : null,
      ],
    });

    res.status(201).json({
      id,
      reference: `INQ-${id.slice(0, 6).toUpperCase()}`,
      message: 'Thank you. Our Sitakunda support desk will contact you shortly.',
    });
  } catch (err) {
    console.error('Error submitting inquiry:', err);
    res.status(500).json({ error: 'Unable to submit inquiry at this moment.' });
  }
});
