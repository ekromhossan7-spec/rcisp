import { Check } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { computeOfferPrice, formatBDT, formatDiscountLabel } from '../../lib/format';
import type { PackageRecord } from '../../types/isp';

interface PackageCardProps {
  pkg: PackageRecord;
  featured?: boolean;
  onSelect: (packageId: string) => void;
}

export function PackageCard({ pkg, featured = false, onSelect }: PackageCardProps) {
  const discountedPrice = pkg.active_offer
    ? computeOfferPrice(pkg.monthly_price, pkg.active_offer)
    : pkg.monthly_price;

  return (
    <article
      className={`flex flex-col justify-between rounded-xl border bg-white p-6 transition-colors duration-150 ${
        featured
          ? 'border-[#0B1F4D] ring-1 ring-[#0B1F4D]/10'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div>
        {pkg.image_url && (
          <div className="mb-5 h-36 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
            <ImageWithFallback
              src={pkg.image_url}
              alt={pkg.name}
              className="h-full w-full object-cover"
              fallbackTitle={pkg.name}
            />
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-[#0B1F4D]">{pkg.name}</h3>
          <span className="font-mono text-sm font-semibold tabular-nums text-[#0B1F4D]">
            {pkg.speed_mbps} Mbps
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">{pkg.description}</p>

        <div className="mt-5 border-y border-slate-100 py-4">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-3xl font-bold tracking-tight tabular-nums text-[#0B1F4D]">
              {formatBDT(discountedPrice)}
            </span>
            <span className="text-xs text-slate-500">/ month</span>
            {pkg.active_offer && discountedPrice < pkg.monthly_price && (
              <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                {formatBDT(pkg.monthly_price)}
              </span>
            )}
          </div>
          {pkg.active_offer && (
            <p className="mt-1.5 text-xs font-medium text-[#0B1F4D]">
              Offer applied: {pkg.active_offer.title} ·{' '}
              {formatDiscountLabel(
                pkg.active_offer.discount_type,
                pkg.active_offer.discount_value,
              )}
            </p>
          )}
        </div>

        <ul className="mt-5 space-y-2.5">
          {(Array.isArray(pkg.features) ? pkg.features : []).map((feat, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F4D]" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => onSelect(pkg.id)}
        className={`mt-7 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
          featured
            ? 'bg-[#0B1F4D] text-white hover:bg-[#132F70]'
            : 'border border-[#0B1F4D] bg-white text-[#0B1F4D] hover:bg-[#EAF2FF]'
        }`}
      >
        Get Connection
      </button>
    </article>
  );
}
