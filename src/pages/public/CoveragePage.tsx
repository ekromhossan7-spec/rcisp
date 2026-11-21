import { useState, type FormEvent } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { CustomSectionBlock } from '../../components/public/CustomSectionBlock';
import { publicApi } from '../../lib/api';
import type { PublicSiteSection, WebsiteSettingsMap } from '../../types/isp';

interface CoveragePageProps {
  sections: PublicSiteSection[];
  settings: WebsiteSettingsMap;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
}

export function CoveragePage({
  sections,
  settings,
  onNavigate,
  onOpenConnection,
}: CoveragePageProps) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const headerSection = sections.find((s) => s.section_key === 'header');
  const zonesSection = sections.find((s) => s.section_key === 'confirmed_zones');
  const extraSections = sections.filter(
    (s) => s.section_key !== 'header' && s.section_key !== 'confirmed_zones',
  );

  const zones = zonesSection?.content.items ?? [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await publicApi.submitInquiry({
        type: 'coverage',
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        inquiry_type: 'Coverage Check',
        message: message.trim(),
      });
      setSubmittedRef(res.reference);
      setFullName('');
      setMobile('');
      setAddress('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit coverage inquiry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-8">
        <p className="text-xs font-medium text-slate-500">
          {headerSection?.content.kicker || 'Network Footprint'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F4D] sm:text-4xl">
          {headerSection?.content.heading || 'Coverage Area'}
        </h1>
        <p className="mt-2.5 max-w-2xl text-base text-slate-600">
          {headerSection?.content.description ||
            'Confirmed optical fiber availability in Gulahammad, Masajidda, Sitakunda, Chattogram. Only verified active service zones are listed below.'}
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {headerSection?.content.image_url && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <ImageWithFallback
                src={headerSection.content.image_url}
                alt={headerSection.content.image_alt || 'Sitakunda broadband service area'}
                className="aspect-[16/9] w-full object-cover"
                fallbackTitle="Sitakunda Service Area"
              />
            </div>
          )}

          {zonesSection && (
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-[#0B1F4D]">
                {zonesSection.content.heading || 'Confirmed Service Locations'}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {zonesSection.content.description || `Main Office: ${settings.address}`}
              </p>
              {settings.google_maps_url && (
                <p className="mt-2 text-xs">
                  <a
                    href={settings.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#0B1F4D] underline"
                  >
                    Open Location in Google Maps
                  </a>
                </p>
              )}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {zones.map((zone, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1F4D]">
                      <MapPin className="h-4 w-4 shrink-0 text-[#0B1F4D]" />
                      <span>{zone.title}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {zone.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-[#0B1F4D]">Coverage Inquiry Form</h2>
            <p className="mt-1 text-sm text-slate-600">
              Share your exact house or shop location to confirm optical port availability.
            </p>

            {submittedRef ? (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
                <h3 className="mt-3 text-base font-semibold text-[#0B1F4D]">
                  Coverage Check Submitted
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Reference <span className="font-mono font-semibold">{submittedRef}</span>.
                  Our Sitakunda field team will confirm port availability on your mobile
                  number.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedRef(null)}
                  className="mt-4 rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70]"
                >
                  Submit Another Location
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>

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
                    Full Location / Landmark *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Near Masajidda Bazar, Sitakunda"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Building floor, connection type (home or business)"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#0B1F4D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Check Coverage Availability'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

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
