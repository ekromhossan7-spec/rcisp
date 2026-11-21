import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { publicApi } from '../../lib/api';
import { formatBDT } from '../../lib/format';
import type { PackageRecord } from '../../types/isp';

interface ConnectionModalProps {
  open: boolean;
  packages: PackageRecord[];
  preselectedPackageId?: string | null;
  onClose: () => void;
}

export function ConnectionModal({
  open,
  packages,
  preselectedPackageId,
  onClose,
}: ConnectionModalProps) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [packageId, setPackageId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPackageId(preselectedPackageId || packages[0]?.id || '');
      setError(null);
      setSubmittedRef(null);
    }
  }, [open, preselectedPackageId, packages]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await publicApi.submitInquiry({
        type: 'connection',
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        address: address.trim(),
        package_id: packageId || null,
        inquiry_type: 'New Connection Request',
        message: message.trim(),
      });
      setSubmittedRef(res.reference);
      setFullName('');
      setMobile('');
      setEmail('');
      setAddress('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit connection request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="connection-modal-title" className="text-lg font-semibold text-[#0B1F4D]">
              Request a New Fiber Connection
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Serving Gulahammad, Masajidda, Sitakunda, Chattogram.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connection modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedRef ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#0B1F4D]">
              Connection Request Received
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Your reference number is{' '}
              <span className="font-mono font-semibold text-[#0B1F4D]">{submittedRef}</span>. Our
              local installation team in Masajidda will call you shortly to confirm line
              feasibility.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Md. Karim Uddin"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="018XX-XXXXXX"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Select Internet Package
                </label>
                <select
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                >
                  <option value="">Recommend a package for me</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.speed_mbps} Mbps — {formatBDT(pkg.monthly_price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Installation Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Road, Gulahammad, Masajidda, Sitakunda"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Preferred installation time or nearest landmark"
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#0B1F4D] px-5 py-2 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Connection Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
