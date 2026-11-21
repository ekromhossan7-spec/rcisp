import { useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { adminAuthApi } from '../../lib/api';
import type { AdminUser } from '../../types/isp';

interface AdminLoginPageProps {
  needsSetup: boolean;
  onSuccess: (admin: AdminUser) => void;
  onNavigate: (path: string) => void;
}

export function AdminLoginPage({ needsSetup, onSuccess, onNavigate }: AdminLoginPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {error}
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
          </form>
        </div>
      </div>
    </div>
  );
}
