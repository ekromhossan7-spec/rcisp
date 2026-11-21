import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { CustomSectionBlock } from '../../components/public/CustomSectionBlock';
import { computeOfferPrice, formatBDT, formatDate, formatDiscountLabel } from '../../lib/format';
import type { OfferRecord, PublicSiteSection } from '../../types/isp';

interface OffersPageProps {
  offers: OfferRecord[];
  sections: PublicSiteSection[];
  loading: boolean;
  onOpenConnection: (packageId?: string | null) => void;
  onNavigate: (path: string) => void;
}

export function OffersPage({
  offers,
  sections,
  loading,
  onOpenConnection,
  onNavigate,
}: OffersPageProps) {
  const headerSection = sections.find((s) => s.section_key === 'header');
  const extraSections = sections.filter((s) => s.section_key !== 'header');

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-8">
        <p className="text-xs font-medium text-slate-500">
          {headerSection?.content.kicker || 'Promotions'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F4D] sm:text-4xl">
          {headerSection?.content.heading || 'Special Promotional Offers'}
        </h1>
        <p className="mt-2.5 max-w-2xl text-base text-slate-600">
          {headerSection?.content.description ||
            'Verified active offers currently within their validity period. Expired or inactive promotions are automatically excluded.'}
        </p>
      </div>

      {loading ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-[#0B1F4D]">
            No Active Offers at This Moment
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Browse our standard monthly internet packages or check back soon for upcoming
            promotional rates.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/packages')}
            className="mt-6 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
          >
            Browse Internet Packages
          </button>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {offers.map((offer) => {
            const basePrice = offer.package_monthly_price ?? null;
            const finalPrice =
              basePrice !== null
                ? computeOfferPrice(basePrice, {
                    id: offer.id,
                    title: offer.title,
                    description: offer.description,
                    discount_type: offer.discount_type,
                    discount_value: offer.discount_value,
                    start_date: offer.start_date,
                    expiry_date: offer.expiry_date,
                  })
                : null;

            return (
              <article
                key={offer.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-7"
              >
                <div>
                  {offer.image_url && (
                    <div className="mb-5 h-44 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                      <ImageWithFallback
                        src={offer.image_url}
                        alt={offer.title}
                        className="h-full w-full object-cover"
                        fallbackTitle={offer.title}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#0B1F4D]">
                      {formatDiscountLabel(offer.discount_type, offer.discount_value)}
                    </span>
                    <span className="font-medium text-emerald-700">Active Offer</span>
                  </div>

                  <h2 className="mt-3 text-xl font-bold text-[#0B1F4D]">{offer.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {offer.description}
                  </p>

                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Applicable Package</dt>
                      <dd className="mt-1 font-medium text-[#0B1F4D]">
                        {offer.package_name
                          ? `${offer.package_name} (${offer.package_speed_mbps} Mbps)`
                          : 'All Active Packages'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Promotional Rate</dt>
                      <dd className="mt-1 font-mono font-semibold tabular-nums text-[#0B1F4D]">
                        {basePrice !== null && finalPrice !== null
                          ? `${formatBDT(finalPrice)} (was ${formatBDT(basePrice)})`
                          : formatDiscountLabel(offer.discount_type, offer.discount_value)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Start Date</dt>
                      <dd className="mt-1 font-mono text-xs tabular-nums text-slate-700">
                        {formatDate(offer.start_date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Expiry Date</dt>
                      <dd className="mt-1 font-mono text-xs tabular-nums text-slate-700">
                        {formatDate(offer.expiry_date)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 flex items-center justify-end border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => onOpenConnection(offer.package_id)}
                    className="rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
                  >
                    Request Connection with Offer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {extraSections.length > 0 && (
        <div className="mt-12 space-y-10">
          {extraSections.map((sec) => (
            <CustomSectionBlock
              key={sec.id}
              section={sec}
              onNavigate={onNavigate}
              onOpenConnection={onOpenConnection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
