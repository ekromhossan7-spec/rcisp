import type { DiscountType, OfferSummary } from '../types/isp';

export function formatBDT(amount: number): string {
  return `BDT ${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized.length === 10 ? `${normalized}T00:00:00` : normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDiscountLabel(type: DiscountType, value: number): string {
  if (type === 'percentage') {
    return `${value}% Off`;
  }
  return `BDT ${Math.round(value).toLocaleString('en-US')} Off`;
}

export function computeOfferPrice(basePrice: number, offer?: OfferSummary | null): number {
  if (!offer) return basePrice;
  if (offer.discount_type === 'percentage') {
    return Math.max(0, Math.round(basePrice * (1 - offer.discount_value / 100)));
  }
  return Math.max(0, Math.round(basePrice - offer.discount_value));
}

export function getOfferScheduleState(offer: {
  status: 'active' | 'inactive';
  start_date: string;
  expiry_date: string;
}): 'Active' | 'Scheduled' | 'Expired' | 'Inactive' {
  if (offer.status !== 'active') return 'Inactive';
  const today = new Date().toISOString().slice(0, 10);
  if (offer.start_date > today) return 'Scheduled';
  if (offer.expiry_date < today) return 'Expired';
  return 'Active';
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapeCell = (cell: string | number): string => {
    const s = String(cell ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
