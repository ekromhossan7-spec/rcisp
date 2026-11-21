import { useMemo, useState } from 'react';
import { CustomSectionBlock } from '../../components/public/CustomSectionBlock';
import { PackageCard } from '../../components/public/PackageCard';
import type { PackageRecord, PublicSiteSection } from '../../types/isp';

interface PackagesPageProps {
  packages: PackageRecord[];
  sections: PublicSiteSection[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
}

export function PackagesPage({
  packages,
  sections,
  loading,
  onNavigate,
  onOpenConnection,
}: PackagesPageProps) {
  const [tier, setTier] = useState<'all' | 'home' | 'high'>('all');

  const safeSections = Array.isArray(sections) ? sections : [];
  const safePackages = Array.isArray(packages) ? packages : [];
  const headerSection = safeSections.find((s) => s.section_key === 'header');
  const extraSections = safeSections.filter((s) => s.section_key !== 'header');

  const filtered = useMemo(() => {
    if (tier === 'home') return safePackages.filter((p) => p.speed_mbps <= 25);
    if (tier === 'high') return safePackages.filter((p) => p.speed_mbps > 25);
    return safePackages;
  }, [safePackages, tier]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 border-b border-slate-200 pb-8 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {headerSection?.content.kicker || 'Broadband Plans'}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F4D] sm:text-4xl">
            {headerSection?.content.heading || 'Internet Packages'}
          </h1>
          <p className="mt-2.5 max-w-2xl text-base text-slate-600">
            {headerSection?.content.description ||
              'All active fiber broadband plans from Roman Communication. Select a package to request installation in Gulahammad, Masajidda, or Sitakunda.'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter internet packages"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
        >
          <button
            type="button"
            onClick={() => setTier('all')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tier === 'all'
                ? 'bg-[#0B1F4D] text-white'
                : 'text-slate-600 hover:text-[#0B1F4D]'
            }`}
          >
            All Plans
          </button>
          <button
            type="button"
            onClick={() => setTier('home')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tier === 'home'
                ? 'bg-[#0B1F4D] text-white'
                : 'text-slate-600 hover:text-[#0B1F4D]'
            }`}
          >
            Up to 25 Mbps
          </button>
          <button
            type="button"
            onClick={() => setTier('high')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tier === 'high'
                ? 'bg-[#0B1F4D] text-white'
                : 'text-slate-600 hover:text-[#0B1F4D]'
            }`}
          >
            Above 25 Mbps
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-base font-medium text-[#0B1F4D]">
            No packages match this speed filter.
          </p>
          <button
            type="button"
            onClick={() => setTier('all')}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50"
          >
            Show All Packages
          </button>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pkg, idx) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              featured={tier === 'all' && idx === 1}
              onSelect={(id) => onOpenConnection(id)}
            />
          ))}
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
