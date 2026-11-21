import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { downloadCsv, formatBDT, formatDate } from '../../lib/format';
import type { PackageRecord, SubscriptionRecord } from '../../types/isp';

export function AdminReportsPage() {
  const { showToast } = useToast();

  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [rows, setRows] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [packageId, setPackageId] = useState('');
  const [status, setStatus] = useState('active');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    adminApi
      .getPackages()
      .then((res) => setPackages(res.packages))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      adminApi
        .getSubscriptions({
          q: q.trim() || undefined,
          packageId: packageId || undefined,
          status: status || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .then((res) => setRows(res.subscriptions))
        .catch((err) => {
          showToast(
            err instanceof Error ? err.message : 'Unable to load assignment report.',
            'error',
          );
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [q, packageId, status, fromDate, toDate]);

  const summary = useMemo(() => {
    const activeRows = rows.filter((r) => r.status === 'active');
    const monthlyTotal = activeRows.reduce((sum, r) => sum + r.monthly_price, 0);
    return {
      totalRows: rows.length,
      activeCount: activeRows.length,
      monthlyTotal,
    };
  }, [rows]);

  function handleExportCsv() {
    downloadCsv(
      `roman-communication-package-report-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Customer Code', 'Customer Name', 'Mobile', 'Package', 'Speed (Mbps)', 'Monthly Price (BDT)', 'Assignment Date', 'Status'],
      rows.map((r) => [
        r.customer_code,
        r.customer_name,
        r.customer_mobile,
        r.package_name,
        r.speed_mbps,
        r.monthly_price,
        r.start_date.slice(0, 10),
        r.status,
      ]),
    );
    showToast('Report exported to CSV.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Package Assignment Reports
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track customer-to-package assignments, pricing snapshots, and historical plan
            transitions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="relative lg:col-span-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by Customer Name or ID..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          />
        </div>

        <div className="lg:col-span-3">
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          >
            <option value="">All Packages</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.speed_mbps} Mbps)
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Historical</option>
            <option value="changed">Changed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:col-span-3">
          <input
            type="date"
            aria-label="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          />
          <input
            type="date"
            aria-label="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          />
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Matching Records</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0B1F4D]">
            {summary.totalRows}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Active Subscriptions in Filter</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0B1F4D]">
            {summary.activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Active Monthly Recurring Value</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0B1F4D]">
            {formatBDT(summary.monthlyTotal)}
          </p>
        </div>
      </div>

      {/* Report Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No package assignment records match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Customer</th>
                  <th className="px-5 py-3.5 font-medium">Package</th>
                  <th className="px-5 py-3.5 text-right font-medium">Speed</th>
                  <th className="px-5 py-3.5 text-right font-medium">Monthly Price</th>
                  <th className="px-5 py-3.5 font-medium">Assignment Date</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-[#0B1F4D]">{row.customer_name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {row.customer_code} · {row.customer_mobile}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700">
                      {row.package_name}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {row.speed_mbps} Mbps
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium tabular-nums text-[#0B1F4D]">
                      {formatBDT(row.monthly_price)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(row.start_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold capitalize ${
                          row.status === 'active'
                            ? 'text-emerald-700'
                            : row.status === 'changed'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
