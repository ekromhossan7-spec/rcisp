import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MediaPickerModal, readFileAsBase64 } from '../../components/admin/MediaPickerModal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';
import { useToast } from '../../components/common/ToastContext';
import { adminApi } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type {
  AuditLogRecord,
  CmsAdminWorkspacePayload,
  CmsPageSlug,
  MediaAssetRecord,
  PageContentRecord,
  PageSectionContent,
  PageSeoData,
  WebsiteSettingsMap,
} from '../../types/isp';

interface AdminSettingsPageProps {
  onPublished?: () => void;
}

type SettingsTab = 'pages' | 'global' | 'media' | 'seo' | 'audit';

const PAGE_LABELS: Array<{ slug: CmsPageSlug; label: string; route: string }> = [
  { slug: 'home', label: 'Home Page', route: '/' },
  { slug: 'about', label: 'About Us', route: '/about' },
  { slug: 'packages', label: 'Internet Packages', route: '/packages' },
  { slug: 'offers', label: 'Offers', route: '/offers' },
  { slug: 'coverage', label: 'Coverage Area', route: '/coverage' },
  { slug: 'contact', label: 'Contact Us', route: '/contact' },
];

const MEDIA_CATEGORIES = [
  'general',
  'hero',
  'banner',
  'about',
  'package',
  'offer',
  'logo',
  'seo',
] as const;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminSettingsPage({ onPublished }: AdminSettingsPageProps) {
  const { showToast } = useToast();
  const [workspace, setWorkspace] = useState<CmsAdminWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('pages');

  // Publishing & preview controls
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRoute, setPreviewRoute] = useState('/');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewNonce, setPreviewNonce] = useState(0);

  // Page Content Tab State
  const [selectedPage, setSelectedPage] = useState<CmsPageSlug>('home');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionVisible, setSectionVisible] = useState(true);
  const [sectionContent, setSectionContent] = useState<PageSectionContent>({});
  const [savingSection, setSavingSection] = useState(false);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<PageContentRecord | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);

  // Add Custom Section Modal State
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionHeading, setNewSectionHeading] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [creatingSection, setCreatingSection] = useState(false);

  // Global Settings Tab State
  const [settingsForm, setSettingsForm] = useState<WebsiteSettingsMap | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // SEO Tab State
  const [selectedSeoPage, setSelectedSeoPage] = useState<CmsPageSlug>('home');
  const [seoForm, setSeoForm] = useState<PageSeoData | null>(null);
  const [savingSeo, setSavingSeo] = useState(false);

  // Media Library Tab State
  const [uploadCategory, setUploadCategory] = useState<string>('general');
  const [uploadAlt, setUploadAlt] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaAlts, setMediaAlts] = useState<Record<string, string>>({});
  const [deleteMediaTarget, setDeleteMediaTarget] = useState<MediaAssetRecord | null>(null);
  const [deletingMedia, setDeletingMedia] = useState(false);

  // Shared Media Picker Modal Target
  const [mediaPickerConfig, setMediaPickerConfig] = useState<{
    open: boolean;
    target: 'section' | 'logo' | 'favicon' | 'seo';
    category: string;
    selectedUrl?: string;
  }>({ open: false, target: 'section', category: 'general' });

  // Audit Trail Tab State
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const data = await adminApi.getCmsWorkspace();
      setWorkspace(data);
      setSettingsForm(data.draftSettings);
      const nextAlts: Record<string, string> = {};
      for (const item of data.media) {
        nextAlts[item.id] = item.alt_text;
      }
      setMediaAlts(nextAlts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load CMS workspace.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoadingAudit(true);
    try {
      const res = await adminApi.getAuditLogs();
      setAuditLogs(res.logs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load audit logs.', 'error');
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Derived active page sections
  const pageSections = useMemo(() => {
    if (!workspace || !Array.isArray(workspace.sections)) return [];
    return workspace.sections
      .filter((s) => s.page_slug === selectedPage && !s.deleted_in_draft)
      .sort((a, b) => a.draft_order - b.draft_order);
  }, [workspace, selectedPage]);

  // Sync selected section when page changes or workspace updates
  useEffect(() => {
    if (pageSections.length === 0) {
      setSelectedSectionId(null);
      return;
    }
    const existing = pageSections.find((s) => s.id === selectedSectionId) || pageSections[0];
    setSelectedSectionId(existing.id);
    setSectionTitle(existing.section_title);
    setSectionVisible(existing.draft_visible);
    setSectionContent({
      ...existing.draft_content,
      items: existing.draft_content.items
        ? existing.draft_content.items.map((item) => ({ ...item }))
        : undefined,
    });
  }, [selectedPage, pageSections.length, workspace]);

  function selectSection(section: PageContentRecord) {
    setSelectedSectionId(section.id);
    setSectionTitle(section.section_title);
    setSectionVisible(section.draft_visible);
    setSectionContent({
      ...section.draft_content,
      items: section.draft_content.items
        ? section.draft_content.items.map((item) => ({ ...item }))
        : undefined,
    });
  }

  // Sync SEO form when selectedSeoPage or workspace updates
  useEffect(() => {
    if (!workspace) return;
    const rec = workspace.seoRecords.find((r) => r.page_slug === selectedSeoPage);
    if (rec) {
      setSeoForm({ ...rec.draft_seo });
    }
  }, [selectedSeoPage, workspace]);

  async function handleSaveSection(e: FormEvent) {
    e.preventDefault();
    if (!selectedSectionId) return;
    setSavingSection(true);
    try {
      const cleanedItems = sectionContent.items
        ?.map((item) => ({
          index: item.index?.trim() || undefined,
          title: item.title.trim(),
          description: item.description.trim(),
        }))
        .filter((item) => item.title.length > 0);

      const payload: PageSectionContent = {
        ...sectionContent,
        items: cleanedItems && cleanedItems.length > 0 ? cleanedItems : sectionContent.items ? [] : undefined,
      };

      const res = await adminApi.updateCmsSection(selectedSectionId, {
        section_title: sectionTitle.trim(),
        draft_content: payload,
        draft_visible: sectionVisible,
      });
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save section draft.', 'error');
    } finally {
      setSavingSection(false);
    }
  }

  async function handleToggleVisibility(section: PageContentRecord) {
    try {
      const res = await adminApi.toggleCmsSectionVisibility(section.id, !section.draft_visible);
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update visibility.', 'error');
    }
  }

  async function handleMoveSection(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= pageSections.length) return;
    const reordered = [...pageSections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    try {
      const res = await adminApi.reorderCmsSections(
        selectedPage,
        reordered.map((s) => s.id),
      );
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to reorder sections.', 'error');
    }
  }

  async function handleCreateSection(e: FormEvent) {
    e.preventDefault();
    setCreatingSection(true);
    try {
      const res = await adminApi.createCmsSection({
        page_slug: selectedPage,
        section_title: newSectionTitle.trim(),
        draft_content: {
          heading: newSectionHeading.trim(),
          description: newSectionDesc.trim(),
          items: [],
        },
        draft_visible: true,
      });
      showToast(res.message);
      setAddSectionOpen(false);
      setNewSectionTitle('');
      setNewSectionHeading('');
      setNewSectionDesc('');
      setSelectedSectionId(res.id);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add section.', 'error');
    } finally {
      setCreatingSection(false);
    }
  }

  async function handleDeleteSection() {
    if (!deleteSectionTarget) return;
    setDeletingSection(true);
    try {
      const res = await adminApi.deleteCmsSection(deleteSectionTarget.id);
      showToast(res.message);
      setDeleteSectionTarget(null);
      setSelectedSectionId(null);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove section.', 'error');
    } finally {
      setDeletingSection(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settingsForm) return;
    setSavingSettings(true);
    try {
      const cleanedLinks = settingsForm.other_social_links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.label.length > 0 && l.url.length > 0);
      const res = await adminApi.saveWebsiteSettings({
        ...settingsForm,
        other_social_links: cleanedLinks,
      });
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save settings draft.', 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveSeo(e: FormEvent) {
    e.preventDefault();
    if (!seoForm) return;
    setSavingSeo(true);
    try {
      const res = await adminApi.savePageSeo(selectedSeoPage, seoForm);
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save SEO draft.', 'error');
    } finally {
      setSavingSeo(false);
    }
  }

  async function handleUploadMedia(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast('Unsupported image type. Use PNG, JPEG, WebP, GIF, or ICO.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('File exceeds 2 MB size limit.', 'error');
      return;
    }

    setUploadingMedia(true);
    try {
      const base64 = await readFileAsBase64(file);
      await adminApi.uploadMedia({
        file_name: file.name,
        file_type: file.type,
        alt_text: uploadAlt.trim() || file.name.replace(/\.[^.]+$/, ''),
        category: uploadCategory,
        data_base64: base64,
      });
      showToast('Image uploaded to Media Library.');
      setUploadAlt('');
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleReplaceMedia(asset: MediaAssetRecord, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      showToast('Unsupported image type. Use PNG, JPEG, WebP, GIF, or ICO.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('File exceeds 2 MB size limit.', 'error');
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      const res = await adminApi.replaceMedia(asset.id, {
        file_name: file.name,
        file_type: file.type,
        alt_text: mediaAlts[asset.id] ?? asset.alt_text,
        category: asset.category,
        data_base64: base64,
      });
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to replace image.', 'error');
    }
  }

  async function handleSaveMediaAlt(asset: MediaAssetRecord) {
    try {
      const res = await adminApi.updateMediaAlt(asset.id, {
        alt_text: mediaAlts[asset.id] ?? '',
      });
      showToast(res.message);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update alt text.', 'error');
    }
  }

  async function handleDeleteMedia() {
    if (!deleteMediaTarget) return;
    setDeletingMedia(true);
    try {
      const res = await adminApi.deleteMedia(deleteMediaTarget.id);
      showToast(res.message);
      setDeleteMediaTarget(null);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete image.', 'error');
    } finally {
      setDeletingMedia(false);
    }
  }

  async function handlePublishAll() {
    setPublishing(true);
    try {
      const res = await adminApi.publishCms();
      showToast(res.message);
      await loadWorkspace();
      onPublished?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to publish changes.', 'error');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscardAll() {
    setDiscarding(true);
    try {
      const res = await adminApi.discardCms();
      showToast(res.message);
      setDiscardConfirmOpen(false);
      await loadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to discard drafts.', 'error');
    } finally {
      setDiscarding(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Image path copied.');
    } catch {
      showToast(`Image URL: ${url}`);
    }
  }

  const activeSectionRecord = pageSections.find((s) => s.id === selectedSectionId) || null;
  const currentSeoRecord = workspace?.seoRecords.find((r) => r.page_slug === selectedSeoPage) || null;
  const unpublishedCount = workspace?.unpublishedCount ?? 0;

  return (
    <div className="space-y-6">
      {/* Header & Preview / Publish Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F4D]">
            Website Settings & CMS
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Customize public page content, images, global contact details, and SEO metadata.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mr-1 text-right">
            <p
              className={`text-xs font-semibold tabular-nums ${
                unpublishedCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {unpublishedCount > 0
                ? `${unpublishedCount} unpublished draft change${unpublishedCount === 1 ? '' : 's'}`
                : 'Live website is up to date'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPreviewNonce((n) => n + 1);
              setPreviewOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-[#0B1F4D] hover:bg-slate-50 whitespace-nowrap"
          >
            <Eye className="h-4 w-4" />
            Preview Draft
          </button>

          {unpublishedCount > 0 && (
            <button
              type="button"
              onClick={() => setDiscardConfirmOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              Discard Drafts
            </button>
          )}

          <button
            type="button"
            disabled={publishing || unpublishedCount === 0}
            onClick={handlePublishAll}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-50 whitespace-nowrap"
          >
            <Globe className="h-4 w-4" />
            {publishing ? 'Publishing...' : 'Publish Changes'}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl border-x border-t">
        {[
          { id: 'pages' as const, label: 'Page Content', icon: Layers },
          { id: 'global' as const, label: 'Global Settings', icon: Globe },
          { id: 'media' as const, label: 'Media Library', icon: ImageIcon },
          { id: 'seo' as const, label: 'SEO Settings', icon: Search },
          { id: 'audit' as const, label: 'Audit Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'border-[#0B1F4D] text-[#0B1F4D]'
                  : 'border-transparent text-slate-500 hover:text-[#0B1F4D]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading || !workspace ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          {/* TAB 1: PAGE CONTENT MANAGEMENT */}
          {activeTab === 'pages' && (
            <div className="space-y-5">
              {/* Page Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {PAGE_LABELS.map((p) => {
                    const active = selectedPage === p.slug;
                    const pageHasDraft = workspace.sections.some(
                      (s) => s.page_slug === p.slug && s.has_unpublished_changes,
                    );
                    return (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => {
                          setSelectedPage(p.slug);
                          setSelectedSectionId(null);
                        }}
                        className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#0B1F4D] text-white'
                            : 'border border-slate-200 bg-[#F8FAFC] text-[#0B1F4D] hover:bg-[#EAF2FF]'
                        }`}
                      >
                        {p.label}
                        {pageHasDraft ? ' *' : ''}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setAddSectionOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B1F4D] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B1F4D] hover:bg-[#EAF2FF] whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Section
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Section List & Ordering */}
                <div className="space-y-2.5 lg:col-span-4">
                  {pageSections.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                      No active sections on this page. Add a section to begin.
                    </div>
                  ) : (
                    pageSections.map((sec, idx) => {
                      const active = sec.id === selectedSectionId;
                      return (
                        <div
                          key={sec.id}
                          className={`rounded-xl border bg-white p-3.5 transition-colors ${
                            active
                              ? 'border-[#0B1F4D] ring-1 ring-[#0B1F4D]/15'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => selectSection(sec)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400">
                                  {String(idx + 1).padStart(2, '0')}
                                </span>
                                <span className="truncate text-sm font-semibold text-[#0B1F4D]">
                                  {sec.section_title}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[11px]">
                                <span
                                  className={
                                    sec.draft_visible ? 'text-emerald-700' : 'text-slate-400'
                                  }
                                >
                                  {sec.draft_visible ? 'Visible' : 'Hidden'}
                                </span>
                                {sec.has_unpublished_changes && (
                                  <span className="font-medium text-amber-700">· Draft</span>
                                )}
                                {sec.is_custom && (
                                  <span className="text-slate-400">· Custom</span>
                                )}
                              </div>
                            </button>

                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSection(idx, -1)}
                                title="Move section up"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0B1F4D] disabled:opacity-30"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === pageSections.length - 1}
                                onClick={() => handleMoveSection(idx, 1)}
                                title="Move section down"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0B1F4D] disabled:opacity-30"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleVisibility(sec)}
                                title={sec.draft_visible ? 'Hide section' : 'Show section'}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#0B1F4D]"
                              >
                                {sec.draft_visible ? (
                                  <Eye className="h-3.5 w-3.5" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Section Editor Form */}
                <div className="lg:col-span-8">
                  {activeSectionRecord ? (
                    <form
                      onSubmit={handleSaveSection}
                      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h2 className="text-lg font-semibold text-[#0B1F4D]">
                            Edit: {activeSectionRecord.section_title}
                          </h2>
                          <p className="text-xs text-slate-500">
                            Changes are saved to draft until you click Publish Changes.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeleteSectionTarget(activeSectionRecord)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove Section
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Section Label (Admin) *
                          </label>
                          <input
                            type="text"
                            required
                            value={sectionTitle}
                            onChange={(e) => setSectionTitle(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D]">
                            <input
                              type="checkbox"
                              checked={sectionVisible}
                              onChange={(e) => setSectionVisible(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-[#0B1F4D]"
                            />
                            <span>Visible on public page</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Eyebrow / Kicker Text
                          </label>
                          <input
                            type="text"
                            value={sectionContent.kicker ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({ ...prev, kicker: e.target.value }))
                            }
                            placeholder="Optional short label above heading"
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Section Heading
                          </label>
                          <input
                            type="text"
                            value={sectionContent.heading ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({ ...prev, heading: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">
                          Description / Paragraph
                        </label>
                        <textarea
                          rows={3}
                          value={sectionContent.description ?? ''}
                          onChange={(e) =>
                            setSectionContent((prev) => ({ ...prev, description: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Primary Button Text
                          </label>
                          <input
                            type="text"
                            value={sectionContent.primary_cta_text ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({
                                ...prev,
                                primary_cta_text: e.target.value,
                              }))
                            }
                            placeholder="e.g. Get a New Connection"
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Primary Button Link (#connect or /path)
                          </label>
                          <input
                            type="text"
                            value={sectionContent.primary_cta_link ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({
                                ...prev,
                                primary_cta_link: e.target.value,
                              }))
                            }
                            placeholder="#connect or /packages"
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Secondary Button Text
                          </label>
                          <input
                            type="text"
                            value={sectionContent.secondary_cta_text ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({
                                ...prev,
                                secondary_cta_text: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-700">
                            Secondary Button Link
                          </label>
                          <input
                            type="text"
                            value={sectionContent.secondary_cta_link ?? ''}
                            onChange={(e) =>
                              setSectionContent((prev) => ({
                                ...prev,
                                secondary_cta_link: e.target.value,
                              }))
                            }
                            placeholder="/packages or /contact"
                            className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Section Image */}
                      <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[#0B1F4D]">Section Image</p>
                            <p className="text-[11px] text-slate-500">
                              Select or upload an image and configure its SEO alt text.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setMediaPickerConfig({
                                  open: true,
                                  target: 'section',
                                  category:
                                    activeSectionRecord.section_key === 'hero'
                                      ? 'hero'
                                      : selectedPage === 'about'
                                        ? 'about'
                                        : 'banner',
                                  selectedUrl: sectionContent.image_url,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              {sectionContent.image_url ? 'Replace Image' : 'Choose Image'}
                            </button>
                            {sectionContent.image_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSectionContent((prev) => ({
                                    ...prev,
                                    image_url: '',
                                    image_alt: '',
                                  }))
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {sectionContent.image_url && (
                          <div className="mt-3 grid gap-3 sm:grid-cols-12">
                            <div className="h-24 overflow-hidden rounded-lg border border-slate-200 bg-white sm:col-span-4">
                              <ImageWithFallback
                                src={sectionContent.image_url}
                                alt={sectionContent.image_alt || sectionTitle}
                                className="h-full w-full object-cover"
                                fallbackTitle={sectionTitle}
                              />
                            </div>
                            <div className="sm:col-span-8">
                              <label className="mb-1 block text-xs font-medium text-slate-700">
                                Image SEO Alt Text
                              </label>
                              <input
                                type="text"
                                value={sectionContent.image_alt ?? ''}
                                onChange={(e) =>
                                  setSectionContent((prev) => ({
                                    ...prev,
                                    image_alt: e.target.value,
                                  }))
                                }
                                placeholder="Describe the image for search engines and screen readers"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Repeatable Cards / Zones Editor */}
                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-[#0B1F4D]">
                              Section Cards / Locations ({sectionContent.items?.length ?? 0})
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Feature items, service pillars, or confirmed coverage zones inside
                              this section.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSectionContent((prev) => ({
                                ...prev,
                                items: [
                                  ...(prev.items || []),
                                  {
                                    index: String((prev.items?.length ?? 0) + 1).padStart(2, '0'),
                                    title: '',
                                    description: '',
                                  },
                                ],
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Card
                          </button>
                        </div>

                        {sectionContent.items && sectionContent.items.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {sectionContent.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="grid gap-2.5 rounded-lg border border-slate-100 bg-[#F8FAFC] p-3 sm:grid-cols-12"
                              >
                                <div className="sm:col-span-2">
                                  <input
                                    type="text"
                                    value={item.index ?? ''}
                                    onChange={(e) => {
                                      const next = [...(sectionContent.items || [])];
                                      next[idx] = { ...next[idx], index: e.target.value };
                                      setSectionContent((prev) => ({ ...prev, items: next }));
                                    }}
                                    placeholder="01"
                                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-[#0B1F4D]"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => {
                                      const next = [...(sectionContent.items || [])];
                                      next[idx] = { ...next[idx], title: e.target.value };
                                      setSectionContent((prev) => ({ ...prev, items: next }));
                                    }}
                                    placeholder="Title *"
                                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0B1F4D]"
                                  />
                                </div>
                                <div className="sm:col-span-5">
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => {
                                      const next = [...(sectionContent.items || [])];
                                      next[idx] = { ...next[idx], description: e.target.value };
                                      setSectionContent((prev) => ({ ...prev, items: next }));
                                    }}
                                    placeholder="Description"
                                    className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                                  />
                                </div>
                                <div className="flex items-center justify-end sm:col-span-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (sectionContent.items || []).filter(
                                        (_, i) => i !== idx,
                                      );
                                      setSectionContent((prev) => ({ ...prev, items: next }));
                                    }}
                                    title="Remove card"
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                          type="submit"
                          disabled={savingSection}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          {savingSection ? 'Saving Draft...' : 'Save Section Draft'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                      Select a section on the left to edit its content.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GLOBAL WEBSITE SETTINGS */}
          {activeTab === 'global' && settingsForm && (
            <form
              onSubmit={handleSaveSettings}
              className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-semibold text-[#0B1F4D]">Global Website Settings</h2>
                <p className="text-xs text-slate-500">
                  Controls company branding, navigation CTA, footer content, contact info, and
                  social links across the public website.
                </p>
              </div>

              {/* Brand Identity */}
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.company_name}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, company_name: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Company Tagline
                  </label>
                  <input
                    type="text"
                    value={settingsForm.company_tagline}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, company_tagline: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Header Button Text *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.header_cta_text}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, header_cta_text: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Logo & Favicon */}
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#0B1F4D]">Company Logo</p>
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerConfig({
                          open: true,
                          target: 'logo',
                          category: 'logo',
                          selectedUrl: settingsForm.logo_url,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                    >
                      Change Logo
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex h-14 w-24 items-center justify-center rounded border border-slate-200 bg-white p-1.5">
                      <ImageWithFallback
                        src={settingsForm.logo_url}
                        alt={settingsForm.logo_alt}
                        className="max-h-full max-w-full object-contain"
                        fallbackTitle={settingsForm.company_name}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">
                        Logo Alt Text
                      </label>
                      <input
                        type="text"
                        value={settingsForm.logo_alt}
                        onChange={(e) =>
                          setSettingsForm((prev) =>
                            prev ? { ...prev, logo_alt: e.target.value } : prev,
                          )
                        }
                        className="w-full rounded border border-slate-200 bg-white px-3 py-1.5 text-xs text-[#0B1F4D]"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#0B1F4D]">Website Favicon</p>
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerConfig({
                          open: true,
                          target: 'favicon',
                          category: 'logo',
                          selectedUrl: settingsForm.favicon_url,
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                    >
                      Change Favicon
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded border border-slate-200 bg-white p-2">
                      <ImageWithFallback
                        src={settingsForm.favicon_url}
                        alt="Favicon"
                        className="max-h-full max-w-full object-contain"
                        fallbackTitle="Favicon"
                      />
                    </div>
                    <p className="flex-1 truncate font-mono text-xs text-slate-600">
                      {settingsForm.favicon_url || 'Default site icon'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={settingsForm.phone}
                    onChange={(e) =>
                      setSettingsForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                    }
                    placeholder="+880 18XX-XXXXXX"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={settingsForm.whatsapp}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, whatsapp: e.target.value } : prev,
                      )
                    }
                    placeholder="+880 18XX-XXXXXX"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="text"
                    value={settingsForm.email}
                    onChange={(e) =>
                      setSettingsForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                    }
                    placeholder="support@romancommunication.com"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Office Address
                  </label>
                  <input
                    type="text"
                    value={settingsForm.address}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, address: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Google Maps Location URL
                  </label>
                  <input
                    type="text"
                    value={settingsForm.google_maps_url}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, google_maps_url: e.target.value } : prev,
                      )
                    }
                    placeholder="https://maps.google.com/..."
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Facebook Page URL
                  </label>
                  <input
                    type="text"
                    value={settingsForm.facebook_url}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, facebook_url: e.target.value } : prev,
                      )
                    }
                    placeholder="https://facebook.com/romancommunication"
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs font-semibold text-[#0B1F4D]">Other Social Links</p>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              other_social_links: [
                                ...prev.other_social_links,
                                { label: '', url: '' },
                              ],
                            }
                          : prev,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Link
                  </button>
                </div>

                {settingsForm.other_social_links.map((link, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const next = [...settingsForm.other_social_links];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setSettingsForm((prev) =>
                            prev ? { ...prev, other_social_links: next } : prev,
                          );
                        }}
                        placeholder="Platform (e.g. YouTube)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-[#0B1F4D]"
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => {
                          const next = [...settingsForm.other_social_links];
                          next[idx] = { ...next[idx], url: e.target.value };
                          setSettingsForm((prev) =>
                            prev ? { ...prev, other_social_links: next } : prev,
                          );
                        }}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-[#0B1F4D]"
                      />
                    </div>
                    <div className="flex items-center justify-end sm:col-span-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  other_social_links: prev.other_social_links.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }
                              : prev,
                          )
                        }
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Content */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Footer Company Description
                  </label>
                  <textarea
                    rows={2}
                    value={settingsForm.footer_description}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, footer_description: e.target.value } : prev,
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Copyright Text
                    </label>
                    <input
                      type="text"
                      value={settingsForm.footer_copyright}
                      onChange={(e) =>
                        setSettingsForm((prev) =>
                          prev ? { ...prev, footer_copyright: e.target.value } : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Footer Subtext
                    </label>
                    <input
                      type="text"
                      value={settingsForm.footer_subtext}
                      onChange={(e) =>
                        setSettingsForm((prev) =>
                          prev ? { ...prev, footer_subtext: e.target.value } : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingSettings ? 'Saving Draft...' : 'Save Global Settings Draft'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MEDIA LIBRARY */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-[#0B1F4D]">Upload Website Image</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Uploaded images are stored directly in Turso database storage (PNG, JPEG, WebP,
                  GIF, or ICO up to 2 MB).
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0B1F4D]"
                  >
                    {MEDIA_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        Category: {cat}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={uploadAlt}
                    onChange={(e) => setUploadAlt(e.target.value)}
                    placeholder="SEO alt text (recommended)"
                    className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingMedia ? 'Uploading...' : 'Select & Upload File'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                      disabled={uploadingMedia}
                      onChange={handleUploadMedia}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {workspace.media.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="relative h-44 bg-slate-100">
                      <ImageWithFallback
                        src={asset.file_url}
                        alt={asset.alt_text || asset.file_name}
                        className="h-full w-full object-cover"
                        fallbackTitle={asset.file_name}
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[#0B1F4D]">
                            {asset.file_name}
                          </p>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                            {formatBytes(asset.file_size)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Category: {asset.category} · {asset.is_builtin ? 'Built-in' : 'Uploaded'}
                        </p>

                        <div className="mt-3 flex gap-1.5">
                          <input
                            type="text"
                            value={mediaAlts[asset.id] ?? ''}
                            onChange={(e) =>
                              setMediaAlts((prev) => ({ ...prev, [asset.id]: e.target.value }))
                            }
                            placeholder="SEO alt text"
                            className="min-w-0 flex-1 rounded border border-slate-200 px-2.5 py-1.5 text-xs text-[#0B1F4D]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveMediaAlt(asset)}
                            className="rounded border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                          >
                            Save Alt
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50">
                            Replace
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon"
                              onChange={(e) => handleReplaceMedia(asset, e)}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => copyUrl(asset.file_url)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            <Copy className="h-3 w-3" />
                            Path
                          </button>
                        </div>

                        {!asset.is_builtin && (
                          <button
                            type="button"
                            onClick={() => setDeleteMediaTarget(asset)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SEO SETTINGS */}
          {activeTab === 'seo' && seoForm && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
                {PAGE_LABELS.map((p) => {
                  const active = selectedSeoPage === p.slug;
                  const rec = workspace.seoRecords.find((r) => r.page_slug === p.slug);
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      onClick={() => setSelectedSeoPage(p.slug)}
                      className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#0B1F4D] text-white'
                          : 'border border-slate-200 bg-[#F8FAFC] text-[#0B1F4D] hover:bg-[#EAF2FF]'
                      }`}
                    >
                      {p.label}
                      {rec?.has_unpublished_changes ? ' *' : ''}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <form
                  onSubmit={handleSaveSeo}
                  className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base font-semibold text-[#0B1F4D]">
                      SEO Metadata · {PAGE_LABELS.find((p) => p.slug === selectedSeoPage)?.label}
                    </h2>
                    {currentSeoRecord?.has_unpublished_changes && (
                      <span className="text-xs font-medium text-amber-700">Unpublished draft</span>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      SEO Page Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={seoForm.seo_title}
                      onChange={(e) =>
                        setSeoForm((prev) => (prev ? { ...prev, seo_title: e.target.value } : prev))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Meta Description
                    </label>
                    <textarea
                      rows={3}
                      value={seoForm.meta_description}
                      onChange={(e) =>
                        setSeoForm((prev) =>
                          prev ? { ...prev, meta_description: e.target.value } : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Meta Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={seoForm.meta_keywords}
                      onChange={(e) =>
                        setSeoForm((prev) =>
                          prev ? { ...prev, meta_keywords: e.target.value } : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Open Graph Title
                      </label>
                      <input
                        type="text"
                        value={seoForm.og_title}
                        onChange={(e) =>
                          setSeoForm((prev) => (prev ? { ...prev, og_title: e.target.value } : prev))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Canonical URL (Optional)
                      </label>
                      <input
                        type="text"
                        value={seoForm.canonical_url}
                        onChange={(e) =>
                          setSeoForm((prev) =>
                            prev ? { ...prev, canonical_url: e.target.value } : prev,
                          )
                        }
                        placeholder="https://romancommunication.com/..."
                        className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-xs text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Open Graph Description
                    </label>
                    <textarea
                      rows={2}
                      value={seoForm.og_description}
                      onChange={(e) =>
                        setSeoForm((prev) =>
                          prev ? { ...prev, og_description: e.target.value } : prev,
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#0B1F4D]">
                          Social Sharing Image (OG Image)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Shown when this page is shared on Facebook or WhatsApp.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setMediaPickerConfig({
                            open: true,
                            target: 'seo',
                            category: 'seo',
                            selectedUrl: seoForm.og_image_url,
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                      >
                        Select Image
                      </button>
                    </div>
                    {seoForm.og_image_url && (
                      <div className="mt-3 h-24 w-44 overflow-hidden rounded border border-slate-200 bg-white">
                        <ImageWithFallback
                          src={seoForm.og_image_url}
                          alt="Social sharing preview"
                          className="h-full w-full object-cover"
                          fallbackTitle="OG Preview"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <button
                      type="submit"
                      disabled={savingSeo}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F4D] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {savingSeo ? 'Saving Draft...' : 'Save Page SEO Draft'}
                    </button>
                  </div>
                </form>

                {/* Search & Social Snippet Preview */}
                <div className="space-y-4 lg:col-span-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold text-slate-500">Search Engine Preview</p>
                    <div className="mt-3 space-y-1">
                      <p className="truncate text-xs text-emerald-700">
                        {seoForm.canonical_url ||
                          `https://romancommunication.com${PAGE_LABELS.find((p) => p.slug === selectedSeoPage)?.route ?? '/'}`}
                      </p>
                      <p className="text-base font-semibold leading-snug text-[#1a0dab]">
                        {seoForm.seo_title || 'Page Title'}
                      </p>
                      <p className="text-xs leading-relaxed text-slate-600">
                        {seoForm.meta_description || 'No meta description set.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#0B1F4D]">
                    Content & Admin Audit Log
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tracks draft edits, publications, media updates, and catalog changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAuditLogs}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {loadingAudit ? (
                <div className="p-8 text-center text-sm text-slate-500">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No CMS or configuration events recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Administrator</th>
                        <th className="px-5 py-3 font-medium">Action</th>
                        <th className="px-5 py-3 font-medium">Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-500">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-5 py-3 text-xs font-medium text-[#0B1F4D]">
                            {log.admin_email}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-700">
                            {log.action}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-600">{log.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Custom Section Modal */}
      {addSectionOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1F4D]/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-[#0B1F4D]">
                Add Section to {PAGE_LABELS.find((p) => p.slug === selectedPage)?.label}
              </h2>
              <button
                type="button"
                onClick={() => setAddSectionOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSection} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Section Label (Admin) *
                </label>
                <input
                  type="text"
                  required
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="e.g. Service Guarantee Banner"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Public Heading
                </label>
                <input
                  type="text"
                  value={newSectionHeading}
                  onChange={(e) => setNewSectionHeading(e.target.value)}
                  placeholder="e.g. Same-Day Installation Across Masajidda"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newSectionDesc}
                  onChange={(e) => setNewSectionDesc(e.target.value)}
                  placeholder="Section body text..."
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-[#0B1F4D] focus:border-[#0B1F4D] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddSectionOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSection}
                  className="rounded-lg bg-[#0B1F4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#132F70] disabled:opacity-60"
                >
                  {creatingSection ? 'Adding...' : 'Add Section to Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Multi-Page Draft Preview Modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0B1F4D]/75 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#0B1F4D]">Draft Preview:</span>
              {PAGE_LABELS.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setPreviewRoute(p.route)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    previewRoute === p.route
                      ? 'bg-[#0B1F4D] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                title="Desktop viewport"
                className={`rounded p-1.5 ${
                  previewViewport === 'desktop'
                    ? 'bg-[#EAF2FF] text-[#0B1F4D]'
                    : 'text-slate-400 hover:text-[#0B1F4D]'
                }`}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                title="Mobile viewport"
                className={`rounded p-1.5 ${
                  previewViewport === 'mobile'
                    ? 'bg-[#EAF2FF] text-[#0B1F4D]'
                    : 'text-slate-400 hover:text-[#0B1F4D]'
                }`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#0B1F4D] hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                Close Preview
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-b-xl bg-slate-200 p-2 sm:p-4">
            <iframe
              key={`${previewRoute}-${previewNonce}`}
              title="Website Draft Preview"
              src={`${previewRoute}?preview=1`}
              className={`h-full rounded-lg border border-slate-300 bg-white shadow-2xl transition-all ${
                previewViewport === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'
              }`}
            />
          </div>
        </div>
      )}

      {/* Confirmations & Shared Media Picker */}
      <ConfirmModal
        open={discardConfirmOpen}
        title="Discard Unpublished Changes"
        description="All saved draft edits across pages, global settings, and SEO will revert to the currently published live version. This cannot be undone."
        confirmLabel="Discard Drafts"
        destructive
        busy={discarding}
        onConfirm={handleDiscardAll}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      <ConfirmModal
        open={Boolean(deleteSectionTarget)}
        title="Remove Page Section"
        description={`Remove "${deleteSectionTarget?.section_title ?? ''}" from this page? You can discard drafts later if you change your mind before publishing.`}
        confirmLabel="Remove Section"
        destructive
        busy={deletingSection}
        onConfirm={handleDeleteSection}
        onCancel={() => setDeleteSectionTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteMediaTarget)}
        title="Delete Uploaded Image"
        description={`Permanently delete "${deleteMediaTarget?.file_name ?? ''}" from Media Library?`}
        confirmLabel="Delete Image"
        destructive
        busy={deletingMedia}
        onConfirm={handleDeleteMedia}
        onCancel={() => setDeleteMediaTarget(null)}
      />

      <MediaPickerModal
        open={mediaPickerConfig.open}
        selectedUrl={mediaPickerConfig.selectedUrl}
        defaultCategory={mediaPickerConfig.category}
        onSelect={(asset) => {
          if (mediaPickerConfig.target === 'section') {
            setSectionContent((prev) => ({
              ...prev,
              image_url: asset.file_url,
              image_alt: prev.image_alt || asset.alt_text,
            }));
          } else if (mediaPickerConfig.target === 'logo') {
            setSettingsForm((prev) =>
              prev ? { ...prev, logo_url: asset.file_url, logo_alt: asset.alt_text || prev.logo_alt } : prev,
            );
          } else if (mediaPickerConfig.target === 'favicon') {
            setSettingsForm((prev) => (prev ? { ...prev, favicon_url: asset.file_url } : prev));
          } else if (mediaPickerConfig.target === 'seo') {
            setSeoForm((prev) => (prev ? { ...prev, og_image_url: asset.file_url } : prev));
          }
        }}
        onClose={() => setMediaPickerConfig((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
