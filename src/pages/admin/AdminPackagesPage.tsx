import { useEffect, useState, type FormEvent } from 'react';
import { Image as ImageIcon, Pencil, Plus, Power, Trash2, Users, X } from 'lucide-react';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatBDT, formatDate } from '../../lib/format';
import type { PackageRecord, RecordStatus } from '../../types/isp';

export function AdminPackagesPage() {
  const { showToast } = useToast();
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRecord | null>(null);
  const [name, setName] = useState('');
  const [speedMbps, setSpeedMbps] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showOnHome, setShowOnHome] = useState(true);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [status, setStatus] = useState<RecordStatus>('active');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PackageRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [subscribersModalPkg, setSubscribersModalPkg] = useState<PackageRecord | null>(null);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [subscribers, setSubscribers] = useState<
    Array<{
      customer_id: string;
      customer_code: string;
      name: string;
      mobile: string;
      address: string;
      subscription_id: string;
      monthly_price: number;
      start_date: string;
    }>
  >([]);

  async function loadPackages() {
    setLoading(true);
    try {
      const res = await adminApi.getPackages();
      setPackages(res.packages);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load packages.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackages();
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setSpeedMbps('');
    setMonthlyPrice('');
    setDescription('');
    setFeaturesText('Unlimited monthly data\nFiber optic to home (FTTH)');
    setImageUrl('');
    setShowOnHome(true);
    setStatus('active');
    setFormOpen(true);
  }

  function openEdit(pkg: PackageRecord) {
    setEditing(pkg);
    setName(pkg.name);
    setSpeedMbps(String(pkg.speed_mbps));
    setMonthlyPrice(String(pkg.monthly_price));
    setDescription(pkg.description);
    setFeaturesText(pkg.features.join('\n'));
    setImageUrl(pkg.image_url || '');
    setShowOnHome(Boolean(pkg.show_on_home));
    setStatus(pkg.status === 'inactive' ? 'inactive' : 'active');
    setFormOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const features = featuresText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (features.length === 0) {
      showToast('Please enter at least one package feature.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        speed_mbps: Number(speedMbps),
        monthly_price: Number(monthlyPrice),
        description: description.trim(),
        features,
        image_url: imageUrl.trim() || null,
        show_on_home: showOnHome,
        status,
      };
      if (editing) {
        const res = await adminApi.updatePackage(editing.id, payload);
        showToast(res.message);
      } else {
        const res = await adminApi.createPackage(payload);
        showToast(res.message);
      }
      setFormOpen(false);
      await loadPackages();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save package.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(pkg: PackageRecord) {
    const nextStatus: RecordStatus = pkg.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await adminApi.togglePackageStatus(pkg.id, nextStatus);
      showToast(res.message);
      await loadPackages();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.deletePackage(deleteTarget.id);
      showToast(res.message);
      setDeleteTarget(null);
      await loadPackages();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete package.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function openSubscribers(pkg: PackageRecord) {
    setSubscribersModalPkg(pkg);
    setSubscribersLoading(true);
    try {
      const res = await adminApi.getPackageCustomers(pkg.id);
      setSubscribers(res.subscribers);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load subscribers.', 'error');
    } finally {
      setSubscribersLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Internet Packages
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage broadband speed tiers, BDT pricing, and subscriber visibility.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Package
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">No internet packages have been created yet.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white"
            >
              Create First Package
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Package Name</th>
                  <th className="px-5 py-3.5 text-right font-medium">Speed</th>
                  <th className="px-5 py-3.5 text-right font-medium">Monthly Price</th>
                  <th className="px-5 py-3.5 text-right font-medium">Active Subscribers</th>
                  <th className="px-5 py-3.5 font-medium">Homepage</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium">Created</th>
                  <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {pkg.image_url && (
                          <div className="h-9 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <ImageWithFallback
                              src={pkg.image_url}
                              alt={pkg.name}
                              className="h-full w-full object-cover"
                              fallbackTitle={pkg.name}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0B1F4D]">{pkg.name}</div>
                          <div className="max-w-xs truncate text-xs text-slate-500">
                            {pkg.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-700">
                      {pkg.speed_mbps} Mbps
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium tabular-nums text-[#0B1F4D]">
                      {formatBDT(pkg.monthly_price)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openSubscribers(pkg)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums text-[#0B1F4D] hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {pkg.active_subscriber_count ?? 0}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-medium ${
                          pkg.show_on_home ? 'text-[#0B1F4D]' : 'text-slate-400'
                        }`}
                      >
                        {pkg.show_on_home ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          pkg.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {pkg.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-500">
                      {formatDate(pkg.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(pkg)}
                          title="Edit package"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(pkg)}
                          title={pkg.status === 'active' ? 'Deactivate package' : 'Activate package'}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(pkg)}
                          title="Delete package"
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
      </div>

      {/* Create / Edit Package Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-[#0B1F4D]">
                {editing ? 'Update Internet Package' : 'Create Internet Package'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Home Stream 25"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Speed (Mbps) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={speedMbps}
                    onChange={(e) => setSpeedMbps(e.target.value)}
                    placeholder="25"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Monthly Price (BDT) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    required
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="800"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Status *
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
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of who this plan is ideal for"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Package Features (one per line) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Unlimited monthly data"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#0B1F4D]">Package Image (Optional)</p>
                    <p className="text-[11px] text-slate-500">
                      Displayed at the top of this package card on the website.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {imageUrl ? 'Change Image' : 'Select Image'}
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {imageUrl && (
                  <div className="mt-3 h-24 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <ImageWithFallback
                      src={imageUrl}
                      alt={name || 'Package preview'}
                      className="h-full w-full object-cover"
                      fallbackTitle={name || 'Package Image'}
                    />
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-[#0B1F4D]">
                <input
                  type="checkbox"
                  checked={showOnHome}
                  onChange={(e) => setShowOnHome(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0B1F4D] focus:ring-[#0B1F4D]"
                />
                <span>Show this package in Homepage Preview</span>
              </label>

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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Package Subscribers Modal */}
      {subscribersModalPkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0B1F4D]">
                  Subscribers on {subscribersModalPkg.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {subscribersModalPkg.speed_mbps} Mbps ·{' '}
                  {formatBDT(subscribersModalPkg.monthly_price)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubscribersModalPkg(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {subscribersLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading subscribers...</p>
              ) : subscribers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No customers are currently subscribed to this package.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="py-2.5 pr-4 font-medium">Code</th>
                      <th className="py-2.5 pr-4 font-medium">Customer</th>
                      <th className="py-2.5 pr-4 font-medium">Mobile</th>
                      <th className="py-2.5 text-right font-medium">Rate</th>
                      <th className="py-2.5 pl-4 font-medium">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subscribers.map((s) => (
                      <tr key={s.subscription_id}>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">
                          {s.customer_code}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-[#0B1F4D]">{s.name}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">
                          {s.mobile}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {formatBDT(s.monthly_price)}
                        </td>
                        <td className="py-2.5 pl-4 font-mono text-xs text-slate-500">
                          {formatDate(s.start_date)}
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
        title="Delete Internet Package"
        description={
          deleteTarget && (deleteTarget.active_subscriber_count ?? 0) > 0
            ? `${deleteTarget.name} has customer subscriptions. Deleting it will archive (soft-delete) the package so historical subscription records stay intact.`
            : `Are you sure you want to delete ${deleteTarget?.name ?? 'this package'}?`
        }
        confirmLabel="Delete Package"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <MediaPickerModal
        open={mediaPickerOpen}
        selectedUrl={imageUrl}
        defaultCategory="package"
        onSelect={(asset) => setImageUrl(asset.file_url)}
        onClose={() => setMediaPickerOpen(false)}
      />
    </div>
  );
}
