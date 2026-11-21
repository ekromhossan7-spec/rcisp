import { useState, type ReactNode } from 'react';
import { Eye, Menu, X } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import type { WebsiteSettingsMap } from '../../types/isp';

interface PublicLayoutProps {
  currentPath: string;
  settings: WebsiteSettingsMap;
  isPreview?: boolean;
  onNavigate: (path: string) => void;
  onOpenConnection: (packageId?: string | null) => void;
  children: ReactNode;
}

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Packages', path: '/packages' },
  { label: 'Offers', path: '/offers' },
  { label: 'Coverage', path: '/coverage' },
  { label: 'Contact', path: '/contact' },
];

export function PublicLayout({
  currentPath,
  settings,
  isPreview = false,
  onNavigate,
  onOpenConnection,
  children,
}: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleNav(path: string) {
    setMobileMenuOpen(false);
    onNavigate(path);
  }

  const brandName = settings.company_name || 'Roman Communication';
  const logoSrc = settings.logo_url || '/assets/aistudio/image_4c43d9bf.png';
  const logoAlt = settings.logo_alt || `${brandName} Logo`;
  const ctaLabel = settings.header_cta_text || 'Get Connection';

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0B1F4D]">
      {isPreview && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              Draft Preview Mode — Showing unpublished website edits visible only to signed-in
              administrators.
            </span>
            <a
              href="/admin/dashboard/settings"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/admin/dashboard/settings');
              }}
              className="font-semibold text-[#0B1F4D] underline whitespace-nowrap"
            >
              Return to CMS Settings
            </a>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:gap-8 lg:px-8">
          {/* Zone 1: Brand Mark (Logo centered directly above compact company name) */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/');
            }}
            className="flex shrink-0 flex-col items-center gap-0.5 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B1F4D]"
          >
            <ImageWithFallback
              src={logoSrc}
              alt={logoAlt}
              className="h-7 w-auto object-contain sm:h-8"
              fallbackTitle={brandName}
            />
            <span className="whitespace-nowrap shrink-0 text-[11px] font-bold leading-none tracking-tight text-[#0B1F4D] sm:text-xs">
              {brandName}
            </span>
          </a>

          {/* Zone 2: Primary Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden items-center gap-4 md:flex lg:gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const active =
                item.path === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(item.path);
                  }}
                  className={`whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'border-[#0B1F4D] text-[#0B1F4D]'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-[#0B1F4D]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenConnection(null)}
              className="hidden whitespace-nowrap shrink-0 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#132F70] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F4D] sm:inline-flex"
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-[#0B1F4D] hover:bg-slate-50 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.path === '/'
                    ? currentPath === '/'
                    : currentPath.startsWith(item.path);
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav(item.path);
                    }}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-[#EAF2FF] text-[#0B1F4D]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenConnection(null);
                }}
                className="w-full rounded-lg bg-[#0B1F4D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#132F70]"
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="inline-flex flex-col items-center gap-1 text-center">
                <ImageWithFallback
                  src={logoSrc}
                  alt={logoAlt}
                  className="h-10 w-auto object-contain"
                  fallbackTitle={brandName}
                />
                <span className="text-xs font-bold leading-tight tracking-tight text-[#0B1F4D]">
                  {brandName}
                </span>
              </div>
              {settings.footer_description && (
                <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
                  {settings.footer_description}
                </p>
              )}
              {settings.address && (
                <p className="mt-3 text-sm font-medium text-[#0B1F4D]">{settings.address}</p>
              )}
              {settings.google_maps_url && (
                <p className="mt-1.5 text-xs">
                  <a
                    href={settings.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#0B1F4D] underline"
                  >
                    View Office Location on Google Maps
                  </a>
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#0B1F4D]">Quick Links</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                {NAV_ITEMS.map((item) => (
                  <li key={item.path}>
                    <a
                      href={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNav(item.path);
                      }}
                      className="hover:text-[#0B1F4D] hover:underline"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#0B1F4D]">Contact & Access</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                {settings.address && <li>Office: {settings.address}</li>}
                {settings.phone && <li>Phone: {settings.phone}</li>}
                {settings.whatsapp && <li>WhatsApp: {settings.whatsapp}</li>}
                {settings.email && <li>Email: {settings.email}</li>}
                <li>
                  Facebook:{' '}
                  {settings.facebook_url ? (
                    <a
                      href={settings.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0B1F4D] hover:underline"
                    >
                      {brandName}
                    </a>
                  ) : (
                    <span>{brandName} Official</span>
                  )}
                </li>
                {settings.other_social_links?.map((link, idx) => (
                  <li key={idx}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#0B1F4D] hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li className="pt-2">
                  <a
                    href="/admin/login"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/admin/login');
                    }}
                    className="font-medium text-[#0B1F4D] hover:underline"
                  >
                    Admin Portal
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
            <p>
              {settings.footer_copyright ||
                `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}
            </p>
            <p>{settings.footer_subtext || settings.company_tagline}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
