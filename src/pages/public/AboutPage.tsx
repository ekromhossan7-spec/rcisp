import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { CustomSectionBlock, triggerSectionCta } from '../../components/public/CustomSectionBlock';
import type { PublicSiteSection } from '../../types/isp';

interface AboutPageProps {
  sections: PublicSiteSection[];
  onOpenConnection: (packageId?: string | null) => void;
  onNavigate: (path: string) => void;
}

export function AboutPage({ sections, onOpenConnection, onNavigate }: AboutPageProps) {
  const safeSections = Array.isArray(sections) ? sections : [];

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
      {safeSections.map((section) => {
        const c = section.content;

        if (section.section_key === 'intro') {
          return (
            <div key={section.id} className="grid items-stretch gap-10 lg:grid-cols-12">
              <div className="flex flex-col justify-center lg:col-span-6">
                {c.kicker && <p className="text-xs font-medium text-slate-500">{c.kicker}</p>}
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F4D] sm:text-4xl">
                  {c.heading || 'Dependable Local Broadband Built for Sitakunda.'}
                </h1>
                {c.description && (
                  <p className="mt-4 text-base leading-relaxed text-slate-600">{c.description}</p>
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

              {c.image_url && (
                <div className="lg:col-span-6">
                  <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <ImageWithFallback
                      src={c.image_url}
                      alt={c.image_alt || c.heading || 'Optical Fiber Infrastructure'}
                      className="h-full w-full object-cover"
                      fallbackTitle="Optical Fiber Infrastructure"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        }

        if (section.section_key === 'mission_vision') {
          const items = c.items ?? [];
          return (
            <div key={section.id}>
              {c.heading && (
                <h2 className="mb-6 text-2xl font-bold text-[#0B1F4D]">{c.heading}</h2>
              )}
              <div className="grid gap-6 md:grid-cols-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="text-lg font-semibold text-[#0B1F4D]">{item.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (section.section_key === 'why_subscribers') {
          const items = c.items ?? [];
          return (
            <section
              key={section.id}
              className="rounded-xl border border-slate-200 bg-white p-8 sm:p-10"
            >
              <h2 className="text-2xl font-bold text-[#0B1F4D]">
                {c.heading || 'Why Subscribers Choose Roman Communication'}
              </h2>
              {c.description && (
                <p className="mt-2 text-sm text-slate-600">{c.description}</p>
              )}
              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                {items.map((item, idx) => (
                  <div key={idx}>
                    <h3 className="text-base font-semibold text-[#0B1F4D]">
                      {item.index ? `${item.index}. ` : ''}
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  </div>
                ))}
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
          />
        );
      })}
    </div>
  );
}
