import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { ToastProvider, useToast } from './components/common/ToastContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { ConnectionModal } from './components/public/ConnectionModal';
import { adminAuthApi, publicApi } from './lib/api';
import { FALLBACK_PUBLIC_SITE, FALLBACK_SECTIONS, FALLBACK_SETTINGS } from './lib/publicDefaults';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminInquiriesPage } from './pages/admin/AdminInquiriesPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOffersPage } from './pages/admin/AdminOffersPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminPackagesPage } from './pages/admin/AdminPackagesPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminSubscriptionsPage } from './pages/admin/AdminSubscriptionsPage';
import { AboutPage } from './pages/public/AboutPage';
import { ContactPage } from './pages/public/ContactPage';
import { CoveragePage } from './pages/public/CoveragePage';
import { HomePage } from './pages/public/HomePage';
import { OffersPage } from './pages/public/OffersPage';
import { PackagesPage } from './pages/public/PackagesPage';
import type {
  AdminUser,
  CmsPageSlug,
  OfferRecord,
  PackageRecord,
  PageSeoData,
  PublicSitePayload,
} from './types/isp';

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

function getPageSlugFromPath(path: string): CmsPageSlug {
  if (path === '/about') return 'about';
  if (path === '/packages') return 'packages';
  if (path === '/offers') return 'offers';
  if (path === '/coverage') return 'coverage';
  if (path === '/contact') return 'contact';
  return 'home';
}

function upsertMetaTag(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!value) {
    if (el) el.setAttribute('content', '');
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function upsertLinkTag(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!href) {
    if (el && rel === 'canonical') el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function RouterContent() {
  const { showToast } = useToast();
  const [currentPath, setCurrentPath] = useState<string>(() =>
    normalizePath(window.location.pathname),
  );
  const [isPreviewQuery, setIsPreviewQuery] = useState<boolean>(
    () => new URLSearchParams(window.location.search).get('preview') === '1',
  );

  // Public catalog & CMS state
  const [packages, setPackages] = useState<PackageRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [sitePayload, setSitePayload] = useState<PublicSitePayload | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);

  // Connection modal state
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  // Admin auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authMode, setAuthMode] = useState<'env' | 'db'>('db');
  const [authStatusError, setAuthStatusError] = useState<string | null>(null);

  const navigate = useCallback(
    (to: string) => {
      const normalized = normalizePath(to);
      const keepPreview = isPreviewQuery && !normalized.startsWith('/admin');
      const targetUrl = keepPreview ? `${normalized}?preview=1` : normalized;
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.pushState({}, '', targetUrl);
      }
      setCurrentPath(normalized);
      if (normalized.startsWith('/admin')) {
        setIsPreviewQuery(false);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [isPreviewQuery],
  );

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
      setIsPreviewQuery(new URLSearchParams(window.location.search).get('preview') === '1');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isAdminRoute = currentPath.startsWith('/admin');

  const loadPublicCatalog = useCallback(async () => {
    setPublicLoading(true);
    try {
      const [siteRes, pkgRes, offerRes] = await Promise.all([
        publicApi.getSite(isPreviewQuery),
        publicApi.getPackages(),
        publicApi.getOffers(),
      ]);
      if (siteRes && Array.isArray(siteRes.sections) && siteRes.settings) {
        setSitePayload(siteRes);
      } else {
        setSitePayload(FALLBACK_PUBLIC_SITE);
      }
      setPackages(Array.isArray(pkgRes?.packages) ? pkgRes.packages : []);
      setOffers(Array.isArray(offerRes?.offers) ? offerRes.offers : []);
    } catch {
      // Fall back cleanly to built-in public content when backend API is unavailable (e.g. static hosting)
      setSitePayload((prev) => prev ?? FALLBACK_PUBLIC_SITE);
      setPackages((prev) => (Array.isArray(prev) ? prev : []));
      setOffers((prev) => (Array.isArray(prev) ? prev : []));
    } finally {
      setPublicLoading(false);
    }
  }, [isPreviewQuery]);

  useEffect(() => {
    if (!isAdminRoute) {
      loadPublicCatalog();
    }
  }, [isAdminRoute, loadPublicCatalog]);

  // Apply dynamic SEO metadata and favicon for the active public route
  const activeSlug = getPageSlugFromPath(currentPath);
  const activeSettings = sitePayload?.settings ?? FALLBACK_SETTINGS;

  useEffect(() => {
    if (isAdminRoute) {
      document.title = `Admin Portal | ${activeSettings.company_name}`;
      if (activeSettings.favicon_url) {
        upsertLinkTag('icon', activeSettings.favicon_url);
      }
      return;
    }

    const seo: PageSeoData | undefined = sitePayload?.seo?.[activeSlug];
    if (seo) {
      if (seo.seo_title) document.title = seo.seo_title;
      upsertMetaTag('name', 'description', seo.meta_description);
      upsertMetaTag('name', 'keywords', seo.meta_keywords);
      upsertMetaTag('property', 'og:title', seo.og_title || seo.seo_title);
      upsertMetaTag('property', 'og:description', seo.og_description || seo.meta_description);
      upsertMetaTag('property', 'og:image', seo.og_image_url);
      upsertMetaTag('name', 'twitter:title', seo.og_title || seo.seo_title);
      upsertMetaTag('name', 'twitter:description', seo.og_description || seo.meta_description);
      upsertLinkTag('canonical', seo.canonical_url);
    }
    if (activeSettings.favicon_url) {
      upsertLinkTag('icon', activeSettings.favicon_url);
    }
  }, [isAdminRoute, activeSlug, sitePayload, activeSettings]);

  // Verify admin session status when entering admin routes
  useEffect(() => {
    if (!isAdminRoute) return;
    let active = true;
    adminAuthApi
      .getStatus()
      .then((res) => {
        if (!active) return;
        setAdminUser(res.admin);
        setNeedsSetup(res.needsSetup);
        setAuthMode(res.authMode ?? 'db');
        setAuthStatusError(null);
        setAuthChecked(true);
        if (currentPath === '/admin' || (currentPath === '/admin/login' && res.authenticated)) {
          navigate(res.authenticated ? '/admin/dashboard' : '/admin/login');
        } else if (currentPath.startsWith('/admin/dashboard') && !res.authenticated) {
          navigate('/admin/login');
        }
      })
      .catch((err) => {
        if (!active) return;
        setAuthStatusError(err instanceof Error ? err.message : null);
        setAuthChecked(true);
        if (currentPath.startsWith('/admin/dashboard')) {
          navigate('/admin/login');
        }
      });
    return () => {
      active = false;
    };
  }, [isAdminRoute, currentPath, navigate]);

  function openConnectionModal(packageId: string | null = null) {
    setSelectedPackageId(packageId);
    setConnectionModalOpen(true);
  }

  async function handleLogout() {
    try {
      await adminAuthApi.logout();
    } catch {
      // Clear client state even if network hiccups
    }
    setAdminUser(null);
    showToast('Signed out of administrator dashboard.');
    navigate('/admin/login');
  }

  const activePageSections = useMemo(() => {
    const sections = Array.isArray(sitePayload?.sections)
      ? sitePayload.sections
      : FALLBACK_SECTIONS;
    return sections
      .filter((s) => s && s.page_slug === activeSlug)
      .sort((a, b) => a.section_order - b.section_order);
  }, [sitePayload, activeSlug]);

  // Render Admin Routes
  if (isAdminRoute) {
    if (!authChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm text-slate-600">
          Verifying administrator session...
        </div>
      );
    }

    if (!adminUser || currentPath === '/admin/login' || currentPath === '/admin') {
      return (
        <AdminLoginPage
          needsSetup={needsSetup}
          authMode={authMode}
          initialError={authStatusError}
          onNavigate={navigate}
          onSuccess={(admin) => {
            setAdminUser(admin);
            setNeedsSetup(false);
            setAuthStatusError(null);
            showToast(`Welcome back, ${admin.name}`);
            navigate('/admin/dashboard');
          }}
        />
      );
    }

    let adminContent = <AdminOverviewPage onNavigate={navigate} />;
    if (currentPath === '/admin/dashboard/packages') {
      adminContent = <AdminPackagesPage />;
    } else if (currentPath === '/admin/dashboard/offers') {
      adminContent = <AdminOffersPage />;
    } else if (currentPath === '/admin/dashboard/customers') {
      adminContent = <AdminCustomersPage />;
    } else if (currentPath === '/admin/dashboard/subscriptions') {
      adminContent = <AdminSubscriptionsPage />;
    } else if (currentPath === '/admin/dashboard/reports') {
      adminContent = <AdminReportsPage />;
    } else if (currentPath === '/admin/dashboard/inquiries') {
      adminContent = <AdminInquiriesPage />;
    } else if (currentPath === '/admin/dashboard/settings') {
      adminContent = <AdminSettingsPage onPublished={loadPublicCatalog} />;
    }

    return (
      <AdminLayout
        admin={adminUser}
        currentPath={currentPath}
        onNavigate={navigate}
        onLogout={handleLogout}
      >
        {adminContent}
      </AdminLayout>
    );
  }

  // Render Public Website
  let publicContent = (
    <HomePage
      packages={packages}
      offers={offers}
      sections={activePageSections}
      loading={publicLoading}
      onNavigate={navigate}
      onOpenConnection={openConnectionModal}
    />
  );

  if (currentPath === '/about') {
    publicContent = (
      <AboutPage
        sections={activePageSections}
        onOpenConnection={openConnectionModal}
        onNavigate={navigate}
      />
    );
  } else if (currentPath === '/packages') {
    publicContent = (
      <PackagesPage
        packages={packages}
        sections={activePageSections}
        loading={publicLoading}
        onNavigate={navigate}
        onOpenConnection={openConnectionModal}
      />
    );
  } else if (currentPath === '/offers') {
    publicContent = (
      <OffersPage
        offers={offers}
        sections={activePageSections}
        loading={publicLoading}
        onOpenConnection={openConnectionModal}
        onNavigate={navigate}
      />
    );
  } else if (currentPath === '/coverage') {
    publicContent = (
      <CoveragePage
        sections={activePageSections}
        settings={activeSettings}
        onNavigate={navigate}
        onOpenConnection={openConnectionModal}
      />
    );
  } else if (currentPath === '/contact') {
    publicContent = (
      <ContactPage
        sections={activePageSections}
        settings={activeSettings}
        onNavigate={navigate}
        onOpenConnection={openConnectionModal}
      />
    );
  }

  return (
    <>
      <PublicLayout
        currentPath={currentPath}
        settings={activeSettings}
        isPreview={Boolean(sitePayload?.isPreview)}
        onNavigate={navigate}
        onOpenConnection={openConnectionModal}
      >
        {publicContent}
      </PublicLayout>

      <ConnectionModal
        open={connectionModalOpen}
        packages={packages}
        preselectedPackageId={selectedPackageId}
        onClose={() => setConnectionModalOpen(false)}
      />
    </>
  );
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Unexpected application error.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-[#0B1F4D]">Roman Communication</h1>
            <p className="mt-2 text-sm text-slate-600">
              Unable to display this view right now. Please reload the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ToastProvider>
        <RouterContent />
      </ToastProvider>
    </AppErrorBoundary>
  );
}
