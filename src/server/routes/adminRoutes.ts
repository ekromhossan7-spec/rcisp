import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { ensureDatabase } from '../db.js';
import { requireAdmin, type AuthenticatedRequest } from '../auth.js';
import { recordAuditLog } from '../cmsService.js';
import {
  assignPackageSchema,
  customerCreateSchema,
  customerUpdateSchema,
  inquiryStatusSchema,
  offerSchema,
  packageSchema,
} from '../validations.js';
import type {
  CustomerRecord,
  DashboardOverview,
  InquiryRecord,
  OfferRecord,
  PackageRecord,
  SubscriptionRecord,
} from '../../types/isp.js';

export const adminRoutes = Router();

adminRoutes.use(requireAdmin);

function parseFeatures(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Dashboard Overview
// ---------------------------------------------------------------------------
adminRoutes.get('/overview', async (_req, res) => {
  try {
    const db = await ensureDatabase();

    const [
      custCounts,
      pkgCounts,
      offerCounts,
      inquiryCounts,
      recentCustRes,
      recentPkgRes,
      recentSubRes,
    ] = await Promise.all([
      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive_count
        FROM customers
      `),
      db.execute(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count
        FROM packages
        WHERE status != 'deleted'
      `),
      db.execute(`
        SELECT COUNT(*) AS active_count
        FROM offers
        WHERE status = 'active'
          AND date(start_date) <= date('now')
          AND date(expiry_date) >= date('now')
      `),
      db.execute(`
        SELECT COUNT(*) AS new_count
        FROM inquiries
        WHERE status = 'new'
      `),
      db.execute(`
        SELECT
          c.id, c.customer_code, c.name, c.mobile, c.email, c.address, c.status, c.created_at, c.updated_at,
          s.id AS sub_id, s.package_id AS sub_package_id, s.monthly_price AS sub_price, s.start_date AS sub_start,
          s.end_date AS sub_end, s.status AS sub_status,
          p.name AS pkg_name, p.speed_mbps AS pkg_speed
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
        LEFT JOIN packages p ON p.id = s.package_id
        ORDER BY c.created_at DESC
        LIMIT 5
      `),
      db.execute(`
        SELECT id, name, speed_mbps, monthly_price, description, features, status, created_at, updated_at
        FROM packages
        WHERE status != 'deleted'
        ORDER BY updated_at DESC
        LIMIT 5
      `),
      db.execute(`
        SELECT
          s.id, s.customer_id, s.package_id, s.monthly_price, s.start_date, s.end_date, s.status, s.created_at,
          c.customer_code, c.name AS customer_name, c.mobile AS customer_mobile,
          p.name AS package_name, p.speed_mbps
        FROM subscriptions s
        INNER JOIN customers c ON c.id = s.customer_id
        INNER JOIN packages p ON p.id = s.package_id
        ORDER BY s.created_at DESC
        LIMIT 6
      `),
    ]);

    const overview: DashboardOverview = {
      stats: {
        totalCustomers: Number(custCounts.rows[0]?.total ?? 0),
        activeCustomers: Number(custCounts.rows[0]?.active_count ?? 0),
        inactiveCustomers: Number(custCounts.rows[0]?.inactive_count ?? 0),
        totalPackages: Number(pkgCounts.rows[0]?.total ?? 0),
        activePackages: Number(pkgCounts.rows[0]?.active_count ?? 0),
        activeOffers: Number(offerCounts.rows[0]?.active_count ?? 0),
        newInquiries: Number(inquiryCounts.rows[0]?.new_count ?? 0),
      },
      recentCustomers: recentCustRes.rows.map((r) => ({
        id: String(r.id),
        customer_code: String(r.customer_code),
        name: String(r.name),
        mobile: String(r.mobile),
        email: r.email ? String(r.email) : null,
        address: String(r.address),
        status: String(r.status) as CustomerRecord['status'],
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        active_subscription: r.sub_id
          ? {
              id: String(r.sub_id),
              package_id: String(r.sub_package_id),
              package_name: String(r.pkg_name),
              speed_mbps: Number(r.pkg_speed),
              monthly_price: Number(r.sub_price),
              start_date: String(r.sub_start),
              end_date: r.sub_end ? String(r.sub_end) : null,
              status: String(r.sub_status) as SubscriptionRecord['status'],
            }
          : null,
      })),
      recentPackages: recentPkgRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        speed_mbps: Number(r.speed_mbps),
        monthly_price: Number(r.monthly_price),
        description: String(r.description),
        features: parseFeatures(r.features),
        image_url: r.image_url ? String(r.image_url) : null,
        show_on_home: Number(r.show_on_home ?? 1) === 1,
        status: String(r.status) as PackageRecord['status'],
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      })),
      recentAssignments: recentSubRes.rows.map((r) => ({
        id: String(r.id),
        customer_id: String(r.customer_id),
        customer_code: String(r.customer_code),
        customer_name: String(r.customer_name),
        customer_mobile: String(r.customer_mobile),
        package_id: String(r.package_id),
        package_name: String(r.package_name),
        speed_mbps: Number(r.speed_mbps),
        monthly_price: Number(r.monthly_price),
        start_date: String(r.start_date),
        end_date: r.end_date ? String(r.end_date) : null,
        status: String(r.status) as SubscriptionRecord['status'],
        created_at: String(r.created_at),
      })),
    };

    res.json(overview);
  } catch (err) {
    console.error('Overview error:', err);
    res.status(500).json({ error: 'Unable to load dashboard overview.' });
  }
});

// ---------------------------------------------------------------------------
// Packages CRUD
// ---------------------------------------------------------------------------
adminRoutes.get('/packages', async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(`
      SELECT
        p.id, p.name, p.speed_mbps, p.monthly_price, p.description, p.features, p.image_url, p.show_on_home, p.status, p.created_at, p.updated_at,
        COUNT(CASE WHEN s.status = 'active' THEN 1 END) AS active_subscriber_count
      FROM packages p
      LEFT JOIN subscriptions s ON s.package_id = p.id
      WHERE p.status != 'deleted'
      GROUP BY p.id
      ORDER BY p.speed_mbps ASC, p.created_at DESC
    `);

    const packages: PackageRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      speed_mbps: Number(r.speed_mbps),
      monthly_price: Number(r.monthly_price),
      description: String(r.description),
      features: parseFeatures(r.features),
      image_url: r.image_url ? String(r.image_url) : null,
      show_on_home: Number(r.show_on_home ?? 1) === 1,
      status: String(r.status) as PackageRecord['status'],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      active_subscriber_count: Number(r.active_subscriber_count ?? 0),
    }));

    res.json({ packages });
  } catch (err) {
    console.error('Admin packages list error:', err);
    res.status(500).json({ error: 'Unable to load packages.' });
  }
});

adminRoutes.post('/packages', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = packageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid package fields.' });
      return;
    }

    const db = await ensureDatabase();
    const id = randomUUID();
    const d = parsed.data;
    await db.execute({
      sql: `INSERT INTO packages (id, name, speed_mbps, monthly_price, description, features, image_url, show_on_home, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        d.name,
        d.speed_mbps,
        d.monthly_price,
        d.description,
        JSON.stringify(d.features),
        d.image_url || null,
        d.show_on_home ? 1 : 0,
        d.status,
      ],
    });

    await recordAuditLog(req.admin, 'PACKAGE_CREATED', 'package', id, `Created package "${d.name}"`);
    res.status(201).json({ id, message: 'Internet package created.' });
  } catch (err) {
    console.error('Create package error:', err);
    res.status(500).json({ error: 'Unable to create package.' });
  }
});

adminRoutes.put('/packages/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = packageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid package fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const result = await db.execute({
      sql: `UPDATE packages
            SET name = ?, speed_mbps = ?, monthly_price = ?, description = ?, features = ?, image_url = ?, show_on_home = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status != 'deleted'`,
      args: [
        d.name,
        d.speed_mbps,
        d.monthly_price,
        d.description,
        JSON.stringify(d.features),
        d.image_url || null,
        d.show_on_home ? 1 : 0,
        d.status,
        req.params.id,
      ],
    });

    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    await recordAuditLog(req.admin, 'PACKAGE_UPDATED', 'package', req.params.id, `Updated package "${d.name}"`);
    res.json({ message: 'Package updated successfully.' });
  } catch (err) {
    console.error('Update package error:', err);
    res.status(500).json({ error: 'Unable to update package.' });
  }
});

adminRoutes.patch('/packages/:id/status', async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ error: 'Status must be active or inactive.' });
      return;
    }

    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'deleted'`,
      args: [status, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    res.json({ message: `Package marked as ${status}.` });
  } catch (err) {
    console.error('Toggle package status error:', err);
    res.status(500).json({ error: 'Unable to update package status.' });
  }
});

adminRoutes.delete('/packages/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const pkgId = req.params.id;

    const existingPkg = await db.execute({
      sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
      args: [pkgId],
    });
    if (existingPkg.rows.length === 0) {
      res.status(404).json({ error: 'Package not found.' });
      return;
    }

    const subCountRes = await db.execute({
      sql: 'SELECT COUNT(*) AS total FROM subscriptions WHERE package_id = ?',
      args: [pkgId],
    });
    const subCount = Number(subCountRes.rows[0]?.total ?? 0);

    if (subCount > 0) {
      // Preserve historical subscription records using soft deletion
      await db.execute({
        sql: "UPDATE packages SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [pkgId],
      });
      await db.execute({
        sql: "UPDATE offers SET status = 'inactive' WHERE package_id = ?",
        args: [pkgId],
      });
      res.json({
        softDeleted: true,
        message: 'Package archived (soft-deleted) so existing customer subscription history remains intact.',
      });
      return;
    }

    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: 'UPDATE offers SET package_id = NULL WHERE package_id = ?',
        args: [pkgId],
      });
      await tx.execute({
        sql: 'DELETE FROM packages WHERE id = ?',
        args: [pkgId],
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    res.json({ softDeleted: false, message: 'Package permanently deleted.' });
  } catch (err) {
    console.error('Delete package error:', err);
    res.status(500).json({ error: 'Unable to delete package.' });
  }
});

adminRoutes.get('/packages/:id/customers', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `
        SELECT
          c.id, c.customer_code, c.name, c.mobile, c.email, c.address, c.status,
          s.id AS subscription_id, s.monthly_price, s.start_date, s.end_date, s.status AS subscription_status
        FROM subscriptions s
        INNER JOIN customers c ON c.id = s.customer_id
        WHERE s.package_id = ? AND s.status = 'active'
        ORDER BY s.start_date DESC
      `,
      args: [req.params.id],
    });

    res.json({
      subscribers: result.rows.map((r) => ({
        customer_id: String(r.id),
        customer_code: String(r.customer_code),
        name: String(r.name),
        mobile: String(r.mobile),
        address: String(r.address),
        customer_status: String(r.status),
        subscription_id: String(r.subscription_id),
        monthly_price: Number(r.monthly_price),
        start_date: String(r.start_date),
        end_date: r.end_date ? String(r.end_date) : null,
      })),
    });
  } catch (err) {
    console.error('Package subscribers error:', err);
    res.status(500).json({ error: 'Unable to load package subscribers.' });
  }
});

// ---------------------------------------------------------------------------
// Offers CRUD
// ---------------------------------------------------------------------------
adminRoutes.get('/offers', async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(`
      SELECT
        o.id, o.title, o.description, o.discount_type, o.discount_value, o.package_id,
        o.start_date, o.expiry_date, o.image_url, o.show_on_home, o.status, o.created_at,
        p.name AS package_name, p.speed_mbps AS package_speed_mbps, p.monthly_price AS package_monthly_price
      FROM offers o
      LEFT JOIN packages p ON o.package_id = p.id
      ORDER BY o.created_at DESC
    `);

    const offers: OfferRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      description: String(r.description),
      discount_type: String(r.discount_type) as OfferRecord['discount_type'],
      discount_value: Number(r.discount_value),
      package_id: r.package_id ? String(r.package_id) : null,
      package_name: r.package_name ? String(r.package_name) : null,
      package_speed_mbps:
        r.package_speed_mbps !== null && r.package_speed_mbps !== undefined
          ? Number(r.package_speed_mbps)
          : null,
      package_monthly_price:
        r.package_monthly_price !== null && r.package_monthly_price !== undefined
          ? Number(r.package_monthly_price)
          : null,
      start_date: String(r.start_date),
      expiry_date: String(r.expiry_date),
      image_url: r.image_url ? String(r.image_url) : null,
      show_on_home: Number(r.show_on_home ?? 1) === 1,
      status: String(r.status) as OfferRecord['status'],
      created_at: String(r.created_at),
    }));

    res.json({ offers });
  } catch (err) {
    console.error('Admin offers list error:', err);
    res.status(500).json({ error: 'Unable to load offers.' });
  }
});

adminRoutes.post('/offers', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid offer fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const pkgId = d.package_id && d.package_id.length > 0 ? d.package_id : null;

    if (pkgId) {
      const pkgCheck = await db.execute({
        sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
        args: [pkgId],
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: 'Selected package does not exist.' });
        return;
      }
    }

    const id = randomUUID();
    await db.execute({
      sql: `INSERT INTO offers (id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, image_url, show_on_home, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        d.title,
        d.description,
        d.discount_type,
        d.discount_value,
        pkgId,
        d.start_date,
        d.expiry_date,
        d.image_url || null,
        d.show_on_home ? 1 : 0,
        d.status,
      ],
    });

    await recordAuditLog(req.admin, 'OFFER_CREATED', 'offer', id, `Created offer "${d.title}"`);
    res.status(201).json({ id, message: 'Promotional offer created.' });
  } catch (err) {
    console.error('Create offer error:', err);
    res.status(500).json({ error: 'Unable to create offer.' });
  }
});

adminRoutes.put('/offers/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid offer fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const pkgId = d.package_id && d.package_id.length > 0 ? d.package_id : null;

    if (pkgId) {
      const pkgCheck = await db.execute({
        sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
        args: [pkgId],
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: 'Selected package does not exist.' });
        return;
      }
    }

    const result = await db.execute({
      sql: `UPDATE offers
            SET title = ?, description = ?, discount_type = ?, discount_value = ?, package_id = ?, start_date = ?, expiry_date = ?, image_url = ?, show_on_home = ?, status = ?
            WHERE id = ?`,
      args: [
        d.title,
        d.description,
        d.discount_type,
        d.discount_value,
        pkgId,
        d.start_date,
        d.expiry_date,
        d.image_url || null,
        d.show_on_home ? 1 : 0,
        d.status,
        req.params.id,
      ],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }

    await recordAuditLog(req.admin, 'OFFER_UPDATED', 'offer', req.params.id, `Updated offer "${d.title}"`);
    res.json({ message: 'Offer updated successfully.' });
  } catch (err) {
    console.error('Update offer error:', err);
    res.status(500).json({ error: 'Unable to update offer.' });
  }
});

adminRoutes.patch('/offers/:id/status', async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ error: 'Status must be active or inactive.' });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'UPDATE offers SET status = ? WHERE id = ?',
      args: [status, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }
    res.json({ message: `Offer marked as ${status}.` });
  } catch (err) {
    console.error('Toggle offer status error:', err);
    res.status(500).json({ error: 'Unable to update offer status.' });
  }
});

adminRoutes.delete('/offers/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'DELETE FROM offers WHERE id = ?',
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }
    res.json({ message: 'Offer deleted.' });
  } catch (err) {
    console.error('Delete offer error:', err);
    res.status(500).json({ error: 'Unable to delete offer.' });
  }
});

// ---------------------------------------------------------------------------
// Customers CRUD & Search
// ---------------------------------------------------------------------------
adminRoutes.get('/customers', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const packageId = typeof req.query.packageId === 'string' ? req.query.packageId.trim() : '';
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const args: Array<string | number> = [];

    if (q.length > 0) {
      conditions.push('(lower(c.name) LIKE ? OR lower(c.customer_code) LIKE ? OR c.mobile LIKE ?)');
      const pattern = `%${q.toLowerCase()}%`;
      args.push(pattern, pattern, `%${q}%`);
    }

    if (status === 'active' || status === 'inactive') {
      conditions.push('c.status = ?');
      args.push(status);
    }

    if (packageId === 'unassigned') {
      conditions.push('s.id IS NULL');
    } else if (packageId.length > 0) {
      conditions.push('s.package_id = ?');
      args.push(packageId);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.execute({
      sql: `
        SELECT COUNT(*) AS total
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
        ${whereSql}
      `,
      args,
    });
    const total = Number(countRes.rows[0]?.total ?? 0);

    const rowsRes = await db.execute({
      sql: `
        SELECT
          c.id, c.customer_code, c.name, c.mobile, c.email, c.address, c.status, c.created_at, c.updated_at,
          s.id AS sub_id, s.package_id AS sub_package_id, s.monthly_price AS sub_price,
          s.start_date AS sub_start, s.end_date AS sub_end, s.status AS sub_status,
          p.name AS pkg_name, p.speed_mbps AS pkg_speed
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
        LEFT JOIN packages p ON p.id = s.package_id
        ${whereSql}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limit, offset],
    });

    const customers: CustomerRecord[] = rowsRes.rows.map((r) => ({
      id: String(r.id),
      customer_code: String(r.customer_code),
      name: String(r.name),
      mobile: String(r.mobile),
      email: r.email ? String(r.email) : null,
      address: String(r.address),
      status: String(r.status) as CustomerRecord['status'],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      active_subscription: r.sub_id
        ? {
            id: String(r.sub_id),
            package_id: String(r.sub_package_id),
            package_name: String(r.pkg_name),
            speed_mbps: Number(r.pkg_speed),
            monthly_price: Number(r.sub_price),
            start_date: String(r.sub_start),
            end_date: r.sub_end ? String(r.sub_end) : null,
            status: String(r.sub_status) as SubscriptionRecord['status'],
          }
        : null,
    }));

    res.json({ customers, total, page, limit });
  } catch (err) {
    console.error('Admin customers list error:', err);
    res.status(500).json({ error: 'Unable to load customers.' });
  }
});

adminRoutes.post('/customers', async (req, res) => {
  try {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid customer fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const customerId = randomUUID();
    const initialPkgId = d.initial_package_id && d.initial_package_id.length > 0 ? d.initial_package_id : null;

    const tx = await db.transaction('write');
    let generatedCode = 'RC-1001';
    try {
      // Generate sequential unique RC-XXXX customer code
      const codesRes = await tx.execute(
        "SELECT customer_code FROM customers WHERE customer_code LIKE 'RC-%' ORDER BY LENGTH(customer_code) DESC, customer_code DESC LIMIT 1",
      );
      if (codesRes.rows.length > 0) {
        const lastCode = String(codesRes.rows[0].customer_code);
        const numericPart = Number.parseInt(lastCode.replace(/^RC-/i, ''), 10);
        if (Number.isFinite(numericPart) && numericPart >= 1000) {
          generatedCode = `RC-${numericPart + 1}`;
        }
      }

      await tx.execute({
        sql: `INSERT INTO customers (id, customer_code, name, mobile, email, address, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          customerId,
          generatedCode,
          d.name,
          d.mobile,
          d.email ? d.email : null,
          d.address,
          d.status,
        ],
      });

      if (initialPkgId) {
        const pkgRes = await tx.execute({
          sql: "SELECT id, monthly_price FROM packages WHERE id = ? AND status = 'active' LIMIT 1",
          args: [initialPkgId],
        });
        const pkgRow = pkgRes.rows[0];
        if (!pkgRow) {
          await tx.rollback();
          res.status(400).json({ error: 'Selected initial package is inactive or does not exist.' });
          return;
        }
        await tx.execute({
          sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, status)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
          args: [randomUUID(), customerId, initialPkgId, Number(pkgRow.monthly_price)],
        });
      }

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    res.status(201).json({
      id: customerId,
      customer_code: generatedCode,
      message: 'Customer record created.',
    });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Unable to create customer record.' });
  }
});

adminRoutes.put('/customers/:id', async (req, res) => {
  try {
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid customer fields.' });
      return;
    }

    const db = await ensureDatabase();
    const d = parsed.data;
    const result = await db.execute({
      sql: `UPDATE customers
            SET name = ?, mobile = ?, email = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [d.name, d.mobile, d.email ? d.email : null, d.address, d.status, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    res.json({ message: 'Customer record updated.' });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Unable to update customer record.' });
  }
});

adminRoutes.patch('/customers/:id/status', async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== 'active' && status !== 'inactive') {
      res.status(400).json({ error: 'Status must be active or inactive.' });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [status, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }
    res.json({ message: `Customer marked as ${status}.` });
  } catch (err) {
    console.error('Toggle customer status error:', err);
    res.status(500).json({ error: 'Unable to update customer status.' });
  }
});

adminRoutes.delete('/customers/:id', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: 'DELETE FROM subscriptions WHERE customer_id = ?',
        args: [req.params.id],
      });
      const delRes = await tx.execute({
        sql: 'DELETE FROM customers WHERE id = ?',
        args: [req.params.id],
      });
      if (delRes.rowsAffected === 0) {
        await tx.rollback();
        res.status(404).json({ error: 'Customer not found.' });
        return;
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    res.json({ message: 'Customer deleted.' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Unable to delete customer.' });
  }
});

adminRoutes.get('/customers/:id/subscriptions', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `
        SELECT
          s.id, s.customer_id, s.package_id, s.monthly_price, s.start_date, s.end_date, s.status, s.created_at,
          c.customer_code, c.name AS customer_name, c.mobile AS customer_mobile,
          p.name AS package_name, p.speed_mbps
        FROM subscriptions s
        INNER JOIN customers c ON c.id = s.customer_id
        INNER JOIN packages p ON p.id = s.package_id
        WHERE s.customer_id = ?
        ORDER BY s.created_at DESC
      `,
      args: [req.params.id],
    });

    const history: SubscriptionRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      customer_id: String(r.customer_id),
      customer_code: String(r.customer_code),
      customer_name: String(r.customer_name),
      customer_mobile: String(r.customer_mobile),
      package_id: String(r.package_id),
      package_name: String(r.package_name),
      speed_mbps: Number(r.speed_mbps),
      monthly_price: Number(r.monthly_price),
      start_date: String(r.start_date),
      end_date: r.end_date ? String(r.end_date) : null,
      status: String(r.status) as SubscriptionRecord['status'],
      created_at: String(r.created_at),
    }));

    res.json({ history });
  } catch (err) {
    console.error('Customer history error:', err);
    res.status(500).json({ error: 'Unable to load customer subscription history.' });
  }
});

// ---------------------------------------------------------------------------
// Package Assignments & Reports
// ---------------------------------------------------------------------------
adminRoutes.get('/subscriptions', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const packageId = typeof req.query.packageId === 'string' ? req.query.packageId.trim() : '';
    const fromDate = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toDate = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const conditions: string[] = [];
    const args: Array<string | number> = [];

    if (q.length > 0) {
      conditions.push('(lower(c.name) LIKE ? OR lower(c.customer_code) LIKE ? OR lower(p.name) LIKE ?)');
      const pattern = `%${q.toLowerCase()}%`;
      args.push(pattern, pattern, pattern);
    }

    if (status === 'active' || status === 'changed' || status === 'cancelled' || status === 'ended') {
      conditions.push('s.status = ?');
      args.push(status);
    } else if (status === 'inactive') {
      conditions.push("s.status != 'active'");
    }

    if (packageId.length > 0) {
      conditions.push('s.package_id = ?');
      args.push(packageId);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      conditions.push('date(s.start_date) >= date(?)');
      args.push(fromDate);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      conditions.push('date(s.start_date) <= date(?)');
      args.push(toDate);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.execute({
      sql: `
        SELECT
          s.id, s.customer_id, s.package_id, s.monthly_price, s.start_date, s.end_date, s.status, s.created_at,
          c.customer_code, c.name AS customer_name, c.mobile AS customer_mobile,
          p.name AS package_name, p.speed_mbps
        FROM subscriptions s
        INNER JOIN customers c ON c.id = s.customer_id
        INNER JOIN packages p ON p.id = s.package_id
        ${whereSql}
        ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.created_at DESC
        LIMIT 250
      `,
      args,
    });

    const subscriptions: SubscriptionRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      customer_id: String(r.customer_id),
      customer_code: String(r.customer_code),
      customer_name: String(r.customer_name),
      customer_mobile: String(r.customer_mobile),
      package_id: String(r.package_id),
      package_name: String(r.package_name),
      speed_mbps: Number(r.speed_mbps),
      monthly_price: Number(r.monthly_price),
      start_date: String(r.start_date),
      end_date: r.end_date ? String(r.end_date) : null,
      status: String(r.status) as SubscriptionRecord['status'],
      created_at: String(r.created_at),
    }));

    res.json({ subscriptions });
  } catch (err) {
    console.error('Subscriptions list error:', err);
    res.status(500).json({ error: 'Unable to load subscription records.' });
  }
});

adminRoutes.post('/subscriptions/assign', async (req, res) => {
  try {
    const parsed = assignPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid assignment parameters.' });
      return;
    }

    const db = await ensureDatabase();
    const { customer_id, package_id, end_date } = parsed.data;
    const subId = randomUUID();

    const tx = await db.transaction('write');
    try {
      const custRes = await tx.execute({
        sql: 'SELECT id, name FROM customers WHERE id = ? LIMIT 1',
        args: [customer_id],
      });
      if (custRes.rows.length === 0) {
        await tx.rollback();
        res.status(404).json({ error: 'Customer not found.' });
        return;
      }

      const pkgRes = await tx.execute({
        sql: "SELECT id, name, monthly_price FROM packages WHERE id = ? AND status = 'active' LIMIT 1",
        args: [package_id],
      });
      const pkgRow = pkgRes.rows[0];
      if (!pkgRow) {
        await tx.rollback();
        res.status(400).json({ error: 'Selected package is not active or unavailable.' });
        return;
      }

      // Enforce one active package assignment per customer: close previous active subscription
      await tx.execute({
        sql: `UPDATE subscriptions
              SET status = 'changed', end_date = CURRENT_TIMESTAMP
              WHERE customer_id = ? AND status = 'active'`,
        args: [customer_id],
      });

      await tx.execute({
        sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, end_date, status)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'active')`,
        args: [
          subId,
          customer_id,
          package_id,
          Number(pkgRow.monthly_price),
          end_date && end_date.length > 0 ? end_date : null,
        ],
      });

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    res.status(201).json({
      id: subId,
      message: 'Package assigned to customer successfully.',
    });
  } catch (err) {
    console.error('Assign package error:', err);
    res.status(500).json({ error: 'Unable to assign package.' });
  }
});

adminRoutes.patch('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE subscriptions
            SET status = 'cancelled', end_date = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'active'`,
      args: [req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Active subscription not found.' });
      return;
    }
    res.json({ message: 'Subscription assignment cancelled.' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Unable to cancel subscription.' });
  }
});

// ---------------------------------------------------------------------------
// Public Inquiries Management
// ---------------------------------------------------------------------------
adminRoutes.get('/inquiries', async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(`
      SELECT
        i.id, i.type, i.full_name, i.mobile, i.email, i.address, i.package_id,
        i.inquiry_type, i.message, i.status, i.created_at,
        p.name AS package_name
      FROM inquiries i
      LEFT JOIN packages p ON p.id = i.package_id
      ORDER BY CASE WHEN i.status = 'new' THEN 0 ELSE 1 END, i.created_at DESC
      LIMIT 200
    `);

    const inquiries: InquiryRecord[] = result.rows.map((r) => ({
      id: String(r.id),
      type: String(r.type) as InquiryRecord['type'],
      full_name: String(r.full_name),
      mobile: String(r.mobile),
      email: r.email ? String(r.email) : null,
      address: String(r.address),
      package_id: r.package_id ? String(r.package_id) : null,
      package_name: r.package_name ? String(r.package_name) : null,
      inquiry_type: r.inquiry_type ? String(r.inquiry_type) : null,
      message: r.message ? String(r.message) : null,
      status: String(r.status) as InquiryRecord['status'],
      created_at: String(r.created_at),
    }));

    res.json({ inquiries });
  } catch (err) {
    console.error('Load inquiries error:', err);
    res.status(500).json({ error: 'Unable to load inquiries.' });
  }
});

adminRoutes.patch('/inquiries/:id/status', async (req, res) => {
  try {
    const parsed = inquiryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid inquiry status.' });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: 'UPDATE inquiries SET status = ? WHERE id = ?',
      args: [parsed.data.status, req.params.id],
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }
    res.json({ message: 'Inquiry status updated.' });
  } catch (err) {
    console.error('Update inquiry status error:', err);
    res.status(500).json({ error: 'Unable to update inquiry status.' });
  }
});
