const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type LegacyScryptVerifier = (password: string, storedHash: string) => Promise<boolean>;
let legacyScryptVerifier: LegacyScryptVerifier | null = null;

export function registerLegacyScryptVerifier(fn: LegacyScryptVerifier): void {
  legacyScryptVerifier = fn;
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes[i] = byte;
  }
  return bytes;
}

export function randomHex(byteLength: number): string {
  return bytesToHex(randomBytes(byteLength));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return base64ToBytes(padded + '='.repeat(padLen));
}

export function utf8ToBase64Url(str: string): string {
  return bytesToBase64Url(textEncoder.encode(str));
}

export function base64UrlToUtf8(base64Url: string): string {
  return textDecoder.decode(base64UrlToBytes(base64Url));
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  return timingSafeEqualBytes(textEncoder.encode(a), textEncoder.encode(b));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function signHmacSha256(message: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function verifyHmacSha256(
  message: string,
  signatureB64Url: string,
  secret: string,
): Promise<boolean> {
  const expected = await signHmacSha256(message, secret);
  return timingSafeEqualStrings(signatureB64Url, expected);
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPasswordPortable(password: string): Promise<string> {
  const salt = randomBytes(16);
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPasswordPortable(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const salt = hexToBytes(parts[2]);
    const expected = hexToBytes(parts[3]);
    if (!Number.isFinite(iterations) || iterations < 10_000 || !salt || !expected) {
      return false;
    }

    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const derived = await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as Uint8Array<ArrayBuffer>,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      expected.length * 8,
    );
    return timingSafeEqualBytes(new Uint8Array(derived), expected);
  }

  // Legacy Node scrypt format (`salt:hex`)
  if (legacyScryptVerifier) {
    return legacyScryptVerifier(password, storedHash);
  }
  return false;
}
