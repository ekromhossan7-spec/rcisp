import { ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { CustomSectionBlock, triggerSectionCta } from '../../components/public/CustomSectionBlock';
import { PackageCard } from '../../components/public/PackageCard';
import { formatDate, formatDiscountLabel } from '../../lib/format';
import type { OfferRecord, PackageRecord, PublicSiteSection } from '../../types/isp';

interface HomePageProps {
  packages: PackageRecord[];
  offers: OfferRecord[];
  sections: PublicSiteSection[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
}

export function HomePage({
  packages,
  offers,
  sections,
  loading,
  onNavigate,
  onOpenConnection,
}: HomePageProps) {
  const safePackages = Array.isArray(packages) ? packages : [];
  const safeOffers = Array.isArray(offers) ? offers : [];
  const safeSections = Array.isArray(sections) ? sections : [];
  const previewPackages = safePackages.filter((p) => p.show_on_home).slice(0, 4);
  const previewOffers = safeOffers.filter((o) => o.show_on_home).slice(0, 3);

  if (loading && safeSections.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="h-12 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-20 w-5/6 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-slate-200 lg:col-span-6" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {safeSections.map((section, sectionIdx) => {
        const c = section.content;

        if (section.section_key === 'hero') {
          return (
            <section key={section.id} className="border-b border-slate-200 bg-white">
              <div className="mx-auto grid max-w-6xl items-stretch gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-20">
                <div className="flex flex-col justify-center lg:col-span-6">
                  {c.kicker && (
                    <p className="text-xs font-medium tracking-wide text-slate-500">{c.kicker}</p>
                  )}
                  <h1 className="mt-3 text-[clamp(2.15rem,4vw,3.35rem)] font-bold leading-[1.12] tracking-tight text-[#0B1F4D]">
                    {c.heading || 'Fast, Reliable Internet for Your Everyday Life.'}
                  </h1>
                  {c.description && (
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                      {c.description}
                    </p>
                  )}
                  <div className="mt-8 flex flex-wrap items-center gap-3.5">
                    {c.primary_cta_text && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerSectionCta(c.primary_cta_link, onNavigate, onOpenConnection)
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-5 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#132F70] whitespace-nowrap"
                      >
                        {c.primary_cta_text}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                    {c.secondary_cta_text && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerSectionCta(c.secondary_cta_link, onNavigate, onOpenConnection)
                        }
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-[#0B1F4D] transition-colors duration-150 hover:bg-[#EAF2FF] whitespace-nowrap"
                      >
                        {c.secondary_cta_text}
                      </button>
                    )}
                  </div>
                </div>

                {c.image_url && (
                  <div className="lg:col-span-6">
                    <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <ImageWithFallback
                        src={c.image_url}
                        alt={c.image_alt || c.heading || 'Roman Communication Broadband'}
                        className="h-full w-full object-cover"
                        fallbackTitle="Roman Communication Broadband"
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        }

        if (section.section_key === 'why_choose_us') {
          const items = c.items ?? [];
          return (
            <section key={section.id} className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-[#0B1F4D] sm:text-3xl">
                  {c.heading || 'Why Choose Roman Communication'}
                </h2>
                {c.description && (
                  <p className="mt-2.5 text-base text-slate-600">{c.description}</p>
                )}
              </div>

              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {item.index || String(idx + 1).padStart(2, '0')}.
                    </span>
                    <h3 className="mt-2.5 text-base font-semibold text-[#0B1F4D]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (section.section_key === 'packages_preview') {
          return (
            <section key={section.id} className="border-y border-slate-200 bg-white">
              <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#0B1F4D] sm:text-3xl">
                      {c.heading || 'Internet Packages'}
                    </h2>
                    {c.description && (
                      <p className="mt-2 text-base text-slate-600">{c.description}</p>
                    )}
                  </div>
                  {c.primary_cta_text && (
                    <button
                      type="button"
                      onClick={() =>
                        triggerSectionCta(
                          c.primary_cta_link || '/packages',
                          onNavigate,
                          onOpenConnection,
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B1F4D] hover:underline whitespace-nowrap"
                    >
                      {c.primary_cta_text}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                      />
                    ))}
                  </div>
                ) : previewPackages.length === 0 ? (
                  <div className="mt-10 rounded-xl border border-slate-200 bg-[#F8FAFC] p-8 text-center text-sm text-slate-600">
                    Packages are currently being updated. Contact our Sitakunda office for latest
                    plans.
                  </div>
                ) : (
                  <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {previewPackages.map((pkg, idx) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        featured={idx === 1}
                        onSelect={(pkgId) => onOpenConnection(pkgId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        }

        if (section.section_key === 'offers_preview') {
          if (previewOffers.length === 0) return null;
          return (
            <section
              key={section.id}
              className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
            >
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#0B1F4D] sm:text-3xl">
                    {c.heading || 'Current Promotional Offers'}
                  </h2>
                  {c.description && (
                    <p className="mt-2 text-base text-slate-600">{c.description}</p>
                  )}
                </div>
                {c.primary_cta_text && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerSectionCta(
                        c.primary_cta_link || '/offers',
                        onNavigate,
                        onOpenConnection,
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B1F4D] hover:underline whitespace-nowrap"
                  >
                    {c.primary_cta_text}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {previewOffers.map((offer) => (
                  <article
                    key={offer.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
                  >
                    <div>
                      {offer.image_url && (
                        <div className="mb-4 h-36 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          <ImageWithFallback
                            src={offer.image_url}
                            alt={offer.title}
                            className="h-full w-full object-cover"
                            fallbackTitle={offer.title}
                          />
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        <span>
                          {formatDiscountLabel(offer.discount_type, offer.discount_value)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>Valid until {formatDate(offer.expiry_date)}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-[#0B1F4D]">{offer.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {offer.description}
                      </p>
                      {offer.package_name && (
                        <p className="mt-4 text-xs font-medium text-[#0B1F4D]">
                          Applicable Package: {offer.package_name} (
                          <span className="font-mono">{offer.package_speed_mbps} Mbps</span>)
                        </p>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => onNavigate('/offers')}
                        className="text-sm font-medium text-[#0B1F4D] hover:underline"
                      >
                        View Offer
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenConnection(offer.package_id)}
                        className="rounded-lg bg-[#EAF2FF] px-3.5 py-1.5 text-xs font-semibold text-[#0B1F4D] transition-colors hover:bg-[#0B1F4D] hover:text-white"
                      >
                        Claim Connection
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.section_key === 'coverage_preview') {
          const zones = c.items ?? [];
          return (
            <section key={section.id} className="border-t border-slate-200 bg-white">
              <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8">
                {c.image_url && (
                  <div className="lg:col-span-6">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <ImageWithFallback
                        src={c.image_url}
                        alt={c.image_alt || c.heading || 'Sitakunda Coverage Zone'}
                        className="aspect-[16/10] w-full object-cover"
                        fallbackTitle="Sitakunda Coverage Zone"
                      />
                    </div>
                  </div>
                )}

                <div className={c.image_url ? 'lg:col-span-6' : 'lg:col-span-12'}>
                  {c.kicker && <p className="text-xs font-medium text-slate-500">{c.kicker}</p>}
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F4D] sm:text-3xl">
                    {c.heading || 'Confirmed Fiber Coverage in Sitakunda, Chattogram'}
                  </h2>
                  {c.description && (
                    <p className="mt-3 text-base leading-relaxed text-slate-600">
                      {c.description}
                    </p>
                  )}
                  {zones.length > 0 && (
                    <ul className="mt-5 grid grid-cols-2 gap-3 text-sm font-medium text-[#0B1F4D]">
                      {zones.map((zone, idx) => (
                        <li
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5"
                        >
                          {zone.title}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(c.primary_cta_text || c.secondary_cta_text) && (
                    <div className="mt-7 flex flex-wrap gap-3">
                      {c.primary_cta_text && (
                        <button
                          type="button"
                          onClick={() =>
                            triggerSectionCta(c.primary_cta_link, onNavigate, onOpenConnection)
                          }
                          className="rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
                        >
                          {c.primary_cta_text}
                        </button>
                      )}
                      {c.secondary_cta_text && (
                        <button
                          type="button"
                          onClick={() =>
                            triggerSectionCta(c.secondary_cta_link, onNavigate, onOpenConnection)
                          }
                          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50"
                        >
                          {c.secondary_cta_text}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        }

        if (section.section_key === 'cta_banner') {
          return (
            <section key={section.id} className="border-t border-slate-200 bg-[#0B1F4D] text-white">
              <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:px-8">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {c.heading || 'Ready for Reliable Broadband at Home or Work?'}
                  </h2>
                  {c.description && (
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-200 sm:text-base">
                      {c.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {c.primary_cta_text && (
                    <button
                      type="button"
                      onClick={() =>
                        triggerSectionCta(c.primary_cta_link, onNavigate, onOpenConnection)
                      }
                      className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0B1F4D] hover:bg-[#EAF2FF] whitespace-nowrap"
                    >
                      {c.primary_cta_text}
                    </button>
                  )}
                  {c.secondary_cta_text && (
                    <button
                      type="button"
                      onClick={() =>
                        triggerSectionCta(c.secondary_cta_link, onNavigate, onOpenConnection)
                      }
                      className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 whitespace-nowrap"
                    >
                      {c.secondary_cta_text}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        }

        return (
          <CustomSectionBlock
            key={section.id}
            section={section}
            onNavigate={onNavigate}
            onOpenConnection={onOpenConnection}
            alternateSurface={sectionIdx % 2 === 1}
          />
        );
      })}
    </div>
  );
}
