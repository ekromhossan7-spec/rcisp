import { ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import type { PublicSiteSection } from '../../types/isp';

interface CustomSectionBlockProps {
  section: PublicSiteSection;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
  alternateSurface?: boolean;
}

export function triggerSectionCta(
  link: string | undefined,
  onNavigate: (path: string) => void,
  onOpenConnection: (packageId?: string | null) => void,
) {
  const target = (link || '').trim();
  if (!target || target === '#connect') {
    onOpenConnection(null);
    return;
  }
  if (target.startsWith('/')) {
    onNavigate(target);
    return;
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    window.location.assign(target);
  }
}

export function CustomSectionBlock({
  section,
  onNavigate,
  onOpenConnection,
  alternateSurface = false,
}: CustomSectionBlockProps) {
  const { content } = section;
  const hasImage = Boolean(content.image_url);
  const items = content.items ?? [];

  return (
    <section
      className={
        alternateSurface
          ? 'border-y border-slate-200 bg-white'
          : 'mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8'
      }
    >
      <div className={alternateSurface ? 'mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8' : ''}>
        <div
          className={
            hasImage ? 'grid items-center gap-10 lg:grid-cols-12' : 'max-w-3xl'
          }
        >
          <div className={hasImage ? 'lg:col-span-6' : ''}>
            {content.kicker && (
              <p className="text-xs font-medium tracking-wide text-slate-500">
                {content.kicker}
              </p>
            )}
            {content.heading && (
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F4D] sm:text-3xl">
                {content.heading}
              </h2>
            )}
            {content.description && (
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                {content.description}
              </p>
            )}
            {content.secondary_description && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {content.secondary_description}
              </p>
            )}

            {(content.primary_cta_text || content.secondary_cta_text) && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {content.primary_cta_text && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerSectionCta(
                        content.primary_cta_link,
                        onNavigate,
                        onOpenConnection,
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
                  >
                    {content.primary_cta_text}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                {content.secondary_cta_text && (
                  <button
                    type="button"
                    onClick={() =>
                      triggerSectionCta(
                        content.secondary_cta_link,
                        onNavigate,
                        onOpenConnection,
                      )
                    }
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-[#0B1F4D] hover:bg-[#EAF2FF]"
                  >
                    {content.secondary_cta_text}
                  </button>
                )}
              </div>
            )}
          </div>

          {hasImage && content.image_url && (
            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <ImageWithFallback
                  src={content.image_url}
                  alt={content.image_alt || content.heading || section.section_title}
                  className="aspect-[16/10] w-full object-cover"
                  fallbackTitle={content.heading || section.section_title}
                />
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                {item.index && (
                  <span className="font-mono text-xs font-semibold text-slate-400">
                    {item.index}.
                  </span>
                )}
                <h3 className="mt-2 text-base font-semibold text-[#0B1F4D]">{item.title}</h3>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
