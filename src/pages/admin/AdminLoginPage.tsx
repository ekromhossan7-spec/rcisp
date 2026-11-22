import { useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { adminAuthApi } from '../../lib/api';
import type { AdminUser } from '../../types/isp';

interface AdminLoginPageProps {
  needsSetup: boolean;
  authMode?: 'env' | 'db';
  initialError?: string | null;
  onSuccess: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}

export function AdminLoginPage({
  needsSetup,
  authMode = 'db',
  initialError = null,
  onSuccess,
  onNavigate,
}: AdminLoginPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const displayedError = error ?? initialError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsSetup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (needsSetup) {
        const res = await adminAuthApi.setup({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        onSuccess(res.admin);
      } else {
        const res = await adminAuthApi.login({
          email: email.trim(),
          password,
        });
        onSuccess(res.admin);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#F8FAFC] px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#0B1F4D]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Website
          </a>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="flex flex-col items-start border-b border-slate-100 pb-6">
            <div className="inline-flex flex-col items-center gap-1.5 text-center">
              <ImageWithFallback
                src="/assets/aistudio/image_4c43d9bf.png"
                alt="Roman Communication"
                className="h-10 w-auto object-contain"
                fallbackTitle="Roman Communication"
              />
              <span className="text-sm font-bold leading-tight tracking-tight text-[#0B1F4D]">
                Roman Communication
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[#0B1F4D]">
              {needsSetup ? (
                <ShieldCheck className="h-5 w-5 shrink-0" />
              ) : (
                <Lock className="h-5 w-5 shrink-0" />
              )}
              <h1 className="text-xl font-bold tracking-tight">
                {needsSetup ? 'Claim Initial Admin Account' : 'Admin Dashboard Sign In'}
              </h1>
            </div>
            <p className="mt-1.5 text-sm text-slate-600">
              {needsSetup
                ? 'Set up the primary administrator credentials for Roman Communication. This one-time setup locks automatically once claimed.'
                : 'Authorized Roman Communication administrators only.'}
            </p>
            {!needsSetup && authMode === 'env' && (
              <div className="mt-3 w-full rounded-lg border border-blue-100 bg-[#EAF2FF] px-3.5 py-2.5 text-xs text-[#0B1F4D]">
                Environment administrator authentication is active. Sign in using the configured{' '}
                <code className="font-mono font-semibold">ADMIN_EMAIL</code> and{' '}
                <code className="font-mono font-semibold">ADMIN_PASSWORD</code> values.
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {displayedError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {displayedError}
              </div>
            )}

            {needsSetup && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Administrator Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Roman Communication Admin"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Email Address *
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@romancommunication.com"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Password *
              </label>
              <input
                type="password"
                required
                minLength={needsSetup ? 8 : 1}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={needsSetup ? 'Minimum 8 characters' : 'Enter password'}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
              />
            </div>

            {needsSetup && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg bg-[#0B1F4D] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#132F70] disabled:opacity-60"
            >
              {submitting
                ? needsSetup
                  ? 'Creating Admin Account...'
                  : 'Signing In...'
                : needsSetup
                  ? 'Create Admin Account & Sign In'
                  : 'Sign In to Dashboard'}
            </button>

            {!needsSetup && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowRecoveryHelp((prev) => !prev)}
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-[#0B1F4D] hover:underline"
                >
                  {showRecoveryHelp ? 'Hide password recovery steps' : 'Forgot password?'}
                </button>

                {showRecoveryHelp && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {authMode === 'env' ? (
                      <>
                        <p className="font-semibold text-[#0B1F4D]">
                          Reset Environment Credentials
                        </p>
                        <p className="mt-1">
                          Sign-in is currently controlled by the{' '}
                          <code className="font-mono font-semibold">ADMIN_EMAIL</code> and{' '}
                          <code className="font-mono font-semibold">ADMIN_PASSWORD</code> secrets.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          <li>
                            In <strong>AI Studio</strong>, open the <strong>Secrets</strong> panel
                            to view or update <code className="font-mono">ADMIN_EMAIL</code> and{' '}
                            <code className="font-mono">ADMIN_PASSWORD</code>.
                          </li>
                          <li>
                            In <strong>Cloudflare Pages</strong>, go to{' '}
                            <strong>Settings → Environment variables</strong>, update them, and
                            redeploy.
                          </li>
                          <li>
                            If you remove both variables (and no DB admin exists), reloading this
                            page will open the <strong>Claim Initial Admin Account</strong> setup.
                          </li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-[#0B1F4D]">
                          Reset Database Administrator Password
                        </p>
                        <p className="mt-1">
                          Your administrator account is stored in the Turso/SQLite{' '}
                          <code className="font-mono font-semibold">admins</code> table.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          <li>
                            Set <code className="font-mono">ADMIN_EMAIL</code> and{' '}
                            <code className="font-mono">ADMIN_PASSWORD</code> in{' '}
                            <strong>AI Studio Secrets</strong> or{' '}
                            <strong>Cloudflare Pages → Environment variables</strong> to sign in
                            immediately, or
                          </li>
                          <li>
                            Run <code className="font-mono">DELETE FROM admins;</code> on your
                            Turso/SQLite database and reload this page to re-run{' '}
                            <strong>Claim Initial Admin Account</strong>.
                          </li>
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
