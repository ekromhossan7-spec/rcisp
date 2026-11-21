import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { CustomSectionBlock } from '../../components/public/CustomSectionBlock';
import { publicApi } from '../../lib/api';
import type { PublicSiteSection, WebsiteSettingsMap } from '../../types/isp';

interface ContactPageProps {
  sections: PublicSiteSection[];
  settings: WebsiteSettingsMap;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
}

export function ContactPage({
  sections,
  settings,
  onNavigate,
  onOpenConnection,
}: ContactPageProps) {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [inquiryType, setInquiryType] = useState('New Connection');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const safeSections = Array.isArray(sections) ? sections : [];
  const headerSection = safeSections.find((s) => s.section_key === 'header');
  const extraSections = safeSections.filter((s) => s.section_key !== 'header');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await publicApi.submitInquiry({
        type: 'contact',
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        inquiry_type: inquiryType,
        message: message.trim(),
      });
      setSubmittedRef(res.reference);
      setFullName('');
      setMobile('');
      setAddress('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-8">
        <p className="text-xs font-medium text-slate-500">
          {headerSection?.content.kicker || 'Get in Touch'}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1F4D] sm:text-4xl">
          {headerSection?.content.heading || 'Contact Us'}
        </h1>
        <p className="mt-2.5 max-w-2xl text-base text-slate-600">
          {headerSection?.content.description ||
            'Reach out to Roman Communication for new broadband installations, package upgrades, or technical assistance in Sitakunda.'}
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-[#0B1F4D]">Office Information</h2>
            <dl className="mt-5 space-y-5 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F4D]" />
                <div>
                  <dt className="font-medium text-[#0B1F4D]">
                    {settings.company_name || 'Roman Communication'}
                  </dt>
                  <dd className="mt-0.5 text-slate-600">{settings.address}</dd>
                  {settings.google_maps_url && (
                    <dd className="mt-1 text-xs">
                      <a
                        href={settings.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#0B1F4D] underline"
                      >
                        View on Google Maps
                      </a>
                    </dd>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F4D]" />
                <div>
                  <dt className="font-medium text-[#0B1F4D]">Phone</dt>
                  <dd className="mt-0.5 text-slate-600">
                    {settings.phone || 'To be provided (Support & Sales Desk)'}
                  </dd>
                </div>
              </div>
              {settings.whatsapp && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F4D]" />
                  <div>
                    <dt className="font-medium text-[#0B1F4D]">WhatsApp</dt>
                    <dd className="mt-0.5 text-slate-600">{settings.whatsapp}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#0B1F4D]" />
                <div>
                  <dt className="font-medium text-[#0B1F4D]">Email & Social</dt>
                  <dd className="mt-0.5 text-slate-600">
                    Email: {settings.email || 'To be provided'}
                  </dd>
                  <dd className="mt-0.5 text-slate-600">
                    Facebook:{' '}
                    {settings.facebook_url ? (
                      <a
                        href={settings.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#0B1F4D] underline"
                      >
                        {settings.company_name}
                      </a>
                    ) : (
                      settings.company_name
                    )}
                  </dd>
                  {settings.other_social_links?.map((link, idx) => (
                    <dd key={idx} className="mt-0.5 text-slate-600">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#0B1F4D] underline"
                      >
                        {link.label}
                      </a>
                    </dd>
                  ))}
                </div>
              </div>
            </dl>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
            <h2 className="text-lg font-semibold text-[#0B1F4D]">Send Us a Message</h2>

            {submittedRef ? (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
                <h3 className="mt-3 text-base font-semibold text-[#0B1F4D]">
                  Message Received
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  Reference <span className="font-mono font-semibold">{submittedRef}</span>.
                  Thank you for contacting {settings.company_name || 'Roman Communication'}.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedRef(null)}
                  className="mt-4 rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70]"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full name"
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Gulahammad, Masajidda, Sitakunda"
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Inquiry Type *
                    </label>
                    <select
                      value={inquiryType}
                      onChange={(e) => setInquiryType(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    >
                      <option value="New Connection">New Connection</option>
                      <option value="Package Upgrade">Package Upgrade</option>
                      <option value="Coverage Check">Coverage Check</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="General Inquiry">General Inquiry</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Message *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can our Sitakunda team assist you?"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
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
