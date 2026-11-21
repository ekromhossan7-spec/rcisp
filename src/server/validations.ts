import { z } from 'zod';

// Block javascript:, data:, vbscript: schemes in links/images/canonical URLs
export const safeUrlOrPathSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => {
      if (!val) return true;
      if (val.startsWith('/') || val.startsWith('#')) return !val.startsWith('//');
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'URL must be a relative path (/...) or an http(s):// link.' },
  );

export const cmsPageSlugSchema = z.enum([
  'home',
  'about',
  'packages',
  'offers',
  'coverage',
  'contact',
]);

export const adminSetupSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(80),
  email: z.string().trim().email('Valid email address is required').max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const packageSchema = z.object({
  name: z.string().trim().min(2, 'Package name is required').max(80),
  speed_mbps: z.coerce
    .number()
    .int('Speed must be a whole number')
    .min(1, 'Speed must be at least 1 Mbps')
    .max(10000),
  monthly_price: z.coerce
    .number()
    .positive('Monthly price must be greater than 0')
    .max(500000),
  description: z.string().trim().min(5, 'Description is required').max(500),
  features: z
    .array(z.string().trim().min(1).max(120))
    .min(1, 'Add at least one package feature')
    .max(12),
  image_url: safeUrlOrPathSchema.optional().nullable(),
  show_on_home: z.boolean().optional().default(true),
  status: z.enum(['active', 'inactive']),
});

export const offerSchema = z
  .object({
    title: z.string().trim().min(3, 'Offer title is required').max(100),
    description: z.string().trim().min(5, 'Offer description is required').max(500),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.coerce.number().positive('Discount value must be greater than 0'),
    package_id: z.string().trim().optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD'),
    image_url: safeUrlOrPathSchema.optional().nullable(),
    show_on_home: z.boolean().optional().default(true),
    status: z.enum(['active', 'inactive']),
  })
  .refine((data) => data.expiry_date >= data.start_date, {
    message: 'Expiry date must be on or after start date',
    path: ['expiry_date'],
  })
  .refine(
    (data) => data.discount_type !== 'percentage' || data.discount_value <= 100,
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['discount_value'],
    },
  );

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(100),
  mobile: z
    .string()
    .trim()
    .min(6, 'Valid mobile number is required')
    .max(25),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
    .nullable(),
  address: z.string().trim().min(3, 'Address is required').max(250),
  status: z.enum(['active', 'inactive']).default('active'),
  initial_package_id: z.string().trim().optional().nullable(),
});

export const customerUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Customer name is required').max(100),
  mobile: z.string().trim().min(6, 'Valid mobile number is required').max(25),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
    .nullable(),
  address: z.string().trim().min(3, 'Address is required').max(250),
  status: z.enum(['active', 'inactive']),
});

export const assignPackageSchema = z.object({
  customer_id: z.string().trim().min(1, 'Customer is required'),
  package_id: z.string().trim().min(1, 'Package is required'),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD')
    .optional()
    .or(z.literal(''))
    .nullable(),
});

export const inquiryCreateSchema = z.object({
  type: z.enum(['connection', 'coverage', 'contact']),
  full_name: z.string().trim().min(2, 'Full name is required').max(100),
  mobile: z.string().trim().min(6, 'Valid mobile number is required').max(25),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .or(z.literal(''))
    .nullable(),
  address: z.string().trim().min(3, 'Address is required').max(250),
  package_id: z.string().trim().optional().nullable(),
  inquiry_type: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

export const inquiryStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'resolved']),
});

// CMS Validation Schemas
export const pageSectionItemSchema = z.object({
  index: z.string().trim().max(16).optional(),
  title: z.string().trim().min(1, 'Item title is required').max(120),
  description: z.string().trim().max(500).default(''),
});

export const pageSectionContentSchema = z.object({
  kicker: z.string().trim().max(120).optional(),
  heading: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  secondary_description: z.string().trim().max(2000).optional(),
  primary_cta_text: z.string().trim().max(60).optional(),
  primary_cta_link: safeUrlOrPathSchema.optional(),
  secondary_cta_text: z.string().trim().max(60).optional(),
  secondary_cta_link: safeUrlOrPathSchema.optional(),
  image_url: safeUrlOrPathSchema.optional(),
  image_alt: z.string().trim().max(200).optional(),
  items: z.array(pageSectionItemSchema).max(16).optional(),
});

export const cmsSectionUpdateSchema = z.object({
  section_title: z.string().trim().min(2, 'Section title is required').max(100),
  draft_content: pageSectionContentSchema,
  draft_visible: z.boolean(),
});

export const cmsSectionCreateSchema = z.object({
  page_slug: cmsPageSlugSchema,
  section_title: z.string().trim().min(2, 'Section title is required').max(100),
  draft_content: pageSectionContentSchema,
  draft_visible: z.boolean().default(true),
});

export const cmsReorderSchema = z.object({
  page_slug: cmsPageSlugSchema,
  ordered_ids: z.array(z.string().trim().min(1)).min(1),
});

export const websiteSettingsSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required').max(100),
  company_tagline: z.string().trim().max(120).default(''),
  logo_url: safeUrlOrPathSchema,
  logo_alt: z.string().trim().max(150).default('Company Logo'),
  favicon_url: safeUrlOrPathSchema.default(''),
  phone: z.string().trim().max(120).default(''),
  whatsapp: z.string().trim().max(60).default(''),
  email: z.string().trim().max(120).default(''),
  address: z.string().trim().max(250).default(''),
  facebook_url: safeUrlOrPathSchema.default(''),
  other_social_links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(50),
        url: safeUrlOrPathSchema,
      }),
    )
    .max(8)
    .default([]),
  google_maps_url: safeUrlOrPathSchema.default(''),
  header_cta_text: z.string().trim().min(1).max(40),
  footer_description: z.string().trim().max(500).default(''),
  footer_copyright: z.string().trim().max(200).default(''),
  footer_subtext: z.string().trim().max(200).default(''),
});

export const pageSeoUpdateSchema = z.object({
  seo_title: z.string().trim().min(2, 'SEO Title is required').max(160),
  meta_description: z.string().trim().max(320).default(''),
  meta_keywords: z.string().trim().max(500).default(''),
  og_title: z.string().trim().max(160).default(''),
  og_description: z.string().trim().max(320).default(''),
  og_image_url: safeUrlOrPathSchema.default(''),
  canonical_url: safeUrlOrPathSchema.default(''),
});

export const mediaUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(150),
  file_type: z.enum([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ]),
  alt_text: z.string().trim().max(200).default(''),
  category: z
    .enum(['hero', 'banner', 'about', 'offer', 'package', 'logo', 'seo', 'general'])
    .default('general'),
  data_base64: z.string().min(8).max(3_200_000),
});

export const mediaAltUpdateSchema = z.object({
  alt_text: z.string().trim().max(200),
  category: z
    .enum(['hero', 'banner', 'about', 'offer', 'package', 'logo', 'seo', 'general'])
    .optional(),
});
