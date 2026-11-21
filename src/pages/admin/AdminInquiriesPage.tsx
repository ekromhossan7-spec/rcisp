import { useEffect, useState } from 'react';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { InquiryRecord, InquiryStatus } from '../../types/isp';

export function AdminInquiriesPage() {
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadInquiries() {
    setLoading(true);
    try {
      const res = await adminApi.getInquiries();
      setInquiries(res.inquiries);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load inquiries.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInquiries();
  }, []);

  async function handleStatusChange(id: string, status: InquiryStatus) {
    try {
      const res = await adminApi.updateInquiryStatus(id, status);
      showToast(res.message);
      await loadInquiries();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
          Customer & Coverage Inquiries
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Incoming new connection requests, coverage checks, and messages from the public
          website.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No public inquiries have been submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Applicant</th>
                  <th className="px-5 py-3.5 font-medium">Category</th>
                  <th className="px-5 py-3.5 font-medium">Location & Notes</th>
                  <th className="px-5 py-3.5 font-medium">Requested Date</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#0B1F4D]">{inq.full_name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {inq.mobile}
                        {inq.email ? ` · ${inq.email}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium capitalize text-slate-700">
                        {inq.inquiry_type || inq.type}
                      </div>
                      {inq.package_name && (
                        <div className="text-xs text-slate-500">Plan: {inq.package_name}</div>
                      )}
                    </td>
                    <td className="max-w-sm px-5 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{inq.address}</div>
                      {inq.message && <div className="mt-1 text-slate-500">{inq.message}</div>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-500">
                      {formatDate(inq.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={inq.status}
                        onChange={(e) =>
                          handleStatusChange(inq.id, e.target.value as InquiryStatus)
                        }
                        aria-label={`Update status for ${inq.full_name}`}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold focus:outline-none ${
                          inq.status === 'new'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : inq.status === 'contacted'
                              ? 'border-slate-200 bg-[#EAF2FF] text-[#0B1F4D]'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                      </select>
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
