import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatBDT, formatDate } from '../../lib/format';
import type { DashboardOverview } from '../../types/isp';

interface AdminOverviewPageProps {
  onNavigate: (path: string) => void;
}

export function AdminOverviewPage({ onNavigate }: AdminOverviewPageProps) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi
      .getOverview()
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error || 'Dashboard metrics could not be loaded.'}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Customers', value: data.stats.totalCustomers, path: '/admin/dashboard/customers' },
    { label: 'Active Customers', value: data.stats.activeCustomers, path: '/admin/dashboard/customers' },
    { label: 'Inactive Customers', value: data.stats.inactiveCustomers, path: '/admin/dashboard/customers' },
    { label: 'Total Internet Packages', value: data.stats.totalPackages, path: '/admin/dashboard/packages' },
    { label: 'Active Packages', value: data.stats.activePackages, path: '/admin/dashboard/packages' },
    { label: 'Active Offers', value: data.stats.activeOffers, path: '/admin/dashboard/offers' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Operations Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live business statistics fetched from Turso for Roman Communication.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('/admin/dashboard/subscriptions')}
            className="rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] whitespace-nowrap"
          >
            Assign Package
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin/dashboard/reports')}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50 whitespace-nowrap"
          >
            Package Reports
          </button>
        </div>
      </div>

      {/* 6 Dynamic KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.path)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-[#0B1F4D]"
          >
            <div>
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#0B1F4D]">
                {card.value}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>

      {data.stats.newInquiries > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#EAF2FF] px-5 py-4">
          <p className="text-sm font-medium text-[#0B1F4D]">
            You have{' '}
            <span className="font-mono font-bold tabular-nums">{data.stats.newInquiries}</span>{' '}
            new public connection or coverage inquiries waiting for review.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/admin/dashboard/inquiries')}
            className="rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70] whitespace-nowrap"
          >
            Review Inquiries
          </button>
        </div>
      )}

      {/* Recent Activity Grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recently Added Customers */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0B1F4D]">
              Recently Added Customers
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/admin/dashboard/customers')}
              className="text-xs font-medium text-[#0B1F4D] hover:underline"
            >
              Manage Customers
            </button>
          </div>
          {data.recentCustomers.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No customers registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Current Package</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="font-medium text-[#0B1F4D]">{c.name}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {c.customer_code} · {c.mobile}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {c.active_subscription ? (
                          <span>
                            {c.active_subscription.package_name}{' '}
                            <span className="font-mono text-xs text-slate-500">
                              ({c.active_subscription.speed_mbps} Mbps)
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs font-medium ${
                            c.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {c.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recently Updated Packages */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0B1F4D]">
              Recently Updated Packages
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/admin/dashboard/packages')}
              className="text-xs font-medium text-[#0B1F4D] hover:underline"
            >
              Manage Packages
            </button>
          </div>
          {data.recentPackages.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No internet packages configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">Package</th>
                    <th className="px-5 py-3 text-right font-medium">Speed</th>
                    <th className="px-5 py-3 text-right font-medium">Price</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentPackages.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-[#0B1F4D]">{p.name}</td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                        {p.speed_mbps} Mbps
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                        {formatBDT(p.monthly_price)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`text-xs font-medium ${
                            p.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {p.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Recent Customer Package Assignments */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0B1F4D]">
            Recent Customer Package Assignments
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('/admin/dashboard/subscriptions')}
            className="text-xs font-medium text-[#0B1F4D] hover:underline"
          >
            View All Assignments
          </button>
        </div>
        {data.recentAssignments.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No package assignments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Package</th>
                  <th className="px-5 py-3 text-right font-medium">Speed</th>
                  <th className="px-5 py-3 text-right font-medium">Snapshot Price</th>
                  <th className="px-5 py-3 font-medium">Assigned Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentAssignments.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <span className="font-medium text-[#0B1F4D]">{sub.customer_name}</span>{' '}
                      <span className="font-mono text-xs text-slate-500">
                        ({sub.customer_code})
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{sub.package_name}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                      {sub.speed_mbps} Mbps
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                      {formatBDT(sub.monthly_price)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-600">
                      {formatDate(sub.start_date)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs font-medium capitalize ${
                          sub.status === 'active'
                            ? 'text-emerald-700'
                            : sub.status === 'changed'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
