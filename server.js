// server.ts
import "dotenv/config";
import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import cookieParser from "cookie-parser";
import express from "express";

// src/server/miniRouter.ts
var MiniRouter = class {
  constructor() {
    this.middlewares = [];
    this.routes = [];
  }
  use(handler) {
    this.middlewares.push(handler);
    return this;
  }
  add(method, pattern, handler) {
    const clean = pattern === "/" ? "" : pattern.replace(/^\/+|\/+$/g, "");
    const segments = clean ? clean.split("/") : [];
    this.routes.push({ method: method.toUpperCase(), pattern, segments, handler });
    return this;
  }
  get(pattern, handler) {
    return this.add("GET", pattern, handler);
  }
  post(pattern, handler) {
    return this.add("POST", pattern, handler);
  }
  put(pattern, handler) {
    return this.add("PUT", pattern, handler);
  }
  patch(pattern, handler) {
    return this.add("PATCH", pattern, handler);
  }
  delete(pattern, handler) {
    return this.add("DELETE", pattern, handler);
  }
  match(method, subPath) {
    const upper = method.toUpperCase();
    const clean = subPath === "/" ? "" : subPath.replace(/^\/+|\/+$/g, "");
    const parts = clean ? clean.split("/") : [];
    for (const route of this.routes) {
      if (route.method !== upper) continue;
      if (route.segments.length !== parts.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        const val = parts[i];
        if (seg.startsWith(":")) {
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
};
function Router() {
  return new MiniRouter();
}
function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  const pairs = header.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
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
function serializeSetCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (typeof options.maxAge === "number") {
    const seconds = Math.max(0, Math.floor(options.maxAge / 1e3));
    parts.push(`Max-Age=${seconds}`);
    if (seconds === 0) {
      parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    }
  }
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite === "none") parts.push("SameSite=None");
  else if (options.sameSite === "strict") parts.push("SameSite=Strict");
  else if (options.sameSite === "lax") parts.push("SameSite=Lax");
  if (options.partitioned) parts.push("Partitioned");
  return parts.join("; ");
}
function mountMiniRouterOnExpress(app, prefix, router) {
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  app.use(normalizedPrefix, async (req, res, next) => {
    const subPath = req.path || "/";
    const matched = router.match(req.method, subPath);
    if (!matched) {
      next();
      return;
    }
    const query = {};
    for (const [k, v] of Object.entries(req.query || {})) {
      if (typeof v === "string") query[k] = v;
      else if (Array.isArray(v) && typeof v[0] === "string") query[k] = v[0];
    }
    const miniReq = {
      method: req.method,
      path: subPath,
      params: matched.params,
      query,
      body: req.body,
      cookies: req.cookies || {},
      secure: req.secure,
      get(name) {
        return req.get(name);
      }
    };
    const miniRes = {
      status(code) {
        res.status(code);
        return miniRes;
      },
      json(data) {
        if (!res.headersSent) res.json(data);
      },
      send(body) {
        if (!res.headersSent) {
          if (body instanceof Uint8Array && !Buffer.isBuffer(body)) {
            res.send(Buffer.from(body));
          } else {
            res.send(body);
          }
        }
      },
      setHeader(name, value) {
        res.setHeader(name, value);
      },
      cookie(name, value, options) {
        res.cookie(name, value, options || {});
      },
      clearCookie(name, options) {
        res.clearCookie(name, options || {});
      }
    };
    try {
      let idx = 0;
      const runChain = async () => {
        if (res.headersSent) return;
        if (idx < router.middlewares.length) {
          const mw = router.middlewares[idx++];
          await mw(miniReq, miniRes, runChain);
          return;
        }
        await matched.handler(miniReq, miniRes, () => {
        });
      };
      await runChain();
    } catch (err) {
      next(err);
    }
  });
}
function createFetchApiHandler(mounts) {
  const orderedMounts = [...mounts].sort((a, b) => b.prefix.length - a.prefix.length);
  return async function handleApiFetch2(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = request.headers.get("origin");
    const applySecurityAndCors = (headers) => {
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        headers.set("Vary", "Origin");
      }
    };
    if (request.method.toUpperCase() === "OPTIONS") {
      const headers = new Headers();
      applySecurityAndCors(headers);
      return new Response(null, { status: 204, headers });
    }
    if (pathname === "/api/health" && request.method.toUpperCase() === "GET") {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }
    let targetMount = null;
    let subPath = "/";
    for (const mount of orderedMounts) {
      const cleanPrefix = mount.prefix.replace(/\/+$/, "");
      if (pathname === cleanPrefix || pathname.startsWith(`${cleanPrefix}/`)) {
        targetMount = mount;
        subPath = pathname.slice(cleanPrefix.length) || "/";
        break;
      }
    }
    if (!targetMount) {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: "API endpoint not found." }), {
        status: 404,
        headers
      });
    }
    const matched = targetMount.router.match(request.method, subPath);
    if (!matched) {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: "API endpoint not found." }), {
        status: 404,
        headers
      });
    }
    let parsedBody = void 0;
    const methodUpper = request.method.toUpperCase();
    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          parsedBody = await request.json();
        } catch {
          const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
          applySecurityAndCors(headers);
          return new Response(JSON.stringify({ error: "Invalid JSON request body." }), {
            status: 400,
            headers
          });
        }
      }
    }
    const query = {};
    url.searchParams.forEach((value, key) => {
      if (!(key in query)) query[key] = value;
    });
    const miniReq = {
      method: methodUpper,
      path: subPath,
      params: matched.params,
      query,
      body: parsedBody,
      cookies: parseCookieHeader(request.headers.get("cookie")),
      secure: url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      get(name) {
        return request.headers.get(name) ?? void 0;
      }
    };
    let statusCode = 200;
    const resHeaders = new Headers();
    const setCookies = [];
    let finalResponse = null;
    const finalize = (body, defaultContentType) => {
      if (finalResponse) return;
      if (defaultContentType && !resHeaders.has("Content-Type")) {
        resHeaders.set("Content-Type", defaultContentType);
      }
      applySecurityAndCors(resHeaders);
      for (const sc of setCookies) {
        resHeaders.append("Set-Cookie", sc);
      }
      finalResponse = new Response(body, { status: statusCode, headers: resHeaders });
    };
    const miniRes = {
      status(code) {
        statusCode = code;
        return miniRes;
      },
      json(data) {
        finalize(JSON.stringify(data), "application/json; charset=utf-8");
      },
      send(body) {
        if (body instanceof Uint8Array) {
          finalize(body, "application/octet-stream");
        } else if (typeof body === "string") {
          finalize(body, "text/plain; charset=utf-8");
        } else {
          finalize(JSON.stringify(body), "application/json; charset=utf-8");
        }
      },
      setHeader(name, value) {
        resHeaders.set(name, value);
      },
      cookie(name, value, options) {
        setCookies.push(serializeSetCookie(name, value, options));
      },
      clearCookie(name, options) {
        setCookies.push(serializeSetCookie(name, "", { ...options, maxAge: 0 }));
      }
    };
    try {
      let idx = 0;
      const runChain = async () => {
        if (finalResponse) return;
        if (idx < targetMount.router.middlewares.length) {
          const mw = targetMount.router.middlewares[idx++];
          await mw(miniReq, miniRes, runChain);
          return;
        }
        await matched.handler(miniReq, miniRes, () => {
        });
      };
      await runChain();
      if (!finalResponse) {
        finalize(JSON.stringify({ error: "Empty response from handler." }), "application/json; charset=utf-8");
      }
      return finalResponse;
    } catch (err) {
      console.error("API fetch error:", err);
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      applySecurityAndCors(headers);
      return new Response(JSON.stringify({ error: "Internal server error." }), {
        status: 500,
        headers
      });
    }
  };
}

// src/server/cryptoWeb.ts
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
var legacyScryptVerifier = null;
function registerLegacyScryptVerifier(fn) {
  legacyScryptVerifier = fn;
}
function randomUUID() {
  return globalThis.crypto.randomUUID();
}
function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}
function bytesToHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
function hexToBytes(hex) {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}
function randomHex(byteLength) {
  return bytesToHex(randomBytes(byteLength));
}
function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
function base64ToBytes(base64) {
  const normalized = base64.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(base64Url) {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - padded.length % 4) % 4;
  return base64ToBytes(padded + "=".repeat(padLen));
}
function utf8ToBase64Url(str) {
  return bytesToBase64Url(textEncoder.encode(str));
}
function base64UrlToUtf8(base64Url) {
  return textDecoder.decode(base64UrlToBytes(base64Url));
}
function timingSafeEqualBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
function timingSafeEqualStrings(a, b) {
  return timingSafeEqualBytes(textEncoder.encode(a), textEncoder.encode(b));
}
async function importHmacKey(secret) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
async function signHmacSha256(message, secret) {
  const key = await importHmacKey(secret);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}
async function verifyHmacSha256(message, signatureB64Url, secret) {
  const expected = await signHmacSha256(message, secret);
  return timingSafeEqualStrings(signatureB64Url, expected);
}
var PBKDF2_ITERATIONS = 1e5;
async function hashPasswordPortable(password) {
  const salt = randomBytes(16);
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}
async function verifyPasswordPortable(password, storedHash) {
  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const salt = hexToBytes(parts[2]);
    const expected = hexToBytes(parts[3]);
    if (!Number.isFinite(iterations) || iterations < 1e4 || !salt || !expected) {
      return false;
    }
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derived = await globalThis.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      expected.length * 8
    );
    return timingSafeEqualBytes(new Uint8Array(derived), expected);
  }
  if (legacyScryptVerifier) {
    return legacyScryptVerifier(password, storedHash);
  }
  return false;
}

// src/server/db.ts
import { createClient } from "@libsql/client";

// src/server/runtimeEnv.ts
var currentEnv = {};
function getEnv(key) {
  if (Object.prototype.hasOwnProperty.call(currentEnv, key)) {
    return currentEnv[key];
  }
  const proc = globalThis.process;
  return proc?.env?.[key];
}
function isNodeRuntime() {
  const proc = globalThis.process;
  return Boolean(proc?.versions?.node);
}

// src/server/cmsSeed.ts
var DEFAULT_SECTIONS = [
  // HOME PAGE
  {
    page_slug: "home",
    section_key: "hero",
    section_title: "Hero Banner",
    section_order: 1,
    content: {
      kicker: "Gulahammad, Masajidda, Sitakunda \xB7 Chattogram",
      heading: "Fast, Reliable Internet for Your Everyday Life.",
      description: "Stay connected with reliable internet service from Roman Communication. Enjoy seamless connectivity for your home, business, education, and entertainment.",
      primary_cta_text: "Get a New Connection",
      primary_cta_link: "#connect",
      secondary_cta_text: "View Packages",
      secondary_cta_link: "/packages",
      image_url: "/src/assets/images/hero_fiber_connectivity_1795280418498.jpg",
      image_alt: "Bright modern connected home study powered by Roman Communication broadband"
    }
  },
  {
    page_slug: "home",
    section_key: "why_choose_us",
    section_title: "Why Choose Us",
    section_order: 2,
    content: {
      heading: "Why Choose Roman Communication",
      description: "Practical broadband infrastructure built around everyday reliability in Sitakunda.",
      items: [
        {
          index: "01",
          title: "High-Speed Fiber Internet",
          description: "Consistent optical broadband bandwidth engineered for smooth HD streaming, online classes, and remote work."
        },
        {
          index: "02",
          title: "Stable Connectivity",
          description: "Clean optical distribution and monitored routing across Sitakunda reduce drop-offs during peak evening hours."
        },
        {
          index: "03",
          title: "Dedicated Local Support",
          description: "Our technicians operate directly from Gulahammad, Masajidda\u2014ensuring prompt field service whenever you need help."
        },
        {
          index: "04",
          title: "Affordable Monthly Plans",
          description: "Transparent BDT pricing with clear speed tiers and seasonal promotional offers, without unexpected surcharges."
        }
      ]
    }
  },
  {
    page_slug: "home",
    section_key: "packages_preview",
    section_title: "Internet Packages Preview",
    section_order: 3,
    content: {
      heading: "Internet Packages",
      description: "Clear monthly rates in BDT with unlimited data across every tier.",
      primary_cta_text: "See all packages",
      primary_cta_link: "/packages"
    }
  },
  {
    page_slug: "home",
    section_key: "offers_preview",
    section_title: "Special Offers Preview",
    section_order: 4,
    content: {
      heading: "Current Promotional Offers",
      description: "Limited-time savings available for eligible broadband subscriptions.",
      primary_cta_text: "View all offers",
      primary_cta_link: "/offers"
    }
  },
  {
    page_slug: "home",
    section_key: "coverage_preview",
    section_title: "Coverage Area Preview",
    section_order: 5,
    content: {
      kicker: "Service Coverage",
      heading: "Confirmed Fiber Coverage in Sitakunda, Chattogram",
      description: "Our primary optical fiber network actively serves homes, shops, and offices across Gulahammad, Masajidda, and surrounding Sitakunda neighborhoods.",
      primary_cta_text: "Check Coverage Availability",
      primary_cta_link: "/coverage",
      secondary_cta_text: "Contact Office",
      secondary_cta_link: "/contact",
      image_url: "/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg",
      image_alt: "Sitakunda Chattogram broadband service area landscape",
      items: [
        { title: "Gulahammad", description: "Confirmed active fiber coverage" },
        { title: "Masajidda", description: "Primary operations hub" },
        { title: "Sitakunda Bazar Area", description: "Residential & commercial coverage" },
        { title: "Sitakunda Sadar Road", description: "High-speed optical line coverage" }
      ]
    }
  },
  {
    page_slug: "home",
    section_key: "cta_banner",
    section_title: "Call to Action Banner",
    section_order: 6,
    content: {
      heading: "Ready for Reliable Broadband at Home or Work?",
      description: "Request a new optical fiber installation in Gulahammad, Masajidda, or Sitakunda and get connected quickly by our local technicians.",
      primary_cta_text: "Request New Connection",
      primary_cta_link: "#connect",
      secondary_cta_text: "Talk to Our Team",
      secondary_cta_link: "/contact"
    }
  },
  // ABOUT US PAGE
  {
    page_slug: "about",
    section_key: "intro",
    section_title: "Company Introduction",
    section_order: 1,
    content: {
      kicker: "About Roman Communication",
      heading: "Dependable Local Broadband Built for Sitakunda.",
      description: "Headquartered at Gulahammad, Masajidda, Sitakunda, Chattogram, Roman Communication was established to bring stable, fairly priced fiber internet to families, students, and local enterprises. Rather than overpromising distant hubs, we focus on clean optical infrastructure and responsive local care in the communities we know first-hand.",
      primary_cta_text: "Request Connection",
      primary_cta_link: "#connect",
      secondary_cta_text: "View Internet Packages",
      secondary_cta_link: "/packages",
      image_url: "/src/assets/images/about_network_noc_1795280419008.jpg",
      image_alt: "Roman Communication optical fiber distribution rack"
    }
  },
  {
    page_slug: "about",
    section_key: "mission_vision",
    section_title: "Mission, Vision & Commitment",
    section_order: 2,
    content: {
      heading: "Our Principles",
      items: [
        {
          title: "Our Mission",
          description: "Deliver uninterrupted, high-speed internet connectivity with straightforward pricing and timely technical assistance for every household and business in our service zone."
        },
        {
          title: "Our Vision",
          description: "Become Sitakunda\u2019s most trusted neighborhood broadband network, supporting digital learning, remote work, and local commerce across Chattogram."
        },
        {
          title: "Our Commitment",
          description: "Maintain disciplined line quality, proactive maintenance, and transparent customer records so subscribers always receive the bandwidth they signed up for."
        }
      ]
    }
  },
  {
    page_slug: "about",
    section_key: "why_subscribers",
    section_title: "Why Subscribers Choose Us",
    section_order: 3,
    content: {
      heading: "Why Subscribers Choose Roman Communication",
      items: [
        {
          index: "01",
          title: "Direct Local Technicians",
          description: "Our field team is stationed right in Masajidda, enabling rapid fiber splicing, router setup, and physical line inspections without multi-day delays."
        },
        {
          index: "02",
          title: "Honest Bandwidth Allocation",
          description: "Every package reflects real-world usable speeds for video conferencing, cloud backups, and family streaming\u2014backed by clean optical distribution."
        },
        {
          index: "03",
          title: "Transparent Subscription Records",
          description: "Customers receive clear package assignments, predictable monthly rates, and documented plan upgrades whenever their needs grow."
        },
        {
          index: "04",
          title: "Ready for Growing Homes & Businesses",
          description: "From single-user study plans to 60 Mbps commercial links, upgrading between plans is seamless with zero line replacement hassle."
        }
      ]
    }
  },
  // PACKAGES PAGE
  {
    page_slug: "packages",
    section_key: "header",
    section_title: "Packages Page Header",
    section_order: 1,
    content: {
      kicker: "Broadband Plans",
      heading: "Internet Packages",
      description: "All active fiber broadband plans from Roman Communication. Select a package to request installation in Gulahammad, Masajidda, or Sitakunda."
    }
  },
  // OFFERS PAGE
  {
    page_slug: "offers",
    section_key: "header",
    section_title: "Offers Page Header",
    section_order: 1,
    content: {
      kicker: "Promotions",
      heading: "Special Promotional Offers",
      description: "Verified active offers currently within their validity period. Expired or inactive promotions are automatically excluded."
    }
  },
  // COVERAGE PAGE
  {
    page_slug: "coverage",
    section_key: "header",
    section_title: "Coverage Page Header",
    section_order: 1,
    content: {
      kicker: "Network Footprint",
      heading: "Coverage Area",
      description: "Confirmed optical fiber availability in Gulahammad, Masajidda, Sitakunda, Chattogram. Only verified active service zones are listed below.",
      image_url: "/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg",
      image_alt: "Sitakunda Chattogram broadband service area"
    }
  },
  {
    page_slug: "coverage",
    section_key: "confirmed_zones",
    section_title: "Confirmed Service Locations",
    section_order: 2,
    content: {
      heading: "Confirmed Service Locations",
      description: "Main Office: Gulahammad, Masajidda, Sitakunda, Chattogram, Bangladesh.",
      items: [
        {
          title: "Gulahammad",
          description: "Full optical fiber distribution across residential lanes and nearby roads."
        },
        {
          title: "Masajidda",
          description: "Primary Roman Communication hub with rapid same-day installation support."
        },
        {
          title: "Sitakunda Bazar & Sadar Road",
          description: "Residential apartments, commercial shops, and office broadband coverage."
        },
        {
          title: "Adjacent Sitakunda Neighborhoods",
          description: "Feasibility verified within 24 hours via local field survey."
        }
      ]
    }
  },
  // CONTACT PAGE
  {
    page_slug: "contact",
    section_key: "header",
    section_title: "Contact Page Header",
    section_order: 1,
    content: {
      kicker: "Get in Touch",
      heading: "Contact Us",
      description: "Reach out to Roman Communication for new broadband installations, package upgrades, or technical assistance in Sitakunda."
    }
  }
];
var DEFAULT_SETTINGS = {
  company_name: "Roman Communication",
  company_tagline: "Internet Service Provider",
  logo_url: "/assets/aistudio/image_4c43d9bf.png",
  logo_alt: "Roman Communication Logo",
  favicon_url: "/assets/aistudio/image_4c43d9bf.png",
  phone: "To be provided (Support & Sales Desk)",
  whatsapp: "",
  email: "To be provided",
  address: "Gulahammad, Masajidda, Sitakunda, Chattogram, Bangladesh.",
  facebook_url: "",
  other_social_links: [],
  google_maps_url: "",
  header_cta_text: "Get Connection",
  footer_description: "Roman Communication is a dedicated Internet Service Provider delivering dependable fiber broadband for households, students, and local businesses in Sitakunda, Chattogram.",
  footer_copyright: "\xA9 2026 Roman Communication. All rights reserved.",
  footer_subtext: "Internet Service Provider \xB7 Sitakunda, Chattogram"
};
var DEFAULT_PAGE_SEO = {
  home: {
    seo_title: "Roman Communication | Internet Service Provider in Sitakunda, Chattogram",
    meta_description: "Fast, reliable broadband internet service from Roman Communication in Gulahammad, Masajidda, Sitakunda, Chattogram. View fiber internet packages and apply for a new connection.",
    meta_keywords: "Roman Communication, ISP in Sitakunda, Internet Service Provider in Sitakunda, Internet Connection in Masajidda, Broadband Internet in Chattogram",
    og_title: "Roman Communication | Internet Service Provider in Sitakunda, Chattogram",
    og_description: "Reliable high-speed broadband internet for homes and businesses in Gulahammad, Masajidda, Sitakunda, Chattogram.",
    og_image_url: "/src/assets/images/hero_fiber_connectivity_1795280418498.jpg",
    canonical_url: ""
  },
  about: {
    seo_title: "About Us | Roman Communication \u2013 Sitakunda Broadband ISP",
    meta_description: "Learn about Roman Communication, our fiber network infrastructure, mission, and local technical support in Gulahammad, Masajidda, Sitakunda.",
    meta_keywords: "About Roman Communication, Sitakunda ISP, Masajidda Fiber Network",
    og_title: "About Roman Communication \u2013 Local Fiber ISP in Sitakunda",
    og_description: "Dedicated local fiber internet provider serving families and businesses across Sitakunda, Chattogram.",
    og_image_url: "/src/assets/images/about_network_noc_1795280419008.jpg",
    canonical_url: ""
  },
  packages: {
    seo_title: "Internet Packages | Roman Communication \u2013 Sitakunda, Chattogram",
    meta_description: "Compare affordable monthly fiber internet packages from Roman Communication with unlimited data and reliable speed tiers in Sitakunda.",
    meta_keywords: "Sitakunda internet packages, Masajidda broadband price, Roman Communication plans",
    og_title: "Fiber Internet Packages | Roman Communication",
    og_description: "Transparent BDT monthly fiber plans for homes and businesses in Sitakunda.",
    og_image_url: "/src/assets/images/hero_fiber_connectivity_1795280418498.jpg",
    canonical_url: ""
  },
  offers: {
    seo_title: "Special Offers | Roman Communication Broadband Promotions",
    meta_description: "Explore active broadband promotional discounts and seasonal connection offers from Roman Communication in Sitakunda, Chattogram.",
    meta_keywords: "Roman Communication offers, Sitakunda broadband discount, internet promo",
    og_title: "Promotional Broadband Offers | Roman Communication",
    og_description: "Limited-time discounts on new optical fiber connections in Sitakunda.",
    og_image_url: "/src/assets/images/hero_fiber_connectivity_1795280418498.jpg",
    canonical_url: ""
  },
  coverage: {
    seo_title: "Coverage Area | Roman Communication \u2013 Gulahammad, Masajidda, Sitakunda",
    meta_description: "Check confirmed fiber broadband availability across Gulahammad, Masajidda, Sitakunda Bazar, and Sadar Road in Chattogram.",
    meta_keywords: "Internet connection in Masajidda, Gulahammad broadband coverage, Sitakunda ISP area",
    og_title: "Fiber Coverage Area | Roman Communication",
    og_description: "Verify optical broadband service availability at your Sitakunda address.",
    og_image_url: "/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg",
    canonical_url: ""
  },
  contact: {
    seo_title: "Contact Us | Roman Communication \u2013 Sitakunda, Chattogram",
    meta_description: "Contact Roman Communication at Gulahammad, Masajidda, Sitakunda for new broadband connections, upgrades, or technical support.",
    meta_keywords: "Contact Roman Communication, Sitakunda ISP support, Masajidda office",
    og_title: "Contact Roman Communication",
    og_description: "Get in touch with our local broadband support and installation team.",
    og_image_url: "/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg",
    canonical_url: ""
  }
};
var BUILTIN_MEDIA_SEEDS = [
  {
    file_name: "roman-communication-logo.png",
    file_url: "/assets/aistudio/image_4c43d9bf.png",
    alt_text: "Roman Communication Logo",
    file_type: "image/png",
    file_size: 48200,
    category: "logo"
  },
  {
    file_name: "hero-fiber-connectivity.jpg",
    file_url: "/src/assets/images/hero_fiber_connectivity_1795280418498.jpg",
    alt_text: "Bright modern connected home study powered by Roman Communication broadband",
    file_type: "image/jpeg",
    file_size: 245e3,
    category: "hero"
  },
  {
    file_name: "about-network-rack.jpg",
    file_url: "/src/assets/images/about_network_noc_1795280419008.jpg",
    alt_text: "Roman Communication optical fiber distribution rack",
    file_type: "image/jpeg",
    file_size: 21e4,
    category: "about"
  },
  {
    file_name: "coverage-sitakunda-landscape.jpg",
    file_url: "/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg",
    alt_text: "Sitakunda Chattogram broadband service area landscape",
    file_type: "image/jpeg",
    file_size: 23e4,
    category: "banner"
  }
];

// src/server/db.ts
var DatabaseConfigError = class extends Error {
  constructor(message) {
    super(message);
    this.status = 503;
    this.name = "DatabaseConfigError";
  }
};
var client = null;
var clientCacheKey = "";
var initializedPromise = null;
function getDb() {
  const configuredUrl = getEnv("TURSO_DATABASE_URL")?.trim() || "";
  const authToken = getEnv("TURSO_AUTH_TOKEN")?.trim() || void 0;
  if (!configuredUrl && !isNodeRuntime()) {
    throw new DatabaseConfigError(
      "Database is not configured. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Cloudflare Pages Environment Variables."
    );
  }
  const url = configuredUrl || "file:roman_communication.db";
  const nextKey = `${url}|${authToken || ""}`;
  if (!client || clientCacheKey !== nextKey) {
    client = createClient(authToken ? { url, authToken } : { url });
    clientCacheKey = nextKey;
    initializedPromise = null;
  }
  return client;
}
async function ensureDatabase() {
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
async function ensureColumn(db, table, column, definition) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((r) => String(r.name) === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
async function initSchemaAndSeed(db) {
  await db.execute("PRAGMA foreign_keys = ON");
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
  await ensureColumn(db, "packages", "image_url", "TEXT");
  await ensureColumn(db, "packages", "show_on_home", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "offers", "image_url", "TEXT");
  await ensureColumn(db, "offers", "show_on_home", "INTEGER NOT NULL DEFAULT 1");
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
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active
    ON subscriptions(customer_id)
    WHERE status = 'active'
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_offers_package ON offers(package_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON subscriptions(package_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_page_contents_slug ON page_contents(page_slug)");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)");
  const countRes = await db.execute("SELECT COUNT(*) as total FROM packages");
  const totalPackages = Number(countRes.rows[0]?.total ?? 0);
  if (totalPackages === 0) {
    await seedInitialCatalog(db);
  }
  await seedCmsDefaults(db);
}
async function seedCmsDefaults(db) {
  const existingSections = await db.execute("SELECT COUNT(*) as total FROM page_contents");
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
          s.section_order
        ]
      });
    }
  }
  const settingsKeys = Object.entries(DEFAULT_SETTINGS);
  const settingsCount = await db.execute("SELECT COUNT(*) as total FROM website_settings");
  if (Number(settingsCount.rows[0]?.total ?? 0) < settingsKeys.length) {
    for (const [key, val] of settingsKeys) {
      const serialized = typeof val === "string" ? val : JSON.stringify(val);
      await db.execute({
        sql: `INSERT OR IGNORE INTO website_settings (id, setting_key, draft_value, published_value, has_unpublished_changes)
              VALUES (?, ?, ?, ?, 0)`,
        args: [randomUUID(), key, serialized, serialized]
      });
    }
  }
  const seoSlugs = Object.keys(DEFAULT_PAGE_SEO);
  const seoCount = await db.execute("SELECT COUNT(*) as total FROM page_seo");
  if (Number(seoCount.rows[0]?.total ?? 0) < seoSlugs.length) {
    for (const slug of seoSlugs) {
      const serialized = JSON.stringify(DEFAULT_PAGE_SEO[slug]);
      await db.execute({
        sql: `INSERT OR IGNORE INTO page_seo (id, page_slug, draft_seo, published_seo, has_unpublished_changes)
              VALUES (?, ?, ?, ?, 0)`,
        args: [randomUUID(), slug, serialized, serialized]
      });
    }
  }
  const mediaCount = await db.execute("SELECT COUNT(*) as total FROM media_assets");
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
          item.category
        ]
      });
    }
  }
}
async function seedInitialCatalog(db) {
  const pkgStarter = randomUUID();
  const pkgHome = randomUUID();
  const pkgFamily = randomUUID();
  const pkgPro = randomUUID();
  const packages = [
    {
      id: pkgStarter,
      name: "Starter Fiber 15",
      speed: 15,
      price: 550,
      description: "Dependable daily broadband for browsing, messaging, and online study in Sitakunda.",
      features: [
        "15 Mbps dedicated fiber speed",
        "Unlimited monthly data",
        "Optical fiber to home (FTTH)",
        "Local support desk in Masajidda"
      ]
    },
    {
      id: pkgHome,
      name: "Home Stream 25",
      speed: 25,
      price: 800,
      description: "Smooth HD streaming, video calls, and multi-device home Wi-Fi connectivity.",
      features: [
        "25 Mbps symmetric fiber link",
        "Unlimited monthly data",
        "Low-latency BDIX & YouTube cache",
        "Free optical line health checks"
      ]
    },
    {
      id: pkgFamily,
      name: "Family Plus 40",
      speed: 40,
      price: 1100,
      description: "Built for busy households, remote professionals, and simultaneous 4K streaming.",
      features: [
        "40 Mbps high-throughput broadband",
        "Priority routing for Zoom & Meet",
        "Unlimited monthly usage",
        "Same-day field technician response"
      ]
    },
    {
      id: pkgPro,
      name: "Business Pro 60",
      speed: 60,
      price: 1600,
      description: "Consistent bandwidth for offices, shops, and institutional workspaces across Sitakunda.",
      features: [
        "60 Mbps enterprise-grade fiber",
        "Dual-route backbone redundancy",
        "Priority customer care line",
        "Optional static IP readiness"
      ]
    }
  ];
  for (const pkg of packages) {
    await db.execute({
      sql: `INSERT INTO packages (id, name, speed_mbps, monthly_price, description, features, show_on_home, status)
            VALUES (?, ?, ?, ?, ?, ?, 1, 'active')`,
      args: [pkg.id, pkg.name, pkg.speed, pkg.price, pkg.description, JSON.stringify(pkg.features)]
    });
  }
  const today = /* @__PURE__ */ new Date();
  const startStr = new Date(today.getTime() - 5 * 864e5).toISOString().slice(0, 10);
  const expiryStr1 = new Date(today.getTime() + 45 * 864e5).toISOString().slice(0, 10);
  const expiryStr2 = new Date(today.getTime() + 30 * 864e5).toISOString().slice(0, 10);
  await db.execute({
    sql: `INSERT INTO offers (id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, show_on_home, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
    args: [
      randomUUID(),
      "Masajidda New Fiber Welcome Discount",
      "Save BDT 150 on your first month when subscribing to Home Stream 25 in Gulahammad and Masajidda.",
      "fixed",
      150,
      pkgHome,
      startStr,
      expiryStr1
    ]
  });
  await db.execute({
    sql: `INSERT INTO offers (id, title, description, discount_type, discount_value, package_id, start_date, expiry_date, show_on_home, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
    args: [
      randomUUID(),
      "Family Upgrade 15% Promotional Rate",
      "Enjoy 15% monthly savings on Family Plus 40 for new residential connections in Sitakunda.",
      "percentage",
      15,
      pkgFamily,
      startStr,
      expiryStr2
    ]
  });
  const sampleCustomers = [
    {
      id: randomUUID(),
      code: "RC-1001",
      name: "Md. Tariqul Islam",
      mobile: "01819-442110",
      email: "tariqul.sitakunda@example.com",
      address: "Gulahammad Road, Masajidda, Sitakunda",
      status: "active",
      pkgId: pkgHome,
      price: 800
    },
    {
      id: randomUUID(),
      code: "RC-1002",
      name: "Farhana Akter",
      mobile: "01712-883405",
      email: null,
      address: "Bazar Lane, Masajidda, Sitakunda",
      status: "active",
      pkgId: pkgFamily,
      price: 1100
    },
    {
      id: randomUUID(),
      code: "RC-1003",
      name: "Kamrul Hasan Chowdhury",
      mobile: "01911-562019",
      email: "kamrul.enterprise@example.com",
      address: "Sitakunda Sadar Highway, Chattogram",
      status: "active",
      pkgId: pkgPro,
      price: 1600
    },
    {
      id: randomUUID(),
      code: "RC-1004",
      name: "Nusrat Jahan",
      mobile: "01675-204911",
      email: null,
      address: "North Gulahammad, Sitakunda",
      status: "active",
      pkgId: pkgStarter,
      price: 550
    }
  ];
  for (const c of sampleCustomers) {
    await db.execute({
      sql: `INSERT INTO customers (id, customer_code, name, mobile, email, address, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [c.id, c.code, c.name, c.mobile, c.email, c.address, c.status]
    });
    await db.execute({
      sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, status)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
      args: [randomUUID(), c.id, c.pkgId, c.price]
    });
  }
}

// src/server/auth.ts
var SESSION_COOKIE_NAME = "rc_admin_session";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var EPHEMERAL_SESSION_SECRET = randomHex(32);
async function getSessionSecret() {
  const configured = getEnv("SESSION_SECRET")?.trim();
  if (configured && configured.length >= 16) return configured;
  const seedMaterial = getEnv("TURSO_AUTH_TOKEN")?.trim() || getEnv("ADMIN_PASSWORD")?.trim();
  if (seedMaterial) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`rc-session-v1:${seedMaterial}`)
    );
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return EPHEMERAL_SESSION_SECRET;
}
async function hashPassword(password) {
  return hashPasswordPortable(password);
}
async function verifyPassword(password, storedHash) {
  return verifyPasswordPortable(password, storedHash);
}
async function signSessionToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS
  };
  const encoded = utf8ToBase64Url(JSON.stringify(payload));
  const secret = await getSessionSecret();
  const sig = await signHmacSha256(encoded, secret);
  return `${encoded}.${sig}`;
}
async function verifySessionToken(token) {
  if (!token) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!encoded || !sig) return null;
  const secret = await getSessionSecret();
  const validSig = await verifyHmacSha256(encoded, sig, secret);
  if (!validSig) return null;
  try {
    const parsed = JSON.parse(base64UrlToUtf8(encoded));
    if (!parsed || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.role !== "admin" && parsed.role !== "super_admin") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function isHttpsRequest(req) {
  return req.secure || req.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}
function extractSessionToken(req) {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const authHeader = req.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return void 0;
}
async function setSessionCookie(req, res, user) {
  const token = await signSessionToken(user);
  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    ...https ? { partitioned: true } : {},
    path: "/",
    maxAge: SESSION_TTL_MS
  });
  return token;
}
function clearSessionCookie(req, res) {
  const https = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: https,
    sameSite: https ? "none" : "lax",
    ...https ? { partitioned: true } : {},
    path: "/"
  });
}
function verifyCsrfProtection(req) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }
  const requestedWith = req.get("x-requested-with");
  if (requestedWith === "XMLHttpRequest") {
    return true;
  }
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host") || req.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}
async function requireAdmin(req, res, next) {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: "Cross-site request blocked." });
    return;
  }
  const rawToken = extractSessionToken(req);
  const payload = await verifySessionToken(rawToken);
  if (!payload) {
    res.status(401).json({ error: "Administrator authentication required." });
    return;
  }
  const envEmail = getEnv("ADMIN_EMAIL")?.trim().toLowerCase();
  const envPass = getEnv("ADMIN_PASSWORD")?.trim();
  if (envEmail && envPass && payload.id === "env-admin" && payload.email.toLowerCase() === envEmail) {
    req.admin = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    };
    await next();
    return;
  }
  try {
    const db = await ensureDatabase();
    const resDb = await db.execute({
      sql: "SELECT id, name, email, role FROM admins WHERE id = ? LIMIT 1",
      args: [payload.id]
    });
    const row = resDb.rows[0];
    if (!row || row.role !== "admin" && row.role !== "super_admin") {
      res.status(401).json({ error: "Administrator session is invalid or revoked." });
      return;
    }
    req.admin = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: row.role
    };
    await next();
  } catch (err) {
    if (err instanceof DatabaseConfigError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Failed to verify administrator session." });
  }
}

// src/server/validations.ts
import { z } from "zod";
var safeUrlOrPathSchema = z.string().trim().max(500).refine(
  (val) => {
    if (!val) return true;
    if (val.startsWith("/") || val.startsWith("#")) return !val.startsWith("//");
    try {
      const parsed = new URL(val);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "URL must be a relative path (/...) or an http(s):// link." }
);
var cmsPageSlugSchema = z.enum([
  "home",
  "about",
  "packages",
  "offers",
  "coverage",
  "contact"
]);
var adminSetupSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(80),
  email: z.string().trim().email("Valid email address is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(128)
});
var adminLoginSchema = z.object({
  email: z.string().trim().email("Valid email address is required"),
  password: z.string().min(1, "Password is required").max(128)
});
var packageSchema = z.object({
  name: z.string().trim().min(2, "Package name is required").max(80),
  speed_mbps: z.coerce.number().int("Speed must be a whole number").min(1, "Speed must be at least 1 Mbps").max(1e4),
  monthly_price: z.coerce.number().positive("Monthly price must be greater than 0").max(5e5),
  description: z.string().trim().min(5, "Description is required").max(500),
  features: z.array(z.string().trim().min(1).max(120)).min(1, "Add at least one package feature").max(12),
  image_url: safeUrlOrPathSchema.optional().nullable(),
  show_on_home: z.boolean().optional().default(true),
  status: z.enum(["active", "inactive"])
});
var offerSchema = z.object({
  title: z.string().trim().min(3, "Offer title is required").max(100),
  description: z.string().trim().min(5, "Offer description is required").max(500),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.coerce.number().positive("Discount value must be greater than 0"),
  package_id: z.string().trim().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD"),
  image_url: safeUrlOrPathSchema.optional().nullable(),
  show_on_home: z.boolean().optional().default(true),
  status: z.enum(["active", "inactive"])
}).refine((data) => data.expiry_date >= data.start_date, {
  message: "Expiry date must be on or after start date",
  path: ["expiry_date"]
}).refine(
  (data) => data.discount_type !== "percentage" || data.discount_value <= 100,
  {
    message: "Percentage discount cannot exceed 100%",
    path: ["discount_value"]
  }
);
var customerCreateSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required").max(100),
  mobile: z.string().trim().min(6, "Valid mobile number is required").max(25),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")).nullable(),
  address: z.string().trim().min(3, "Address is required").max(250),
  status: z.enum(["active", "inactive"]).default("active"),
  initial_package_id: z.string().trim().optional().nullable()
});
var customerUpdateSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required").max(100),
  mobile: z.string().trim().min(6, "Valid mobile number is required").max(25),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")).nullable(),
  address: z.string().trim().min(3, "Address is required").max(250),
  status: z.enum(["active", "inactive"])
});
var assignPackageSchema = z.object({
  customer_id: z.string().trim().min(1, "Customer is required"),
  package_id: z.string().trim().min(1, "Package is required"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD").optional().or(z.literal("")).nullable()
});
var inquiryCreateSchema = z.object({
  type: z.enum(["connection", "coverage", "contact"]),
  full_name: z.string().trim().min(2, "Full name is required").max(100),
  mobile: z.string().trim().min(6, "Valid mobile number is required").max(25),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")).nullable(),
  address: z.string().trim().min(3, "Address is required").max(250),
  package_id: z.string().trim().optional().nullable(),
  inquiry_type: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(1e3).optional().nullable()
});
var inquiryStatusSchema = z.object({
  status: z.enum(["new", "contacted", "resolved"])
});
var pageSectionItemSchema = z.object({
  index: z.string().trim().max(16).optional(),
  title: z.string().trim().min(1, "Item title is required").max(120),
  description: z.string().trim().max(500).default("")
});
var pageSectionContentSchema = z.object({
  kicker: z.string().trim().max(120).optional(),
  heading: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2e3).optional(),
  secondary_description: z.string().trim().max(2e3).optional(),
  primary_cta_text: z.string().trim().max(60).optional(),
  primary_cta_link: safeUrlOrPathSchema.optional(),
  secondary_cta_text: z.string().trim().max(60).optional(),
  secondary_cta_link: safeUrlOrPathSchema.optional(),
  image_url: safeUrlOrPathSchema.optional(),
  image_alt: z.string().trim().max(200).optional(),
  items: z.array(pageSectionItemSchema).max(16).optional()
});
var cmsSectionUpdateSchema = z.object({
  section_title: z.string().trim().min(2, "Section title is required").max(100),
  draft_content: pageSectionContentSchema,
  draft_visible: z.boolean()
});
var cmsSectionCreateSchema = z.object({
  page_slug: cmsPageSlugSchema,
  section_title: z.string().trim().min(2, "Section title is required").max(100),
  draft_content: pageSectionContentSchema,
  draft_visible: z.boolean().default(true)
});
var cmsReorderSchema = z.object({
  page_slug: cmsPageSlugSchema,
  ordered_ids: z.array(z.string().trim().min(1)).min(1)
});
var websiteSettingsSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(100),
  company_tagline: z.string().trim().max(120).default(""),
  logo_url: safeUrlOrPathSchema,
  logo_alt: z.string().trim().max(150).default("Company Logo"),
  favicon_url: safeUrlOrPathSchema.default(""),
  phone: z.string().trim().max(120).default(""),
  whatsapp: z.string().trim().max(60).default(""),
  email: z.string().trim().max(120).default(""),
  address: z.string().trim().max(250).default(""),
  facebook_url: safeUrlOrPathSchema.default(""),
  other_social_links: z.array(
    z.object({
      label: z.string().trim().min(1).max(50),
      url: safeUrlOrPathSchema
    })
  ).max(8).default([]),
  google_maps_url: safeUrlOrPathSchema.default(""),
  header_cta_text: z.string().trim().min(1).max(40),
  footer_description: z.string().trim().max(500).default(""),
  footer_copyright: z.string().trim().max(200).default(""),
  footer_subtext: z.string().trim().max(200).default("")
});
var pageSeoUpdateSchema = z.object({
  seo_title: z.string().trim().min(2, "SEO Title is required").max(160),
  meta_description: z.string().trim().max(320).default(""),
  meta_keywords: z.string().trim().max(500).default(""),
  og_title: z.string().trim().max(160).default(""),
  og_description: z.string().trim().max(320).default(""),
  og_image_url: safeUrlOrPathSchema.default(""),
  canonical_url: safeUrlOrPathSchema.default("")
});
var mediaUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(150),
  file_type: z.enum([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/x-icon",
    "image/vnd.microsoft.icon"
  ]),
  alt_text: z.string().trim().max(200).default(""),
  category: z.enum(["hero", "banner", "about", "offer", "package", "logo", "seo", "general"]).default("general"),
  data_base64: z.string().min(8).max(32e5)
});
var mediaAltUpdateSchema = z.object({
  alt_text: z.string().trim().max(200),
  category: z.enum(["hero", "banner", "about", "offer", "package", "logo", "seo", "general"]).optional()
});

// src/server/routes/adminAuthRoutes.ts
var adminAuthRoutes = Router();
function getEnvCredentials() {
  const envEmail = getEnv("ADMIN_EMAIL")?.trim().toLowerCase() || "";
  const envPass = getEnv("ADMIN_PASSWORD")?.trim() || "";
  return {
    envEmail,
    envPass,
    hasEnvCredentials: Boolean(envEmail && envPass)
  };
}
adminAuthRoutes.get("/status", async (req, res) => {
  try {
    const { envEmail, hasEnvCredentials } = getEnvCredentials();
    const authMode = hasEnvCredentials ? "env" : "db";
    const rawToken = extractSessionToken(req);
    const payload = await verifySessionToken(rawToken);
    if (payload && hasEnvCredentials && payload.id === "env-admin" && payload.email.toLowerCase() === envEmail) {
      res.json({
        authenticated: true,
        needsSetup: false,
        authMode,
        admin: {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role
        }
      });
      return;
    }
    const db = await ensureDatabase();
    const countRes = await db.execute("SELECT COUNT(*) as total FROM admins");
    const adminCount = Number(countRes.rows[0]?.total ?? 0);
    const needsSetup = adminCount === 0 && !hasEnvCredentials;
    if (!payload) {
      res.json({ authenticated: false, needsSetup, authMode, admin: null });
      return;
    }
    const adminRes = await db.execute({
      sql: "SELECT id, name, email, role FROM admins WHERE id = ? LIMIT 1",
      args: [payload.id]
    });
    const row = adminRes.rows[0];
    if (!row) {
      res.json({ authenticated: false, needsSetup, authMode, admin: null });
      return;
    }
    res.json({
      authenticated: true,
      needsSetup: false,
      authMode,
      admin: {
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        role: String(row.role)
      }
    });
  } catch (err) {
    if (err instanceof DatabaseConfigError) {
      const { hasEnvCredentials } = getEnvCredentials();
      if (hasEnvCredentials) {
        res.json({
          authenticated: false,
          needsSetup: false,
          authMode: "env",
          admin: null
        });
        return;
      }
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Auth status error:", err);
    res.status(500).json({ error: "Failed to inspect authentication state." });
  }
});
adminAuthRoutes.post("/setup", async (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: "Cross-site request blocked." });
    return;
  }
  try {
    const { hasEnvCredentials } = getEnvCredentials();
    if (hasEnvCredentials) {
      res.status(403).json({ error: "Initial setup is disabled because environment credentials are configured." });
      return;
    }
    const parsed = adminSetupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid setup fields." });
      return;
    }
    const db = await ensureDatabase();
    const passwordHash = await hashPassword(parsed.data.password);
    const adminId = randomUUID();
    const emailNormalized = parsed.data.email.toLowerCase();
    const tx = await db.transaction("write");
    try {
      const countRes = await tx.execute("SELECT COUNT(*) as total FROM admins");
      const existing = Number(countRes.rows[0]?.total ?? 0);
      if (existing > 0) {
        await tx.rollback();
        res.status(403).json({ error: "Administrator account has already been claimed." });
        return;
      }
      await tx.execute({
        sql: `INSERT INTO admins (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'super_admin')`,
        args: [adminId, parsed.data.name, emailNormalized, passwordHash]
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    const admin = {
      id: adminId,
      name: parsed.data.name,
      email: emailNormalized,
      role: "super_admin"
    };
    const token = await setSessionCookie(req, res, admin);
    res.status(201).json({ admin, token });
  } catch (err) {
    if (err instanceof DatabaseConfigError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Admin setup error:", err);
    res.status(500).json({ error: "Failed to initialize administrator account." });
  }
});
adminAuthRoutes.post("/login", async (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: "Cross-site request blocked." });
    return;
  }
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Email and password are required." });
      return;
    }
    const emailNormalized = parsed.data.email.toLowerCase();
    const { envEmail, envPass, hasEnvCredentials } = getEnvCredentials();
    if (hasEnvCredentials && timingSafeEqualStrings(emailNormalized, envEmail) && timingSafeEqualStrings(parsed.data.password, envPass)) {
      const admin2 = {
        id: "env-admin",
        name: "System Administrator",
        email: envEmail,
        role: "super_admin"
      };
      const token2 = await setSessionCookie(req, res, admin2);
      res.json({ admin: admin2, token: token2 });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "SELECT id, name, email, password_hash, role FROM admins WHERE lower(email) = ? LIMIT 1",
      args: [emailNormalized]
    });
    const row = result.rows[0];
    if (!row) {
      res.status(401).json({ error: "Invalid email address or password." });
      return;
    }
    const valid = await verifyPassword(parsed.data.password, String(row.password_hash));
    if (!valid) {
      res.status(401).json({ error: "Invalid email address or password." });
      return;
    }
    const admin = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role)
    };
    const token = await setSessionCookie(req, res, admin);
    res.json({ admin, token });
  } catch (err) {
    if (err instanceof DatabaseConfigError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Unable to authenticate administrator." });
  }
});
adminAuthRoutes.post("/logout", (req, res) => {
  if (!verifyCsrfProtection(req)) {
    res.status(403).json({ error: "Cross-site request blocked." });
    return;
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

// src/server/cmsService.ts
var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
function verifyImageMagicBytes(buf, mimeType) {
  if (buf.length < 4 || buf.length > MAX_IMAGE_BYTES) return false;
  switch (mimeType) {
    case "image/png":
      return buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71;
    case "image/jpeg":
      return buf[0] === 255 && buf[1] === 216 && buf[2] === 255;
    case "image/gif":
      return buf[0] === 71 && buf[1] === 73 && buf[2] === 70 && buf[3] === 56;
    case "image/webp":
      return buf.length >= 12 && buf[0] === 82 && // R
      buf[1] === 73 && // I
      buf[2] === 70 && // F
      buf[3] === 70 && // F
      buf[8] === 87 && // W
      buf[9] === 69 && // E
      buf[10] === 66 && // B
      buf[11] === 80;
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return buf[0] === 0 && buf[1] === 0 && (buf[2] === 1 || buf[2] === 2) && buf[3] === 0;
    default:
      return false;
  }
}
function sanitizeFileName(raw) {
  const cleaned = raw.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  return cleaned || `image-${Date.now()}.png`;
}
async function recordAuditLog(admin, action, entityType, entityId, summary) {
  if (!admin) return;
  try {
    const db = await ensureDatabase();
    await db.execute({
      sql: `INSERT INTO audit_logs (id, admin_id, admin_email, action, entity_type, entity_id, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [randomUUID(), admin.id, admin.email, action, entityType, entityId, summary]
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
function parseJsonSafe(raw, fallback) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function buildSettingsMap(rows, mode) {
  const result = { ...DEFAULT_SETTINGS };
  const col = mode === "draft" ? "draft_value" : "published_value";
  for (const row of rows) {
    const key = String(row.setting_key);
    const val = String(row[col] ?? "");
    if (key === "other_social_links") {
      result.other_social_links = parseJsonSafe(val, []);
    } else if (key in result) {
      result[key] = val;
    }
  }
  return result;
}
async function getPublicSitePayload(mode) {
  const db = await ensureDatabase();
  const [secRes, setRes, seoRes] = await Promise.all([
    db.execute(
      mode === "draft" ? `SELECT id, page_slug, section_key, section_title, draft_content, draft_order, is_custom
           FROM page_contents
           WHERE deleted_in_draft = 0 AND draft_visible = 1
           ORDER BY page_slug ASC, draft_order ASC` : `SELECT id, page_slug, section_key, section_title, published_content, published_order, is_custom
           FROM page_contents
           WHERE published_content != '' AND published_visible = 1
           ORDER BY page_slug ASC, published_order ASC`
    ),
    db.execute("SELECT setting_key, draft_value, published_value FROM website_settings"),
    db.execute("SELECT page_slug, draft_seo, published_seo FROM page_seo")
  ]);
  const sections = secRes.rows.map((r) => {
    const contentRaw = mode === "draft" ? r.draft_content : r.published_content;
    const orderRaw = mode === "draft" ? r.draft_order : r.published_order;
    return {
      id: String(r.id),
      page_slug: String(r.page_slug),
      section_key: String(r.section_key),
      section_title: String(r.section_title),
      content: parseJsonSafe(contentRaw, {}),
      section_order: Number(orderRaw ?? 0),
      is_custom: Number(r.is_custom ?? 0) === 1
    };
  });
  const settings = buildSettingsMap(
    setRes.rows,
    mode
  );
  const seo = {
    home: { ...DEFAULT_PAGE_SEO.home },
    about: { ...DEFAULT_PAGE_SEO.about },
    packages: { ...DEFAULT_PAGE_SEO.packages },
    offers: { ...DEFAULT_PAGE_SEO.offers },
    coverage: { ...DEFAULT_PAGE_SEO.coverage },
    contact: { ...DEFAULT_PAGE_SEO.contact }
  };
  for (const r of seoRes.rows) {
    const slug = String(r.page_slug);
    if (slug in seo) {
      const raw = mode === "draft" ? r.draft_seo : r.published_seo;
      seo[slug] = { ...seo[slug], ...parseJsonSafe(raw, {}) };
    }
  }
  return {
    isPreview: mode === "draft",
    settings,
    sections,
    seo
  };
}
async function getCmsWorkspacePayload() {
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
      "SELECT setting_key, draft_value, published_value, has_unpublished_changes FROM website_settings"
    ),
    db.execute(
      "SELECT id, page_slug, draft_seo, published_seo, has_unpublished_changes, updated_at FROM page_seo ORDER BY page_slug ASC"
    ),
    db.execute(
      "SELECT id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, uploaded_at FROM media_assets ORDER BY is_builtin ASC, uploaded_at DESC"
    )
  ]);
  const sections = secRes.rows.map((r) => ({
    id: String(r.id),
    page_slug: String(r.page_slug),
    section_key: String(r.section_key),
    section_title: String(r.section_title),
    draft_content: parseJsonSafe(r.draft_content, {}),
    published_content: r.published_content ? parseJsonSafe(r.published_content, null) : null,
    draft_order: Number(r.draft_order ?? 0),
    published_order: Number(r.published_order ?? 0),
    draft_visible: Number(r.draft_visible ?? 1) === 1,
    published_visible: Number(r.published_visible ?? 1) === 1,
    has_unpublished_changes: Number(r.has_unpublished_changes ?? 0) === 1,
    is_custom: Number(r.is_custom ?? 0) === 1,
    deleted_in_draft: Number(r.deleted_in_draft ?? 0) === 1,
    updated_at: String(r.updated_at)
  }));
  const settingsRows = setRes.rows;
  const draftSettings = buildSettingsMap(settingsRows, "draft");
  const publishedSettings = buildSettingsMap(settingsRows, "published");
  const settingsHasUnpublished = settingsRows.some(
    (r) => Number(r.has_unpublished_changes ?? 0) === 1
  );
  const seoRecords = seoRes.rows.map((r) => {
    const slug = String(r.page_slug);
    return {
      id: String(r.id),
      page_slug: slug,
      draft_seo: { ...DEFAULT_PAGE_SEO[slug], ...parseJsonSafe(r.draft_seo, {}) },
      published_seo: {
        ...DEFAULT_PAGE_SEO[slug],
        ...parseJsonSafe(r.published_seo, {})
      },
      has_unpublished_changes: Number(r.has_unpublished_changes ?? 0) === 1,
      updated_at: String(r.updated_at)
    };
  });
  const media = mediaRes.rows.map((r) => ({
    id: String(r.id),
    file_name: String(r.file_name),
    file_url: String(r.file_url),
    alt_text: String(r.alt_text ?? ""),
    file_type: String(r.file_type),
    file_size: Number(r.file_size ?? 0),
    category: String(r.category ?? "general"),
    is_builtin: Number(r.is_builtin ?? 0) === 1,
    uploaded_at: String(r.uploaded_at)
  }));
  const unpublishedCount = sections.filter((s) => s.has_unpublished_changes).length + (settingsHasUnpublished ? 1 : 0) + seoRecords.filter((s) => s.has_unpublished_changes).length;
  return {
    sections,
    draftSettings,
    publishedSettings,
    settingsHasUnpublished,
    seoRecords,
    media,
    unpublishedCount
  };
}

// src/server/routes/adminRoutes.ts
var adminRoutes = Router();
adminRoutes.use(requireAdmin);
function parseFeatures(raw) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
adminRoutes.get("/overview", async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const [
      custCounts,
      pkgCounts,
      offerCounts,
      inquiryCounts,
      recentCustRes,
      recentPkgRes,
      recentSubRes
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
      `)
    ]);
    const overview = {
      stats: {
        totalCustomers: Number(custCounts.rows[0]?.total ?? 0),
        activeCustomers: Number(custCounts.rows[0]?.active_count ?? 0),
        inactiveCustomers: Number(custCounts.rows[0]?.inactive_count ?? 0),
        totalPackages: Number(pkgCounts.rows[0]?.total ?? 0),
        activePackages: Number(pkgCounts.rows[0]?.active_count ?? 0),
        activeOffers: Number(offerCounts.rows[0]?.active_count ?? 0),
        newInquiries: Number(inquiryCounts.rows[0]?.new_count ?? 0)
      },
      recentCustomers: recentCustRes.rows.map((r) => ({
        id: String(r.id),
        customer_code: String(r.customer_code),
        name: String(r.name),
        mobile: String(r.mobile),
        email: r.email ? String(r.email) : null,
        address: String(r.address),
        status: String(r.status),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        active_subscription: r.sub_id ? {
          id: String(r.sub_id),
          package_id: String(r.sub_package_id),
          package_name: String(r.pkg_name),
          speed_mbps: Number(r.pkg_speed),
          monthly_price: Number(r.sub_price),
          start_date: String(r.sub_start),
          end_date: r.sub_end ? String(r.sub_end) : null,
          status: String(r.sub_status)
        } : null
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
        status: String(r.status),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at)
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
        status: String(r.status),
        created_at: String(r.created_at)
      }))
    };
    res.json(overview);
  } catch (err) {
    console.error("Overview error:", err);
    res.status(500).json({ error: "Unable to load dashboard overview." });
  }
});
adminRoutes.get("/packages", async (_req, res) => {
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
    const packages = result.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      speed_mbps: Number(r.speed_mbps),
      monthly_price: Number(r.monthly_price),
      description: String(r.description),
      features: parseFeatures(r.features),
      image_url: r.image_url ? String(r.image_url) : null,
      show_on_home: Number(r.show_on_home ?? 1) === 1,
      status: String(r.status),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      active_subscriber_count: Number(r.active_subscriber_count ?? 0)
    }));
    res.json({ packages });
  } catch (err) {
    console.error("Admin packages list error:", err);
    res.status(500).json({ error: "Unable to load packages." });
  }
});
adminRoutes.post("/packages", async (req, res) => {
  try {
    const parsed = packageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid package fields." });
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
        d.status
      ]
    });
    await recordAuditLog(req.admin, "PACKAGE_CREATED", "package", id, `Created package "${d.name}"`);
    res.status(201).json({ id, message: "Internet package created." });
  } catch (err) {
    console.error("Create package error:", err);
    res.status(500).json({ error: "Unable to create package." });
  }
});
adminRoutes.put("/packages/:id", async (req, res) => {
  try {
    const parsed = packageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid package fields." });
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
        req.params.id
      ]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Package not found." });
      return;
    }
    await recordAuditLog(req.admin, "PACKAGE_UPDATED", "package", req.params.id, `Updated package "${d.name}"`);
    res.json({ message: "Package updated successfully." });
  } catch (err) {
    console.error("Update package error:", err);
    res.status(500).json({ error: "Unable to update package." });
  }
});
adminRoutes.patch("/packages/:id/status", async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== "active" && status !== "inactive") {
      res.status(400).json({ error: "Status must be active or inactive." });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'deleted'`,
      args: [status, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Package not found." });
      return;
    }
    res.json({ message: `Package marked as ${status}.` });
  } catch (err) {
    console.error("Toggle package status error:", err);
    res.status(500).json({ error: "Unable to update package status." });
  }
});
adminRoutes.delete("/packages/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const pkgId = req.params.id;
    const existingPkg = await db.execute({
      sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
      args: [pkgId]
    });
    if (existingPkg.rows.length === 0) {
      res.status(404).json({ error: "Package not found." });
      return;
    }
    const subCountRes = await db.execute({
      sql: "SELECT COUNT(*) AS total FROM subscriptions WHERE package_id = ?",
      args: [pkgId]
    });
    const subCount = Number(subCountRes.rows[0]?.total ?? 0);
    if (subCount > 0) {
      await db.execute({
        sql: "UPDATE packages SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [pkgId]
      });
      await db.execute({
        sql: "UPDATE offers SET status = 'inactive' WHERE package_id = ?",
        args: [pkgId]
      });
      res.json({
        softDeleted: true,
        message: "Package archived (soft-deleted) so existing customer subscription history remains intact."
      });
      return;
    }
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "UPDATE offers SET package_id = NULL WHERE package_id = ?",
        args: [pkgId]
      });
      await tx.execute({
        sql: "DELETE FROM packages WHERE id = ?",
        args: [pkgId]
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    res.json({ softDeleted: false, message: "Package permanently deleted." });
  } catch (err) {
    console.error("Delete package error:", err);
    res.status(500).json({ error: "Unable to delete package." });
  }
});
adminRoutes.get("/packages/:id/customers", async (req, res) => {
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
      args: [req.params.id]
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
        end_date: r.end_date ? String(r.end_date) : null
      }))
    });
  } catch (err) {
    console.error("Package subscribers error:", err);
    res.status(500).json({ error: "Unable to load package subscribers." });
  }
});
adminRoutes.get("/offers", async (_req, res) => {
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
    const offers = result.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      description: String(r.description),
      discount_type: String(r.discount_type),
      discount_value: Number(r.discount_value),
      package_id: r.package_id ? String(r.package_id) : null,
      package_name: r.package_name ? String(r.package_name) : null,
      package_speed_mbps: r.package_speed_mbps !== null && r.package_speed_mbps !== void 0 ? Number(r.package_speed_mbps) : null,
      package_monthly_price: r.package_monthly_price !== null && r.package_monthly_price !== void 0 ? Number(r.package_monthly_price) : null,
      start_date: String(r.start_date),
      expiry_date: String(r.expiry_date),
      image_url: r.image_url ? String(r.image_url) : null,
      show_on_home: Number(r.show_on_home ?? 1) === 1,
      status: String(r.status),
      created_at: String(r.created_at)
    }));
    res.json({ offers });
  } catch (err) {
    console.error("Admin offers list error:", err);
    res.status(500).json({ error: "Unable to load offers." });
  }
});
adminRoutes.post("/offers", async (req, res) => {
  try {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid offer fields." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const pkgId = d.package_id && d.package_id.length > 0 ? d.package_id : null;
    if (pkgId) {
      const pkgCheck = await db.execute({
        sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
        args: [pkgId]
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: "Selected package does not exist." });
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
        d.status
      ]
    });
    await recordAuditLog(req.admin, "OFFER_CREATED", "offer", id, `Created offer "${d.title}"`);
    res.status(201).json({ id, message: "Promotional offer created." });
  } catch (err) {
    console.error("Create offer error:", err);
    res.status(500).json({ error: "Unable to create offer." });
  }
});
adminRoutes.put("/offers/:id", async (req, res) => {
  try {
    const parsed = offerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid offer fields." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const pkgId = d.package_id && d.package_id.length > 0 ? d.package_id : null;
    if (pkgId) {
      const pkgCheck = await db.execute({
        sql: "SELECT id FROM packages WHERE id = ? AND status != 'deleted' LIMIT 1",
        args: [pkgId]
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: "Selected package does not exist." });
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
        req.params.id
      ]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Offer not found." });
      return;
    }
    await recordAuditLog(req.admin, "OFFER_UPDATED", "offer", req.params.id, `Updated offer "${d.title}"`);
    res.json({ message: "Offer updated successfully." });
  } catch (err) {
    console.error("Update offer error:", err);
    res.status(500).json({ error: "Unable to update offer." });
  }
});
adminRoutes.patch("/offers/:id/status", async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== "active" && status !== "inactive") {
      res.status(400).json({ error: "Status must be active or inactive." });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "UPDATE offers SET status = ? WHERE id = ?",
      args: [status, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Offer not found." });
      return;
    }
    res.json({ message: `Offer marked as ${status}.` });
  } catch (err) {
    console.error("Toggle offer status error:", err);
    res.status(500).json({ error: "Unable to update offer status." });
  }
});
adminRoutes.delete("/offers/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "DELETE FROM offers WHERE id = ?",
      args: [req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Offer not found." });
      return;
    }
    res.json({ message: "Offer deleted." });
  } catch (err) {
    console.error("Delete offer error:", err);
    res.status(500).json({ error: "Unable to delete offer." });
  }
});
adminRoutes.get("/customers", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const packageId = typeof req.query.packageId === "string" ? req.query.packageId.trim() : "";
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
    const offset = (page - 1) * limit;
    const conditions = [];
    const args = [];
    if (q.length > 0) {
      conditions.push("(lower(c.name) LIKE ? OR lower(c.customer_code) LIKE ? OR c.mobile LIKE ?)");
      const pattern = `%${q.toLowerCase()}%`;
      args.push(pattern, pattern, `%${q}%`);
    }
    if (status === "active" || status === "inactive") {
      conditions.push("c.status = ?");
      args.push(status);
    }
    if (packageId === "unassigned") {
      conditions.push("s.id IS NULL");
    } else if (packageId.length > 0) {
      conditions.push("s.package_id = ?");
      args.push(packageId);
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await db.execute({
      sql: `
        SELECT COUNT(*) AS total
        FROM customers c
        LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
        ${whereSql}
      `,
      args
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
      args: [...args, limit, offset]
    });
    const customers = rowsRes.rows.map((r) => ({
      id: String(r.id),
      customer_code: String(r.customer_code),
      name: String(r.name),
      mobile: String(r.mobile),
      email: r.email ? String(r.email) : null,
      address: String(r.address),
      status: String(r.status),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      active_subscription: r.sub_id ? {
        id: String(r.sub_id),
        package_id: String(r.sub_package_id),
        package_name: String(r.pkg_name),
        speed_mbps: Number(r.pkg_speed),
        monthly_price: Number(r.sub_price),
        start_date: String(r.sub_start),
        end_date: r.sub_end ? String(r.sub_end) : null,
        status: String(r.sub_status)
      } : null
    }));
    res.json({ customers, total, page, limit });
  } catch (err) {
    console.error("Admin customers list error:", err);
    res.status(500).json({ error: "Unable to load customers." });
  }
});
adminRoutes.post("/customers", async (req, res) => {
  try {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid customer fields." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const customerId = randomUUID();
    const initialPkgId = d.initial_package_id && d.initial_package_id.length > 0 ? d.initial_package_id : null;
    const tx = await db.transaction("write");
    let generatedCode = "RC-1001";
    try {
      const codesRes = await tx.execute(
        "SELECT customer_code FROM customers WHERE customer_code LIKE 'RC-%' ORDER BY LENGTH(customer_code) DESC, customer_code DESC LIMIT 1"
      );
      if (codesRes.rows.length > 0) {
        const lastCode = String(codesRes.rows[0].customer_code);
        const numericPart = Number.parseInt(lastCode.replace(/^RC-/i, ""), 10);
        if (Number.isFinite(numericPart) && numericPart >= 1e3) {
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
          d.status
        ]
      });
      if (initialPkgId) {
        const pkgRes = await tx.execute({
          sql: "SELECT id, monthly_price FROM packages WHERE id = ? AND status = 'active' LIMIT 1",
          args: [initialPkgId]
        });
        const pkgRow = pkgRes.rows[0];
        if (!pkgRow) {
          await tx.rollback();
          res.status(400).json({ error: "Selected initial package is inactive or does not exist." });
          return;
        }
        await tx.execute({
          sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, status)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
          args: [randomUUID(), customerId, initialPkgId, Number(pkgRow.monthly_price)]
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
      message: "Customer record created."
    });
  } catch (err) {
    console.error("Create customer error:", err);
    res.status(500).json({ error: "Unable to create customer record." });
  }
});
adminRoutes.put("/customers/:id", async (req, res) => {
  try {
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid customer fields." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const result = await db.execute({
      sql: `UPDATE customers
            SET name = ?, mobile = ?, email = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [d.name, d.mobile, d.email ? d.email : null, d.address, d.status, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Customer not found." });
      return;
    }
    res.json({ message: "Customer record updated." });
  } catch (err) {
    console.error("Update customer error:", err);
    res.status(500).json({ error: "Unable to update customer record." });
  }
});
adminRoutes.patch("/customers/:id/status", async (req, res) => {
  try {
    const status = req.body?.status;
    if (status !== "active" && status !== "inactive") {
      res.status(400).json({ error: "Status must be active or inactive." });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [status, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Customer not found." });
      return;
    }
    res.json({ message: `Customer marked as ${status}.` });
  } catch (err) {
    console.error("Toggle customer status error:", err);
    res.status(500).json({ error: "Unable to update customer status." });
  }
});
adminRoutes.delete("/customers/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "DELETE FROM subscriptions WHERE customer_id = ?",
        args: [req.params.id]
      });
      const delRes = await tx.execute({
        sql: "DELETE FROM customers WHERE id = ?",
        args: [req.params.id]
      });
      if (delRes.rowsAffected === 0) {
        await tx.rollback();
        res.status(404).json({ error: "Customer not found." });
        return;
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    res.json({ message: "Customer deleted." });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({ error: "Unable to delete customer." });
  }
});
adminRoutes.get("/customers/:id/subscriptions", async (req, res) => {
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
      args: [req.params.id]
    });
    const history = result.rows.map((r) => ({
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
      status: String(r.status),
      created_at: String(r.created_at)
    }));
    res.json({ history });
  } catch (err) {
    console.error("Customer history error:", err);
    res.status(500).json({ error: "Unable to load customer subscription history." });
  }
});
adminRoutes.get("/subscriptions", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const packageId = typeof req.query.packageId === "string" ? req.query.packageId.trim() : "";
    const fromDate = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const toDate = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const conditions = [];
    const args = [];
    if (q.length > 0) {
      conditions.push("(lower(c.name) LIKE ? OR lower(c.customer_code) LIKE ? OR lower(p.name) LIKE ?)");
      const pattern = `%${q.toLowerCase()}%`;
      args.push(pattern, pattern, pattern);
    }
    if (status === "active" || status === "changed" || status === "cancelled" || status === "ended") {
      conditions.push("s.status = ?");
      args.push(status);
    } else if (status === "inactive") {
      conditions.push("s.status != 'active'");
    }
    if (packageId.length > 0) {
      conditions.push("s.package_id = ?");
      args.push(packageId);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      conditions.push("date(s.start_date) >= date(?)");
      args.push(fromDate);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      conditions.push("date(s.start_date) <= date(?)");
      args.push(toDate);
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
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
      args
    });
    const subscriptions = result.rows.map((r) => ({
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
      status: String(r.status),
      created_at: String(r.created_at)
    }));
    res.json({ subscriptions });
  } catch (err) {
    console.error("Subscriptions list error:", err);
    res.status(500).json({ error: "Unable to load subscription records." });
  }
});
adminRoutes.post("/subscriptions/assign", async (req, res) => {
  try {
    const parsed = assignPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid assignment parameters." });
      return;
    }
    const db = await ensureDatabase();
    const { customer_id, package_id, end_date } = parsed.data;
    const subId = randomUUID();
    const tx = await db.transaction("write");
    try {
      const custRes = await tx.execute({
        sql: "SELECT id, name FROM customers WHERE id = ? LIMIT 1",
        args: [customer_id]
      });
      if (custRes.rows.length === 0) {
        await tx.rollback();
        res.status(404).json({ error: "Customer not found." });
        return;
      }
      const pkgRes = await tx.execute({
        sql: "SELECT id, name, monthly_price FROM packages WHERE id = ? AND status = 'active' LIMIT 1",
        args: [package_id]
      });
      const pkgRow = pkgRes.rows[0];
      if (!pkgRow) {
        await tx.rollback();
        res.status(400).json({ error: "Selected package is not active or unavailable." });
        return;
      }
      await tx.execute({
        sql: `UPDATE subscriptions
              SET status = 'changed', end_date = CURRENT_TIMESTAMP
              WHERE customer_id = ? AND status = 'active'`,
        args: [customer_id]
      });
      await tx.execute({
        sql: `INSERT INTO subscriptions (id, customer_id, package_id, monthly_price, start_date, end_date, status)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'active')`,
        args: [
          subId,
          customer_id,
          package_id,
          Number(pkgRow.monthly_price),
          end_date && end_date.length > 0 ? end_date : null
        ]
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    res.status(201).json({
      id: subId,
      message: "Package assigned to customer successfully."
    });
  } catch (err) {
    console.error("Assign package error:", err);
    res.status(500).json({ error: "Unable to assign package." });
  }
});
adminRoutes.patch("/subscriptions/:id/cancel", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE subscriptions
            SET status = 'cancelled', end_date = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'active'`,
      args: [req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Active subscription not found." });
      return;
    }
    res.json({ message: "Subscription assignment cancelled." });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    res.status(500).json({ error: "Unable to cancel subscription." });
  }
});
adminRoutes.get("/inquiries", async (_req, res) => {
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
    const inquiries = result.rows.map((r) => ({
      id: String(r.id),
      type: String(r.type),
      full_name: String(r.full_name),
      mobile: String(r.mobile),
      email: r.email ? String(r.email) : null,
      address: String(r.address),
      package_id: r.package_id ? String(r.package_id) : null,
      package_name: r.package_name ? String(r.package_name) : null,
      inquiry_type: r.inquiry_type ? String(r.inquiry_type) : null,
      message: r.message ? String(r.message) : null,
      status: String(r.status),
      created_at: String(r.created_at)
    }));
    res.json({ inquiries });
  } catch (err) {
    console.error("Load inquiries error:", err);
    res.status(500).json({ error: "Unable to load inquiries." });
  }
});
adminRoutes.patch("/inquiries/:id/status", async (req, res) => {
  try {
    const parsed = inquiryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid inquiry status." });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "UPDATE inquiries SET status = ? WHERE id = ?",
      args: [parsed.data.status, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Inquiry not found." });
      return;
    }
    res.json({ message: "Inquiry status updated." });
  } catch (err) {
    console.error("Update inquiry status error:", err);
    res.status(500).json({ error: "Unable to update inquiry status." });
  }
});

// src/server/routes/cmsAdminRoutes.ts
var cmsAdminRoutes = Router();
cmsAdminRoutes.use(requireAdmin);
cmsAdminRoutes.get("/workspace", async (_req, res) => {
  try {
    const payload = await getCmsWorkspacePayload();
    res.json(payload);
  } catch (err) {
    console.error("CMS workspace load error:", err);
    res.status(500).json({ error: "Unable to load website CMS workspace." });
  }
});
cmsAdminRoutes.get("/preview", async (_req, res) => {
  try {
    const payload = await getPublicSitePayload("draft");
    res.json(payload);
  } catch (err) {
    console.error("CMS preview error:", err);
    res.status(500).json({ error: "Unable to load draft preview." });
  }
});
cmsAdminRoutes.put("/sections/:id", async (req, res) => {
  try {
    const parsed = cmsSectionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid section payload." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const result = await db.execute({
      sql: `UPDATE page_contents
            SET section_title = ?, draft_content = ?, draft_visible = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_in_draft = 0`,
      args: [d.section_title, JSON.stringify(d.draft_content), d.draft_visible ? 1 : 0, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    await recordAuditLog(
      req.admin,
      "CMS_DRAFT_SAVED",
      "page_section",
      req.params.id,
      `Saved draft changes for section "${d.section_title}"`
    );
    res.json({ message: "Section draft saved." });
  } catch (err) {
    console.error("Update CMS section error:", err);
    res.status(500).json({ error: "Unable to save section draft." });
  }
});
cmsAdminRoutes.post("/sections", async (req, res) => {
  try {
    const parsed = cmsSectionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid section fields." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const id = randomUUID();
    const sectionKey = `custom_${Date.now()}_${id.slice(0, 4)}`;
    const maxOrderRes = await db.execute({
      sql: "SELECT COALESCE(MAX(draft_order), 0) AS max_order FROM page_contents WHERE page_slug = ? AND deleted_in_draft = 0",
      args: [d.page_slug]
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
        d.draft_visible ? 1 : 0
      ]
    });
    await recordAuditLog(
      req.admin,
      "CMS_SECTION_ADDED",
      "page_section",
      id,
      `Added draft section "${d.section_title}" to /${d.page_slug}`
    );
    res.status(201).json({ id, message: "Custom section added to draft." });
  } catch (err) {
    console.error("Create CMS section error:", err);
    res.status(500).json({ error: "Unable to add custom section." });
  }
});
cmsAdminRoutes.patch("/sections/:id/visibility", async (req, res) => {
  try {
    const visible = Boolean(req.body?.visible);
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: `UPDATE page_contents
            SET draft_visible = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_in_draft = 0`,
      args: [visible ? 1 : 0, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    await recordAuditLog(
      req.admin,
      "CMS_SECTION_VISIBILITY",
      "page_section",
      req.params.id,
      `Set section visibility to ${visible ? "visible" : "hidden"} in draft`
    );
    res.json({ message: `Section ${visible ? "shown" : "hidden"} in draft.` });
  } catch (err) {
    console.error("Toggle section visibility error:", err);
    res.status(500).json({ error: "Unable to update section visibility." });
  }
});
cmsAdminRoutes.put("/sections/reorder", async (req, res) => {
  try {
    const parsed = cmsReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid reorder request." });
      return;
    }
    const db = await ensureDatabase();
    const tx = await db.transaction("write");
    try {
      for (let idx = 0; idx < parsed.data.ordered_ids.length; idx++) {
        await tx.execute({
          sql: `UPDATE page_contents
                SET draft_order = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND page_slug = ?`,
          args: [idx + 1, parsed.data.ordered_ids[idx], parsed.data.page_slug]
        });
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    await recordAuditLog(
      req.admin,
      "CMS_SECTIONS_REORDERED",
      "page",
      parsed.data.page_slug,
      `Reordered sections on /${parsed.data.page_slug} in draft`
    );
    res.json({ message: "Section order updated in draft." });
  } catch (err) {
    console.error("Reorder sections error:", err);
    res.status(500).json({ error: "Unable to reorder sections." });
  }
});
cmsAdminRoutes.delete("/sections/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const existing = await db.execute({
      sql: "SELECT id, section_title, published_content FROM page_contents WHERE id = ? LIMIT 1",
      args: [req.params.id]
    });
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: "Section not found." });
      return;
    }
    const wasNeverPublished = !row.published_content || String(row.published_content) === "";
    if (wasNeverPublished) {
      await db.execute({ sql: "DELETE FROM page_contents WHERE id = ?", args: [req.params.id] });
    } else {
      await db.execute({
        sql: `UPDATE page_contents
              SET deleted_in_draft = 1, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [req.params.id]
      });
    }
    await recordAuditLog(
      req.admin,
      "CMS_SECTION_REMOVED",
      "page_section",
      req.params.id,
      `Removed section "${String(row.section_title)}" in draft`
    );
    res.json({ message: "Section removed from draft." });
  } catch (err) {
    console.error("Remove CMS section error:", err);
    res.status(500).json({ error: "Unable to remove section." });
  }
});
cmsAdminRoutes.put("/settings", async (req, res) => {
  try {
    const parsed = websiteSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid website settings." });
      return;
    }
    const db = await ensureDatabase();
    const d = parsed.data;
    const tx = await db.transaction("write");
    try {
      for (const [key, value] of Object.entries(d)) {
        const serialized = typeof value === "string" ? value : JSON.stringify(value);
        await tx.execute({
          sql: `INSERT INTO website_settings (id, setting_key, draft_value, published_value, has_unpublished_changes, updated_at)
                VALUES (?, ?, ?, '', 1, CURRENT_TIMESTAMP)
                ON CONFLICT(setting_key) DO UPDATE SET
                  draft_value = excluded.draft_value,
                  has_unpublished_changes = CASE WHEN website_settings.published_value != excluded.draft_value THEN 1 ELSE 0 END,
                  updated_at = CURRENT_TIMESTAMP`,
          args: [randomUUID(), key, serialized]
        });
      }
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    await recordAuditLog(
      req.admin,
      "SETTINGS_DRAFT_SAVED",
      "website_settings",
      null,
      "Updated global website settings draft"
    );
    res.json({ message: "Website settings saved as draft." });
  } catch (err) {
    console.error("Update website settings error:", err);
    res.status(500).json({ error: "Unable to save website settings." });
  }
});
cmsAdminRoutes.put("/seo/:slug", async (req, res) => {
  try {
    const slugParsed = cmsPageSlugSchema.safeParse(req.params.slug);
    if (!slugParsed.success) {
      res.status(400).json({ error: "Invalid page slug." });
      return;
    }
    const parsed = pageSeoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid SEO fields." });
      return;
    }
    const db = await ensureDatabase();
    const serialized = JSON.stringify(parsed.data);
    await db.execute({
      sql: `UPDATE page_seo
            SET draft_seo = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
            WHERE page_slug = ?`,
      args: [serialized, slugParsed.data]
    });
    await recordAuditLog(
      req.admin,
      "SEO_DRAFT_SAVED",
      "page_seo",
      slugParsed.data,
      `Saved SEO draft for /${slugParsed.data}`
    );
    res.json({ message: "Page SEO saved as draft." });
  } catch (err) {
    console.error("Update SEO error:", err);
    res.status(500).json({ error: "Unable to save page SEO." });
  }
});
cmsAdminRoutes.post("/publish", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction("write");
    try {
      await tx.execute("DELETE FROM page_contents WHERE deleted_in_draft = 1");
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
      "CMS_PUBLISHED",
      "website",
      null,
      "Published all website content, global settings, and SEO drafts to live site"
    );
    res.json({ message: "All website changes published live." });
  } catch (err) {
    console.error("CMS publish error:", err);
    res.status(500).json({ error: "Unable to publish changes." });
  }
});
cmsAdminRoutes.post("/discard", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const tx = await db.transaction("write");
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
      "CMS_DISCARDED",
      "website",
      null,
      "Cancelled all unpublished draft changes"
    );
    res.json({ message: "Unpublished draft changes discarded." });
  } catch (err) {
    console.error("CMS discard error:", err);
    res.status(500).json({ error: "Unable to discard draft changes." });
  }
});
cmsAdminRoutes.get("/media", async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(
      "SELECT id, file_name, file_url, alt_text, file_type, file_size, category, is_builtin, uploaded_at FROM media_assets ORDER BY is_builtin ASC, uploaded_at DESC"
    );
    res.json({
      media: result.rows.map((r) => ({
        id: String(r.id),
        file_name: String(r.file_name),
        file_url: String(r.file_url),
        alt_text: String(r.alt_text ?? ""),
        file_type: String(r.file_type),
        file_size: Number(r.file_size ?? 0),
        category: String(r.category ?? "general"),
        is_builtin: Number(r.is_builtin ?? 0) === 1,
        uploaded_at: String(r.uploaded_at)
      }))
    });
  } catch (err) {
    console.error("Load media error:", err);
    res.status(500).json({ error: "Unable to load media assets." });
  }
});
cmsAdminRoutes.post("/media", async (req, res) => {
  try {
    const parsed = mediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid image payload." });
      return;
    }
    const d = parsed.data;
    const rawBase64 = d.data_base64.includes(",") ? d.data_base64.split(",")[1] || "" : d.data_base64;
    let buf;
    try {
      buf = base64ToBytes(rawBase64);
    } catch {
      res.status(400).json({ error: "Invalid base64 image payload." });
      return;
    }
    if (!verifyImageMagicBytes(buf, d.file_type)) {
      res.status(400).json({
        error: "Invalid or unsupported image file. Upload a valid PNG, JPEG, WebP, GIF, or ICO under 2 MB."
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
      args: [id, safeName, fileUrl, d.alt_text, d.file_type, buf.length, d.category, bytesToBase64(buf)]
    });
    await recordAuditLog(
      req.admin,
      "MEDIA_UPLOADED",
      "media_asset",
      id,
      `Uploaded image "${safeName}" (${d.category})`
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
      uploaded_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Upload media error:", err);
    res.status(500).json({ error: "Unable to upload image." });
  }
});
cmsAdminRoutes.put("/media/:id/replace", async (req, res) => {
  try {
    const parsed = mediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid replacement image." });
      return;
    }
    const d = parsed.data;
    const rawBase64 = d.data_base64.includes(",") ? d.data_base64.split(",")[1] || "" : d.data_base64;
    let buf;
    try {
      buf = base64ToBytes(rawBase64);
    } catch {
      res.status(400).json({ error: "Invalid base64 replacement image." });
      return;
    }
    if (!verifyImageMagicBytes(buf, d.file_type)) {
      res.status(400).json({
        error: "Invalid or unsupported image file. Upload a valid PNG, JPEG, WebP, GIF, or ICO under 2 MB."
      });
      return;
    }
    const db = await ensureDatabase();
    const existingRes = await db.execute({
      sql: "SELECT id, file_name, file_url FROM media_assets WHERE id = ? LIMIT 1",
      args: [req.params.id]
    });
    const existing = existingRes.rows[0];
    if (!existing) {
      res.status(404).json({ error: "Media asset not found." });
      return;
    }
    const oldUrl = String(existing.file_url);
    const newUrl = `/api/public/media/${req.params.id}?v=${Date.now()}`;
    const safeName = sanitizeFileName(d.file_name);
    const tx = await db.transaction("write");
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
          bytesToBase64(buf),
          req.params.id
        ]
      });
      await tx.execute({
        sql: "UPDATE packages SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE image_url = ?",
        args: [newUrl, oldUrl]
      });
      await tx.execute({
        sql: "UPDATE offers SET image_url = ? WHERE image_url = ?",
        args: [newUrl, oldUrl]
      });
      await tx.execute({
        sql: `UPDATE website_settings
              SET draft_value = ?, has_unpublished_changes = 1, updated_at = CURRENT_TIMESTAMP
              WHERE draft_value = ?`,
        args: [newUrl, oldUrl]
      });
      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
    await recordAuditLog(
      req.admin,
      "MEDIA_REPLACED",
      "media_asset",
      req.params.id,
      `Replaced media asset "${safeName}"`
    );
    res.json({ message: "Image replaced successfully.", file_url: newUrl });
  } catch (err) {
    console.error("Replace media error:", err);
    res.status(500).json({ error: "Unable to replace image." });
  }
});
cmsAdminRoutes.patch("/media/:id", async (req, res) => {
  try {
    const parsed = mediaAltUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid media metadata." });
      return;
    }
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: parsed.data.category ? "UPDATE media_assets SET alt_text = ?, category = ? WHERE id = ?" : "UPDATE media_assets SET alt_text = ? WHERE id = ?",
      args: parsed.data.category ? [parsed.data.alt_text, parsed.data.category, req.params.id] : [parsed.data.alt_text, req.params.id]
    });
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: "Media asset not found." });
      return;
    }
    await recordAuditLog(
      req.admin,
      "MEDIA_UPDATED",
      "media_asset",
      req.params.id,
      `Updated alt text for media asset`
    );
    res.json({ message: "Image metadata updated." });
  } catch (err) {
    console.error("Update media metadata error:", err);
    res.status(500).json({ error: "Unable to update image metadata." });
  }
});
cmsAdminRoutes.delete("/media/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const existing = await db.execute({
      sql: "SELECT id, file_name, is_builtin FROM media_assets WHERE id = ? LIMIT 1",
      args: [req.params.id]
    });
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ error: "Media asset not found." });
      return;
    }
    if (Number(row.is_builtin ?? 0) === 1) {
      res.status(400).json({
        error: "Built-in default images cannot be deleted directly\u2014use Replace Image to swap them instead."
      });
      return;
    }
    await db.execute({ sql: "DELETE FROM media_assets WHERE id = ?", args: [req.params.id] });
    await recordAuditLog(
      req.admin,
      "MEDIA_DELETED",
      "media_asset",
      req.params.id,
      `Deleted uploaded image "${String(row.file_name)}"`
    );
    res.json({ message: "Image deleted." });
  } catch (err) {
    console.error("Delete media error:", err);
    res.status(500).json({ error: "Unable to delete image." });
  }
});
cmsAdminRoutes.get("/audit-logs", async (_req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute(
      "SELECT id, admin_id, admin_email, action, entity_type, entity_id, summary, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100"
    );
    const logs = result.rows.map((r) => ({
      id: String(r.id),
      admin_id: String(r.admin_id),
      admin_email: String(r.admin_email),
      action: String(r.action),
      entity_type: String(r.entity_type),
      entity_id: r.entity_id ? String(r.entity_id) : null,
      summary: String(r.summary),
      created_at: String(r.created_at)
    }));
    res.json({ logs });
  } catch (err) {
    console.error("Load audit logs error:", err);
    res.status(500).json({ error: "Unable to load audit logs." });
  }
});

// src/server/routes/publicRoutes.ts
var publicRoutes = Router();
function parseFeatures2(raw) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
publicRoutes.get("/site", async (req, res) => {
  try {
    let mode = "published";
    if (req.query.preview === "1") {
      const token = extractSessionToken(req);
      const payload = await verifySessionToken(token);
      if (payload && (payload.role === "admin" || payload.role === "super_admin")) {
        mode = "draft";
      }
    }
    const sitePayload = await getPublicSitePayload(mode);
    res.json(sitePayload);
  } catch (err) {
    console.error("Error loading public site content:", err);
    res.status(500).json({ error: "Unable to load website content." });
  }
});
publicRoutes.get("/media/:id", async (req, res) => {
  try {
    const db = await ensureDatabase();
    const result = await db.execute({
      sql: "SELECT file_type, data_base64 FROM media_assets WHERE id = ? LIMIT 1",
      args: [req.params.id]
    });
    const row = result.rows[0];
    if (!row || !row.data_base64) {
      res.status(404).send("Image not found.");
      return;
    }
    const fileType = String(row.file_type);
    const bytes = base64ToBytes(String(row.data_base64));
    res.setHeader("Content-Type", fileType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(bytes);
  } catch (err) {
    console.error("Media serve error:", err);
    res.status(500).send("Unable to serve media asset.");
  }
});
publicRoutes.get("/packages", async (_req, res) => {
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
    const offerByPackage = /* @__PURE__ */ new Map();
    for (const row of offersRes.rows) {
      const pkgId = row.package_id ? String(row.package_id) : null;
      if (pkgId && !offerByPackage.has(pkgId)) {
        offerByPackage.set(pkgId, {
          id: String(row.id),
          title: String(row.title),
          description: String(row.description),
          discount_type: String(row.discount_type),
          discount_value: Number(row.discount_value),
          start_date: String(row.start_date),
          expiry_date: String(row.expiry_date),
          image_url: row.image_url ? String(row.image_url) : null
        });
      }
    }
    const packages = pkgRes.rows.map((row) => {
      const id = String(row.id);
      return {
        id,
        name: String(row.name),
        speed_mbps: Number(row.speed_mbps),
        monthly_price: Number(row.monthly_price),
        description: String(row.description),
        features: parseFeatures2(row.features),
        image_url: row.image_url ? String(row.image_url) : null,
        show_on_home: Number(row.show_on_home ?? 1) === 1,
        status: "active",
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        active_offer: offerByPackage.get(id) ?? null
      };
    });
    res.json({ packages });
  } catch (err) {
    console.error("Error loading public packages:", err);
    res.status(500).json({ error: "Unable to load internet packages." });
  }
});
publicRoutes.get("/offers", async (_req, res) => {
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
    const offers = result.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      discount_type: String(row.discount_type),
      discount_value: Number(row.discount_value),
      package_id: row.package_id ? String(row.package_id) : null,
      package_name: row.package_name ? String(row.package_name) : null,
      package_speed_mbps: row.package_speed_mbps !== null && row.package_speed_mbps !== void 0 ? Number(row.package_speed_mbps) : null,
      package_monthly_price: row.package_monthly_price !== null && row.package_monthly_price !== void 0 ? Number(row.package_monthly_price) : null,
      start_date: String(row.start_date),
      expiry_date: String(row.expiry_date),
      image_url: row.image_url ? String(row.image_url) : null,
      show_on_home: Number(row.show_on_home ?? 1) === 1,
      status: "active",
      created_at: String(row.created_at)
    }));
    res.json({ offers });
  } catch (err) {
    console.error("Error loading public offers:", err);
    res.status(500).json({ error: "Unable to load promotional offers." });
  }
});
publicRoutes.post("/inquiries", async (req, res) => {
  try {
    const parsed = inquiryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid inquiry submission."
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
        args: [packageId]
      });
      if (pkgCheck.rows.length === 0) {
        res.status(400).json({ error: "Selected package is not currently available." });
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
        data.message ? data.message : null
      ]
    });
    res.status(201).json({
      id,
      reference: `INQ-${id.slice(0, 6).toUpperCase()}`,
      message: "Thank you. Our Sitakunda support desk will contact you shortly."
    });
  } catch (err) {
    console.error("Error submitting inquiry:", err);
    res.status(500).json({ error: "Unable to submit inquiry at this moment." });
  }
});

// src/server/apiMounts.ts
var mountedApiRoutes = [
  { prefix: "/api/public", router: publicRoutes },
  { prefix: "/api/admin/auth", router: adminAuthRoutes },
  { prefix: "/api/admin/cms", router: cmsAdminRoutes },
  { prefix: "/api/admin", router: adminRoutes }
];
var handleApiFetch = createFetchApiHandler(mountedApiRoutes);

// server.ts
var scryptAsync = promisify(scryptCallback);
registerLegacyScryptVerifier(async (password, storedHash) => {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const derivedBuf = await scryptAsync(password, salt, 64);
  if (expectedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, derivedBuf);
});
var PORT = Number(process.env.PORT || 3e3);
var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  await ensureDatabase();
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const origin = req.get("origin");
    if (origin && req.path.startsWith("/api/")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
      res.setHeader("Vary", "Origin");
      if (req.method.toUpperCase() === "OPTIONS") {
        res.status(204).end();
        return;
      }
    }
    next();
  });
  for (const mount of mountedApiRoutes) {
    mountMiniRouterOnExpress(app, mount.prefix, mount.router);
  }
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use("/src/assets/images", express.static(path.resolve(process.cwd(), "src/assets/images")));
    app.use((req, res, next) => {
      if (req.path === "/_worker.js" || req.path === "/_routes.json") {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build output not found.");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Roman Communication server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start Roman Communication server:", err);
  process.exit(1);
});
