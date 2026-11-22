let currentEnv: Record<string, string | undefined> = {};

export function setRuntimeEnv(env: Record<string, unknown> | undefined | null): void {
  if (!env) return;
  const next: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(env)) {
    if (typeof val === 'string') {
      next[key] = val;
    }
  }
  currentEnv = next;
}

export function getEnv(key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(currentEnv, key)) {
    return currentEnv[key];
  }
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.[key];
}

export function isNodeRuntime(): boolean {
  const proc = (globalThis as unknown as { process?: { versions?: { node?: string } } }).process;
  return Boolean(proc?.versions?.node);
}
