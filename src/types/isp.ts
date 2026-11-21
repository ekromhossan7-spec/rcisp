export type RecordStatus = 'active' | 'inactive';
export type PackageStatus = 'active' | 'inactive' | 'deleted';
export type SubscriptionStatus = 'active' | 'changed' | 'cancelled' | 'ended';
export type DiscountType = 'percentage' | 'fixed';
export type InquiryCategory = 'connection' | 'coverage' | 'contact';
export type InquiryStatus = 'new' | 'contacted' | 'resolved';
export type CmsPageSlug = 'home' | 'about' | 'packages' | 'offers' | 'coverage' | 'contact';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
}

export interface PackageRecord {
  id: string;
  name: string;
  speed_mbps: number;
  monthly_price: number;
  description: string;
  features: string[];
  image_url: string | null;
  show_on_home: boolean;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
  active_subscriber_count?: number;
  active_offer?: OfferSummary | null;
}

export interface OfferSummary {
  id: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  start_date: string;
  expiry_date: string;
  image_url?: string | null;
}

export interface OfferRecord {
  id: string;
  title: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  package_id: string | null;
  package_name?: string | null;
  package_speed_mbps?: number | null;
  package_monthly_price?: number | null;
  start_date: string;
  expiry_date: string;
  image_url: string | null;
  show_on_home: boolean;
  status: RecordStatus;
  created_at: string;
}

export interface CustomerRecord {
  id: string;
  customer_code: string;
  name: string;
  mobile: string;
  email: string | null;
  address: string;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
  active_subscription?: {
    id: string;
    package_id: string;
    package_name: string;
    speed_mbps: number;
    monthly_price: number;
    start_date: string;
    end_date: string | null;
    status: SubscriptionStatus;
  } | null;
}

export interface SubscriptionRecord {
  id: string;
  customer_id: string;
  customer_code: string;
  customer_name: string;
  customer_mobile: string;
  package_id: string;
  package_name: string;
  speed_mbps: number;
  monthly_price: number;
  start_date: string;
  end_date: string | null;
  status: SubscriptionStatus;
  created_at: string;
}

export interface InquiryRecord {
  id: string;
  type: InquiryCategory;
  full_name: string;
  mobile: string;
  email: string | null;
  address: string;
  package_id: string | null;
  package_name?: string | null;
  inquiry_type: string | null;
  message: string | null;
  status: InquiryStatus;
  created_at: string;
}

export interface DashboardOverview {
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    totalPackages: number;
    activePackages: number;
    activeOffers: number;
    newInquiries: number;
  };
  recentCustomers: CustomerRecord[];
  recentPackages: PackageRecord[];
  recentAssignments: SubscriptionRecord[];
}

// ---------------------------------------------------------------------------
// CMS Types (Section 5.8)
// ---------------------------------------------------------------------------

export interface PageSectionItem {
  index?: string;
  title: string;
  description: string;
}

export interface PageSectionContent {
  kicker?: string;
  heading?: string;
  description?: string;
  secondary_description?: string;
  primary_cta_text?: string;
  primary_cta_link?: string;
  secondary_cta_text?: string;
  secondary_cta_link?: string;
  image_url?: string;
  image_alt?: string;
  items?: PageSectionItem[];
}

export interface PageContentRecord {
  id: string;
  page_slug: CmsPageSlug;
  section_key: string;
  section_title: string;
  draft_content: PageSectionContent;
  published_content: PageSectionContent | null;
  draft_order: number;
  published_order: number;
  draft_visible: boolean;
  published_visible: boolean;
  has_unpublished_changes: boolean;
  is_custom: boolean;
  deleted_in_draft: boolean;
  updated_at: string;
}

export interface SocialLinkItem {
  label: string;
  url: string;
}

export interface WebsiteSettingsMap {
  company_name: string;
  company_tagline: string;
  logo_url: string;
  logo_alt: string;
  favicon_url: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  facebook_url: string;
  other_social_links: SocialLinkItem[];
  google_maps_url: string;
  header_cta_text: string;
  footer_description: string;
  footer_copyright: string;
  footer_subtext: string;
}

export interface PageSeoData {
  seo_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_url: string;
}

export interface PageSeoRecord {
  id: string;
  page_slug: CmsPageSlug;
  draft_seo: PageSeoData;
  published_seo: PageSeoData;
  has_unpublished_changes: boolean;
  updated_at: string;
}

export interface MediaAssetRecord {
  id: string;
  file_name: string;
  file_url: string;
  alt_text: string;
  file_type: string;
  file_size: number;
  category: string;
  is_builtin: boolean;
  uploaded_at: string;
}

export interface AuditLogRecord {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
}

export interface PublicSiteSection {
  id: string;
  page_slug: CmsPageSlug;
  section_key: string;
  section_title: string;
  content: PageSectionContent;
  section_order: number;
  is_custom: boolean;
}

export interface PublicSitePayload {
  isPreview: boolean;
  settings: WebsiteSettingsMap;
  sections: PublicSiteSection[];
  seo: Record<CmsPageSlug, PageSeoData>;
}

export interface CmsAdminWorkspacePayload {
  sections: PageContentRecord[];
  draftSettings: WebsiteSettingsMap;
  publishedSettings: WebsiteSettingsMap;
  settingsHasUnpublished: boolean;
  seoRecords: PageSeoRecord[];
  media: MediaAssetRecord[];
  unpublishedCount: number;
}
