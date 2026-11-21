import { useEffect, useState, type FormEvent } from 'react';
import {
  History,
  Link2,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatBDT, formatDate } from '../../lib/format';
import type {
  CustomerRecord,
  PackageRecord,
  RecordStatus,
  SubscriptionRecord,
} from '../../types/isp';

export function AdminCustomersPage() {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 15;
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [packageFilter, setPackageFilter] = useState('');

  // Create / Edit Customer Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<RecordStatus>('active');
  const [initialPackageId, setInitialPackageId] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign / Change Package Modal
  const [assignTarget, setAssignTarget] = useState<CustomerRecord | null>(null);
  const [assignPackageId, setAssignPackageId] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');
  const [assigning, setAssigning] = useState(false);

  // History Modal
  const [historyTarget, setHistoryTarget] = useState<CustomerRecord | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<SubscriptionRecord[]>([]);

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activePackages = packages.filter((p) => p.status === 'active');

  async function loadPackages() {
    try {
      const res = await adminApi.getPackages();
      setPackages(res.packages);
    } catch {
      // Handled when loading customers
    }
  }

  async function loadCustomers(targetPage = page) {
    setLoading(true);
    try {
      const res = await adminApi.getCustomers({
        q: query.trim() || undefined,
        status: statusFilter || undefined,
        packageId: packageFilter || undefined,
        page: targetPage,
        limit,
      });
      setCustomers(res.customers);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCustomers(1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, statusFilter, packageFilter]);

  function openCreate() {
    setEditing(null);
    setName('');
    setMobile('');
    setEmail('');
    setAddress('');
    setStatus('active');
    setInitialPackageId('');
    setFormOpen(true);
  }

  function openEdit(c: CustomerRecord) {
    setEditing(c);
    setName(c.name);
    setMobile(c.mobile);
    setEmail(c.email || '');
    setAddress(c.address);
    setStatus(c.status);
    setInitialPackageId('');
    setFormOpen(true);
  }

  async function handleSaveCustomer(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const res = await adminApi.updateCustomer(editing.id, {
          name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          status,
        });
        showToast(res.message);
      } else {
        const res = await adminApi.createCustomer({
          name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          address: address.trim(),
          status,
          initial_package_id: initialPackageId || null,
        });
        showToast(`${res.message} (${res.customer_code})`);
      }
      setFormOpen(false);
      await loadCustomers(1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openAssignModal(c: CustomerRecord) {
    setAssignTarget(c);
    setAssignPackageId(c.active_subscription?.package_id || activePackages[0]?.id || '');
    setAssignEndDate('');
  }

  async function handleAssignPackage(e: FormEvent) {
    e.preventDefault();
    if (!assignTarget || !assignPackageId) return;
    setAssigning(true);
    try {
      const res = await adminApi.assignPackage({
        customer_id: assignTarget.id,
        package_id: assignPackageId,
        end_date: assignEndDate || null,
      });
      showToast(res.message);
      setAssignTarget(null);
      await loadCustomers(page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to assign package.', 'error');
    } finally {
      setAssigning(false);
    }
  }

  async function openHistoryModal(c: CustomerRecord) {
    setHistoryTarget(c);
    setHistoryLoading(true);
    try {
      const res = await adminApi.getCustomerHistory(c.id);
      setHistoryRows(res.history);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load history.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleToggleStatus(c: CustomerRecord) {
    const next: RecordStatus = c.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await adminApi.toggleCustomerStatus(c.id, next);
      showToast(res.message);
      await loadCustomers(page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update customer.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.deleteCustomer(deleteTarget.id);
      showToast(res.message);
      setDeleteTarget(null);
      await loadCustomers(page);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete customer.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Search subscribers, manage connection status, and assign internet packages.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer name, ID (RC-1001), or mobile number..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Customers</option>
            <option value="inactive">Inactive Customers</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <select
            value={packageFilter}
            onChange={(e) => setPackageFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
          >
            <option value="">All Packages</option>
            <option value="unassigned">No Active Package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.speed_mbps} Mbps)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">
              No customers match your current search or filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('');
                setPackageFilter('');
              }}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Customer ID</th>
                  <th className="px-5 py-3.5 font-medium">Customer Details</th>
                  <th className="px-5 py-3.5 font-medium">Address</th>
                  <th className="px-5 py-3.5 font-medium">Assigned Package</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#0B1F4D]">
                      {c.customer_code}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#0B1F4D]">{c.name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {c.mobile}
                        {c.email ? ` · ${c.email}` : ''}
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-xs text-slate-600">{c.address}</td>
                    <td className="px-5 py-3.5">
                      {c.active_subscription ? (
                        <div>
                          <div className="font-medium text-[#0B1F4D]">
                            {c.active_subscription.package_name}
                          </div>
                          <div className="font-mono text-xs text-slate-500 tabular-nums">
                            {c.active_subscription.speed_mbps} Mbps ·{' '}
                            {formatBDT(c.active_subscription.monthly_price)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No active package</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          c.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {c.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openAssignModal(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-[#EAF2FF] whitespace-nowrap"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {c.active_subscription ? 'Change Plan' : 'Assign Plan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistoryModal(c)}
                          title="Subscription history"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          title="Edit customer"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          title={
                            c.status === 'active' ? 'Deactivate customer' : 'Activate customer'
                          }
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          title="Delete customer"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > limit && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
            <span>
              Showing page <span className="font-mono font-semibold">{page}</span> of{' '}
              <span className="font-mono font-semibold">{totalPages}</span> ({total} customers)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => loadCustomers(page - 1)}
                className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => loadCustomers(page + 1)}
                className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-[#0B1F4D]">
                {editing ? `Edit Customer (${editing.customer_code})` : 'Add New Customer'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Gulahammad, Masajidda, Sitakunda"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Connection Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RecordStatus)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {!editing && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Assign Initial Package (Optional)
                    </label>
                    <select
                      value={initialPackageId}
                      onChange={(e) => setInitialPackageId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    >
                      <option value="">Assign later</option>
                      {activePackages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.speed_mbps} Mbps — {formatBDT(p.monthly_price)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0B1F4D] px-5 py-2 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Change Package Modal */}
      {assignTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0B1F4D]">
                  {assignTarget.active_subscription ? 'Change Package' : 'Assign Package'}
                </h2>
                <p className="text-xs text-slate-500">
                  {assignTarget.name} ({assignTarget.customer_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAssignPackage} className="mt-5 space-y-4">
              {assignTarget.active_subscription && (
                <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5 text-xs text-slate-700">
                  <p className="font-semibold text-[#0B1F4D]">Current Active Plan</p>
                  <p className="mt-1">
                    {assignTarget.active_subscription.package_name} (
                    {assignTarget.active_subscription.speed_mbps} Mbps ·{' '}
                    {formatBDT(assignTarget.active_subscription.monthly_price)})
                  </p>
                  <p className="mt-1 text-slate-500">
                    Confirming a new assignment will automatically close the current
                    subscription as changed and keep its history.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Select Active Package *
                </label>
                <select
                  required
                  value={assignPackageId}
                  onChange={(e) => setAssignPackageId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                >
                  <option value="">Choose a package...</option>
                  {activePackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.speed_mbps} Mbps ({formatBDT(p.monthly_price)}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={assignEndDate}
                  onChange={(e) => setAssignEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignTarget(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !assignPackageId}
                  className="rounded-lg bg-[#0B1F4D] px-5 py-2 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription History Modal */}
      {historyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0B1F4D]">
                  Package Assignment History
                </h2>
                <p className="text-xs text-slate-500">
                  {historyTarget.name} ({historyTarget.customer_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {historyLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading history...</p>
              ) : historyRows.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No package assignment history found for this customer.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="py-2.5 pr-4 font-medium">Package</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Speed</th>
                      <th className="py-2.5 pr-4 text-right font-medium">Price Snapshot</th>
                      <th className="py-2.5 pr-4 font-medium">Start Date</th>
                      <th className="py-2.5 pr-4 font-medium">End Date</th>
                      <th className="py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyRows.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2.5 pr-4 font-medium text-[#0B1F4D]">
                          {h.package_name}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs tabular-nums text-slate-600">
                          {h.speed_mbps} Mbps
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-700">
                          {formatBDT(h.monthly_price)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">
                          {formatDate(h.start_date)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">
                          {formatDate(h.end_date)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              h.status === 'active'
                                ? 'text-emerald-700'
                                : h.status === 'changed'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Customer Record"
        description={`Are you sure you want to permanently remove ${deleteTarget?.name ?? ''} (${deleteTarget?.customer_code ?? ''}) and their subscription history?`}
        confirmLabel="Delete Customer"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
