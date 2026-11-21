import { useEffect, useState, type FormEvent } from 'react';
import { Image as ImageIcon, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatDate, formatDiscountLabel, getOfferScheduleState } from '../../lib/format';
import type { DiscountType, OfferRecord, PackageRecord, RecordStatus } from '../../types/isp';

export function AdminOffersPage() {
  const { showToast } = useToast();
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OfferRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [packageId, setPackageId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showOnHome, setShowOnHome] = useState(true);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [status, setStatus] = useState<RecordStatus>('active');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<OfferRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [offersRes, pkgRes] = await Promise.all([
        adminApi.getOffers(),
        adminApi.getPackages(),
      ]);
      setOffers(offersRes.offers);
      setPackages(pkgRes.packages);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load offers.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openCreate() {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setEditing(null);
    setTitle('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('10');
    setPackageId(packages.find((p) => p.status === 'active')?.id || '');
    setStartDate(today);
    setExpiryDate(nextMonth);
    setImageUrl('');
    setShowOnHome(true);
    setStatus('active');
    setFormOpen(true);
  }

  function openEdit(offer: OfferRecord) {
    setEditing(offer);
    setTitle(offer.title);
    setDescription(offer.description);
    setDiscountType(offer.discount_type);
    setDiscountValue(String(offer.discount_value));
    setPackageId(offer.package_id || '');
    setStartDate(offer.start_date.slice(0, 10));
    setExpiryDate(offer.expiry_date.slice(0, 10));
    setImageUrl(offer.image_url || '');
    setShowOnHome(Boolean(offer.show_on_home));
    setStatus(offer.status);
    setFormOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        package_id: packageId || null,
        start_date: startDate,
        expiry_date: expiryDate,
        image_url: imageUrl.trim() || null,
        show_on_home: showOnHome,
        status,
      };
      if (editing) {
        const res = await adminApi.updateOffer(editing.id, payload);
        showToast(res.message);
      } else {
        const res = await adminApi.createOffer(payload);
        showToast(res.message);
      }
      setFormOpen(false);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save offer.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(offer: OfferRecord) {
    const nextStatus: RecordStatus = offer.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await adminApi.toggleOfferStatus(offer.id, nextStatus);
      showToast(res.message);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update offer.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminApi.deleteOffer(deleteTarget.id);
      showToast(res.message);
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete offer.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Promotional Offers
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Only active offers within their start and expiry dates appear on the public website.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Add Offer
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">No promotional offers created yet.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white"
            >
              Create First Offer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-5 py-3.5 font-medium">Offer Title</th>
                  <th className="px-5 py-3.5 font-medium">Discount</th>
                  <th className="px-5 py-3.5 font-medium">Applicable Package</th>
                  <th className="px-5 py-3.5 font-medium">Validity Window</th>
                  <th className="px-5 py-3.5 font-medium">Homepage</th>
                  <th className="px-5 py-3.5 font-medium">State</th>
                  <th className="px-5 py-3.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((offer) => {
                  const state = getOfferScheduleState(offer);
                  return (
                    <tr key={offer.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {offer.image_url && (
                            <div className="h-9 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                              <ImageWithFallback
                                src={offer.image_url}
                                alt={offer.title}
                                className="h-full w-full object-cover"
                                fallbackTitle={offer.title}
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0B1F4D]">{offer.title}</div>
                            <div className="max-w-xs truncate text-xs text-slate-500">
                              {offer.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#0B1F4D]">
                        {formatDiscountLabel(offer.discount_type, offer.discount_value)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {offer.package_name || 'All Active Packages'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                        {formatDate(offer.start_date)} – {formatDate(offer.expiry_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-medium ${
                            offer.show_on_home ? 'text-[#0B1F4D]' : 'text-slate-400'
                          }`}
                        >
                          {offer.show_on_home ? 'Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-semibold ${
                            state === 'Active'
                              ? 'text-emerald-700'
                              : state === 'Scheduled'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {state}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(offer)}
                            title="Edit offer"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(offer)}
                            title={offer.status === 'active' ? 'Deactivate offer' : 'Activate offer'}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-[#0B1F4D]"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(offer)}
                            title="Delete offer"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-semibold text-[#0B1F4D]">
                {editing ? 'Update Promotional Offer' : 'Create Promotional Offer'}
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
                  Offer Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Masajidda New Fiber Welcome Discount"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Offer Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the discount details and eligibility"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Discount Type *
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (BDT)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={discountType === 'percentage' ? 100 : undefined}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Applicable Package
                  </label>
                  <select
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  >
                    <option value="">All Active Packages</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.speed_mbps} Mbps)
                      </option>
                    ))}
                  </select>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#0B1F4D]">
                      Promotional Image (Optional)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Displayed on the promotional offer card on the Offers page and Homepage.
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
                      alt={title || 'Offer preview'}
                      className="h-full w-full object-cover"
                      fallbackTitle={title || 'Offer Image'}
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
                <span>Show this offer in Homepage Preview</span>
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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Promotional Offer"
        description={`Are you sure you want to delete "${deleteTarget?.title ?? ''}"?`}
        confirmLabel="Delete Offer"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <MediaPickerModal
        open={mediaPickerOpen}
        selectedUrl={imageUrl}
        defaultCategory="offer"
        onSelect={(asset) => setImageUrl(asset.file_url)}
        onClose={() => setMediaPickerOpen(false)}
      />
    </div>
  );
}
