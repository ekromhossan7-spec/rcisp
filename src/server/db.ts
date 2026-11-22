import { createClient, type Client } from '@libsql/client';
import { randomUUID } from './cryptoWeb.js';
import { getEnv, isNodeRuntime } from './runtimeEnv.js';
import {
  BUILTIN_MEDIA_SEEDS,
  DEFAULT_PAGE_SEO,
  DEFAULT_SECTIONS,
  DEFAULT_SETTINGS,
} from './cmsSeed.js';
import type { CmsPageSlug } from '../types/isp.js';

export class DatabaseConfigError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

let client: Client | null = null;
let clientCacheKey = '';
let initializedPromise: Promise<void> | null = null;

export function getDb(): Client {
  const configuredUrl = getEnv('TURSO_DATABASE_URL')?.trim() || '';
  const authToken = getEnv('TURSO_AUTH_TOKEN')?.trim() || undefined;

  if (!configuredUrl && !isNodeRuntime()) {
    throw new DatabaseConfigError(
      'Database is not configured. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Cloudflare Pages Environment Variables.',
    );
  }

  const url = configuredUrl || 'file:roman_communication.db';
  const nextKey = `${url}|${authToken || ''}`;
  if (!client || clientCacheKey !== nextKey) {
    client = createClient(authToken ? { url, authToken } : { url });
    clientCacheKey = nextKey;
    initializedPromise = null;
  }
  return client;
}

export async function ensureDatabase(): Promise<Client> {
  const db = getDb();
  if (!initializedPromise) {
    initializedPromise = initSchemaAndSeed(db).catch((err) => {
      initializedPromise = null;
      throw err;
    });
  }
  await initializedPromise;
  return db;
}

async function ensureColumn(
  db: Client,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => String(r.name) === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initSchemaAndSeed(db: Client): Promise<void> {
  await db.execute('PRAGMA foreign_keys = ON');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      speed_mbps INTEGER NOT NULL CHECK(speed_mbps > 0),
      monthly_price REAL NOT NULL CHECK(monthly_price > 0),
      description TEXT NOT NULL,
      features TEXT NOT NULL,
      image_url TEXT,
      show_on_home INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deleted')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
      discount_value REAL NOT NULL CHECK(discount_value > 0),
      package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
      start_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      image_url TEXT,
      show_on_home INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Safe idempotent migrations for existing DB files
  await ensureColumn(db, 'packages', 'image_url', 'TEXT');
  await ensureColumn(db, 'packages', 'show_on_home', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'offers', 'image_url', 'TEXT');
  await ensureColumn(db, 'offers', 'show_on_home', 'INTEGER NOT NULL DEFAULT 1');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
      monthly_price REAL NOT NULL CHECK(monthly_price >= 0),
      start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_date DATETIME,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'changed', 'cancelled', 'ended')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('connection', 'coverage', 'contact')),
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      address TEXT NOT NULL,
      package_id TEXT REFERENCES packages(id) ON DELETE SET NULL,
      inquiry_type TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'resolved')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // CMS Tables (Section 5.8)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS page_contents (
      id TEXT PRIMARY KEY,
      page_slug TEXT NOT NULL,
      section_key TEXT NOT NULL,
      section_title TEXT NOT NULL,
      draft_content TEXT NOT NULL,
      published_content TEXT NOT NULL DEFAULT '',
      draft_order INTEGER NOT NULL DEFAULT 0,
      published_order INTEGER NOT NULL DEFAULT 0,
      draft_visible INTEGER NOT NULL DEFAULT 1,
      published_visible INTEGER NOT NULL DEFAULT 1,
      has_unpublished_changes INTEGER NOT NULL DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0,
      deleted_in_draft INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(page_slug, section_key)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS website_settings (
      id TEXT PRIMARY KEY,
      setting_key TEXT NOT NULL UNIQUE,
      draft_value TEXT NOT NULL DEFAULT '',
      published_value TEXT NOT NULL DEFAULT '',
      has_unpublished_changes INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'general',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      data_base64 TEXT,
      uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS page_seo (
      id TEXT PRIMARY KEY,
      page_slug TEXT NOT NULL UNIQUE,
      draft_seo TEXT NOT NULL,
      published_seo TEXT NOT NULL,
      has_unpublished_changes INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      summary TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Enforce business rule: One customer can have only one active subscription at a time.
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active
    ON subscriptions(customer_id)
    WHERE status = 'active'
  `);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_offers_package ON offers(package_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON subscriptions(package_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_page_contents_slug ON page_contents(page_slug)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)');

  // Seed initial ISP catalog if packages table is empty
  const countRes = await db.execute('SELECT COUNT(*) as total FROM packages');
  const totalPackages = Number(countRes.rows[0]?.total ?? 0);
  if (totalPackages === 0) {
    await seedInitialCatalog(db);
  }

  // Seed CMS tables idempotently (supports upgrading existing DBs seamlessly)
  await seedCmsDefaults(db);
}

async function seedCmsDefaults(db: Client): Promise<void> {
  // 1. PageContents
  const existingSections = await db.execute('SELECT COUNT(*) as total FROM page_contents');
  if (Number(existingSections.rows[0]?.total ?? 0) === 0) {
    for (const s of DEFAULT_SECTIONS) {
      const json = JSON.stringify(s.content);
      await db.execute({
        sql: `INSERT INTO page_contents
              (id, page_slug, section_key, section_title, draft_content, published_content,
               draft_order, published_order, draft_visible, published_visible, has_unpublished_changes, is_custom, deleted_in_draft)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0)`,
        args: [
          randomUUID(),
          s.page_slug,
          s.section_key,
          s.section_title,
          json,
          json,
          s.section_order,
          s.section_order,
        ],
      });
    }
  }

  // 2. WebsiteSettings
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    const serialized = typeof val === 'string' ? val : JSON.stringify(val);
    await db.execute({
      sql: `INSERT OR IGNORE INTO website_settings (id, setting_key, draft_value, published_value, has_unpublished_changes)
            VALUES (?, ?, ?, ?, 0)`,
      args: [randomUUID(), key, serialized, serialized],
    });
  }

  // 3. PageSEO
  for (const slug of Object.keys(DEFAULT_PAGE_SEO) as CmsPageSlug[]) {
    const serialized = JSON.stringify(DEFAULT_PAGE_SEO[slug]);
    await db.execute({
      sql: `INSERT OR IGNORE INTO page_seo (id, page_slug, draft_seo, published_seo, has_unpublished_changes)
            VALUES (?, ?, ?, ?, 0)`,
      args: [randomUUID(), slug, serialized, serialized],
    });
  }

  // 4. Built-in MediaAssets
  const mediaCount = await db.execute('SELECT COUNT(*) as total FROM media_assets');
  if (Number(mediaCount.rows[0]?.total ?? 0) === 0) {
    for (const item of BUILTIN_MEDIA_SEEDS) {
      await db.execute({
        sql: `INSERT INTO media_assets (id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, data_base64)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
        args: [
          randomUUID(),
          item.file_name,
          item.file_url,
          item.alt_text,
          item.file_type,
          item.file_size,
          item.category,
        ],
      });
    }
  }
}

async function seedInitialCatalog(db: Client): Promise<void> {
  const pkgStarter = randomUUID();
  const pkgHome = randomUUID();
  const pkgFamily = randomUUID();
  const pkgPro = randomUUID();

  const packages = [
    {
      id: pkgStarter,
      name: 'Starter Fiber 15',
      speed: 15,
      price: 550,
      description: 'Dependable daily broadband for browsing, messaging, and online study in Sitakunda.',
      features: [
        '15 Mbps dedicated fiber speed',
        'Unlimited monthly data',
        'Optical fiber to home (FTTH)',
        'Local support desk in Masajidda',
      ],
    },
    {
      id: pkgHome,
      name: 'Home Stream 25',
      speed: 25,
      price: 800,
      description: 'Smooth HD streaming, video calls, and multi-device home Wi-Fi connectivity.',
      features: [
        '25 Mbps symmetric fiber link',
        'Unlimited monthly data',
        'Low-latency BDIX & YouTube cache',
        'Free optical line health checks',
      ],
    },
    {
      id: pkgFamily,
      name: 'Family Plus 40',
      speed: 40,
      price: 1100,
      description: 'Built for busy households, remote professionals, and simultaneous 4K streaming.',
      features: [
        '40 Mbps high-throughput broadband',
        'Priority routing for Zoom & Meet',
        'Unlimited monthly usage',
        'Same-day field technician response',
      ],
    },
    {
      id: pkgPro,
      name: 'Business Pro 60',
      speed: 60,
      price: 1600,
      description: 'Consistent bandwidth for offices, shops, and institutional workspaces across Sitakunda.',
      features: [
        '60 Mbps enterprise-grade fiber',
        'Dual-route backbone redundancy',
        'Priority customer care line',
        'Optional static IP readiness',
      ],
    },
  ];

  for (const pkg of packages) {
    await db.execute({
      sql: `INSERT INTO packages (id, name, speed_mbps, monthly_price, description, features, show_on_home, status)
            VALUES (?, ?, ?, ?, ?, ?, 1, 'active')`,
      args: [pkg.id, pkg.name, pkg.speed, pkg.price, pkg.description, JSON.stringify(pkg.features)],
    });
  }

  const today = new Date();
  const startStr = new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10);
  const expiryStr1 = new Date(today.getTime() + 45 * 86400000).toISOString().slice(0, 10);
  const expiryStr2 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  await db.execute({
    sql: `INSERT INTO offers (id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, show_on_home, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
    args: [
      randomUUID(),
      'Masajidda New Fiber Welcome Discount',
      'Save BDT 150 on your first month when subscribing to Home Stream 25 in Gulahammad and Masajidda.',
      'fixed',
      150,
      pkgHome,
      startStr,
      expiryStr1,
    ],
  });

  await db.execute({
    sql: `INSERT INTO offers (id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, show_on_home, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
    args: [
      randomUUID(),
      'Family Upgrade 15% Promotional Rate',
      'Enjoy 15% monthly savings on Family Plus 40 for new residential connections in Sitakunda.',
      'percentage',
      15,
      pkgFamily,
      startStr,
      expiryStr2,
    ],
  });

  const sampleCustomers = [
    {
      id: randomUUID(),
      code: 'RC-1001',
      name: 'Md. Tariqul Islam',
      mobile: '01819-442110',
      email: 'tariqul.sitakunda@example.com',
      address: 'Gulahammad Road, Masajidda, Sitakunda',
      status: 'active',
      pkgId: pkgHome,
      price: 800,
    },
    {
      id: randomUUID(),
      code: 'RC-1002',
      name: 'Farhana Akter',
      mobile: '01712-883405',
      email: null,
      address: 'Bazar Lane, Masajidda, Sitakunda',
      status: 'active',
      pkgId: pkgFamily,
      price: 1100,
    },
    {
      id: randomUUID(),
      code: 'RC-1003',
      name: 'Kamrul Hasan Chowdhury',
      mobile: '01911-562019',
      email: 'kamrul.enterprise@example.com',
      address: 'Sitakunda Sadar Highway, Chattogram',
      status: 'active',
      pkgId: pkgPro,
      price: 1600,
    },
    {
      id: randomUUID(),
      code: 'RC-1004',
      name: 'Nusrat Jahan',
      mobile: '01675-204911',
      email: null,
      address: 'North Gulahammad, Sitakunda',
      status: 'active',
      pkgId: pkgStarter,
      price: 550,
    },
  ];

  for (const c of sampleCustomers) {
    await db.execute({
      sql: `INSERT INTO customers (id, customer_code, name, mobile, email, address, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [c.id, c.code, c.name, c.mobile, c.email, c.address, c.status],
    });

    await db.execute({
      sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, status)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
      args: [randomUUID(), c.id, c.pkgId, c.price],
    });
  }
}
