import { useEffect, useState, type FormEvent } from 'react';
import { Ban, Link2 } from 'lucide-react';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatBDT, formatDate } from '../../lib/format';
import type { CustomerRecord, PackageRecord, SubscriptionRecord } from '../../types/isp';

export function AdminSubscriptionsPage() {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<SubscriptionRecord | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const activePackages = packages.filter((p) => p.status === 'active');
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  async function loadAll() {
    setLoading(true);
    try {
      const [custRes, pkgRes, subRes] = await Promise.all([
        adminApi.getCustomers({ limit: 100 }),
        adminApi.getPackages(),
        adminApi.getSubscriptions({}),
      ]);
      setCustomers(custRes.customers);
      setPackages(pkgRes.packages);
      setSubscriptions(subRes.subscriptions);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load subscriptions.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId || !selectedPackageId) return;
    setSubmitting(true);
    try {
      const res = await adminApi.assignPackage({
        customer_id: selectedCustomerId,
        package_id: selectedPackageId,
        end_date: endDate || null,
      });
      showToast(res.message);
      setSelectedCustomerId('');
      setSelectedPackageId('');
      setEndDate('');
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to assign package.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSubscription() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await adminApi.cancelSubscription(cancelTarget.id);
      showToast(res.message);
      setCancelTarget(null);
      await loadAll();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to cancel subscription.',
        'error',
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
          Customer Package Assignment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Assign or switch broadband packages. Each customer maintains at most one active
          assignment while preserving all previous subscription history.
        </p>
      </div>

      {/* Assign / Change Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Link2 className="h-4 w-4 text-[#0B1F4D]" />
          <h2 className="text-base font-semibold text-[#0B1F4D]">
            Assign or Change Customer Package
          </h2>
        </div>

        <form onSubmit={handleAssign} className="mt-5 grid gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Select Customer *
            </label>
            <select
              required
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
            >
              <option value="">Choose customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} — {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Select Active Package *
            </label>
            <select
              required
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
            >
              <option value="">Choose active package...</option>
              {activePackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.speed_mbps} Mbps ({formatBDT(p.monthly_price)})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Expiry (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
            />
          </div>

          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              disabled={submitting || !selectedCustomerId || !selectedPackageId}
              className="w-full rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>

        {selectedCustomer?.active_subscription && (
          <p className="mt-4 text-xs text-slate-600">
            Note: <span className="font-semibold text-[#0B1F4D]">{selectedCustomer.name}</span>{' '}
            is currently subscribed to{' '}
            <span className="font-semibold text-[#0B1F4D]">
              {selectedCustomer.active_subscription.package_name}
            </span>{' '}
            ({formatBDT(selectedCustomer.active_subscription.monthly_price)}). Confirming will
            mark the previous plan as <span className="font-medium">changed</span> and create a
            new active assignment.
          </p>
        )}
      </section>

      {/* Subscriptions Ledger */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-[#0B1F4D]">
            All Package Subscriptions & History
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No subscription assignments recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Customer</th>
                  <th className="px-5 py-3.5 font-medium">Package</th>
                  <th className="px-5 py-3.5 text-right font-medium">Speed</th>
                  <th className="px-5 py-3.5 text-right font-medium">Monthly Price</th>
                  <th className="px-5 py-3.5 font-medium">Assigned Date</th>
                  <th className="px-5 py-3.5 font-medium">End Date</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-[#0B1F4D]">{s.customer_name}</div>
                      <div className="font-mono text-xs text-slate-500">{s.customer_code}</div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">{s.package_name}</td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {s.speed_mbps} Mbps
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium tabular-nums text-[#0B1F4D]">
                      {formatBDT(s.monthly_price)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(s.start_date)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(s.end_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          s.status === 'active'
                            ? 'text-emerald-700'
                            : s.status === 'changed'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {s.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => setCancelTarget(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="Cancel Active Subscription"
        description={`Cancel ${cancelTarget?.customer_name ?? ''}'s active assignment to ${cancelTarget?.package_name ?? ''}? Historical record will be preserved as cancelled.`}
        confirmLabel="Cancel Subscription"
        destructive
        busy={cancelling}
        onConfirm={handleCancelSubscription}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
