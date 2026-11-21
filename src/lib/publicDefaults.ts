import type {
  CmsPageSlug,
  PageSeoData,
  PublicSitePayload,
  PublicSiteSection,
  WebsiteSettingsMap,
} from '../types/isp';

export const FALLBACK_SETTINGS: WebsiteSettingsMap = {
  company_name: 'Roman Communication',
  company_tagline: 'Internet Service Provider',
  logo_url: '/assets/aistudio/image_4c43d9bf.png',
  logo_alt: 'Roman Communication Logo',
  favicon_url: '/assets/aistudio/image_4c43d9bf.png',
  phone: 'To be provided (Support & Sales Desk)',
  whatsapp: '',
  email: 'To be provided',
  address: 'Gulahammad, Masajidda, Sitakunda, Chattogram, Bangladesh.',
  facebook_url: '',
  other_social_links: [],
  google_maps_url: '',
  header_cta_text: 'Get Connection',
  footer_description:
    'Roman Communication is a dedicated Internet Service Provider delivering dependable fiber broadband for households, students, and local businesses in Sitakunda, Chattogram.',
  footer_copyright: `© ${new Date().getFullYear()} Roman Communication. All rights reserved.`,
  footer_subtext: 'Internet Service Provider · Sitakunda, Chattogram',
};

export const FALLBACK_SECTIONS: PublicSiteSection[] = [
  {
    id: 'default-home-hero',
    page_slug: 'home',
    section_key: 'hero',
    section_title: 'Hero Banner',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'Gulahammad, Masajidda, Sitakunda · Chattogram',
      heading: 'Fast, Reliable Internet for Your Everyday Life.',
      description:
        'Stay connected with reliable internet service from Roman Communication. Enjoy seamless connectivity for your home, business, education, and entertainment.',
      primary_cta_text: 'Get a New Connection',
      primary_cta_link: '#connect',
      secondary_cta_text: 'View Packages',
      secondary_cta_link: '/packages',
      image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
      image_alt: 'Bright modern connected home study powered by Roman Communication broadband',
    },
  },
  {
    id: 'default-home-why',
    page_slug: 'home',
    section_key: 'why_choose_us',
    section_title: 'Why Choose Us',
    section_order: 2,
    is_custom: false,
    content: {
      heading: 'Why Choose Roman Communication',
      description:
        'Practical broadband infrastructure built around everyday reliability in Sitakunda.',
      items: [
        {
          index: '01',
          title: 'High-Speed Fiber Internet',
          description:
            'Consistent optical broadband bandwidth engineered for smooth HD streaming, online classes, and remote work.',
        },
        {
          index: '02',
          title: 'Stable Connectivity',
          description:
            'Clean optical distribution and monitored routing across Sitakunda reduce drop-offs during peak evening hours.',
        },
        {
          index: '03',
          title: 'Dedicated Local Support',
          description:
            'Our technicians operate directly from Gulahammad, Masajidda—ensuring prompt field service whenever you need help.',
        },
        {
          index: '04',
          title: 'Affordable Monthly Plans',
          description:
            'Transparent BDT pricing with clear speed tiers and seasonal promotional offers, without unexpected surcharges.',
        },
      ],
    },
  },
  {
    id: 'default-home-packages',
    page_slug: 'home',
    section_key: 'packages_preview',
    section_title: 'Internet Packages Preview',
    section_order: 3,
    is_custom: false,
    content: {
      heading: 'Internet Packages',
      description: 'Clear monthly rates in BDT with unlimited data across every tier.',
      primary_cta_text: 'See all packages',
      primary_cta_link: '/packages',
    },
  },
  {
    id: 'default-home-coverage',
    page_slug: 'home',
    section_key: 'coverage_preview',
    section_title: 'Coverage Area Preview',
    section_order: 4,
    is_custom: false,
    content: {
      kicker: 'Service Coverage',
      heading: 'Confirmed Fiber Coverage in Sitakunda, Chattogram',
      description:
        'Our primary optical fiber network actively serves homes, shops, and offices across Gulahammad, Masajidda, and surrounding Sitakunda neighborhoods.',
      primary_cta_text: 'Check Coverage Availability',
      primary_cta_link: '/coverage',
      secondary_cta_text: 'Contact Office',
      secondary_cta_link: '/contact',
      image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
      image_alt: 'Sitakunda Chattogram broadband service area landscape',
      items: [
        { title: 'Gulahammad', description: 'Confirmed active fiber coverage' },
        { title: 'Masajidda', description: 'Primary operations hub' },
        { title: 'Sitakunda Bazar Area', description: 'Residential & commercial coverage' },
        { title: 'Sitakunda Sadar Road', description: 'High-speed optical line coverage' },
      ],
    },
  },
  {
    id: 'default-home-cta',
    page_slug: 'home',
    section_key: 'cta_banner',
    section_title: 'Call to Action Banner',
    section_order: 5,
    is_custom: false,
    content: {
      heading: 'Ready for Reliable Broadband at Home or Work?',
      description:
        'Request a new optical fiber installation in Gulahammad, Masajidda, or Sitakunda and get connected quickly by our local technicians.',
      primary_cta_text: 'Request New Connection',
      primary_cta_link: '#connect',
      secondary_cta_text: 'Talk to Our Team',
      secondary_cta_link: '/contact',
    },
  },
  {
    id: 'default-about-intro',
    page_slug: 'about',
    section_key: 'intro',
    section_title: 'Company Introduction',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'About Roman Communication',
      heading: 'Dependable Local Broadband Built for Sitakunda.',
      description:
        'Headquartered at Gulahammad, Masajidda, Sitakunda, Chattogram, Roman Communication was established to bring stable, fairly priced fiber internet to families, students, and local enterprises.',
      primary_cta_text: 'Request Connection',
      primary_cta_link: '#connect',
      secondary_cta_text: 'View Internet Packages',
      secondary_cta_link: '/packages',
      image_url: '/src/assets/images/about_network_noc_1795280419008.jpg',
      image_alt: 'Roman Communication optical fiber distribution rack',
    },
  },
  {
    id: 'default-packages-header',
    page_slug: 'packages',
    section_key: 'header',
    section_title: 'Packages Page Header',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'Broadband Plans',
      heading: 'Internet Packages',
      description:
        'All active fiber broadband plans from Roman Communication. Select a package to request installation in Gulahammad, Masajidda, or Sitakunda.',
    },
  },
  {
    id: 'default-offers-header',
    page_slug: 'offers',
    section_key: 'header',
    section_title: 'Offers Page Header',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'Promotions',
      heading: 'Special Promotional Offers',
      description:
        'Verified active offers currently within their validity period. Expired or inactive promotions are automatically excluded.',
    },
  },
  {
    id: 'default-coverage-header',
    page_slug: 'coverage',
    section_key: 'header',
    section_title: 'Coverage Page Header',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'Network Footprint',
      heading: 'Coverage Area',
      description:
        'Confirmed optical fiber availability in Gulahammad, Masajidda, Sitakunda, Chattogram.',
      image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
      image_alt: 'Sitakunda Chattogram broadband service area',
    },
  },
  {
    id: 'default-coverage-zones',
    page_slug: 'coverage',
    section_key: 'confirmed_zones',
    section_title: 'Confirmed Service Locations',
    section_order: 2,
    is_custom: false,
    content: {
      heading: 'Confirmed Service Locations',
      description: 'Main Office: Gulahammad, Masajidda, Sitakunda, Chattogram, Bangladesh.',
      items: [
        {
          title: 'Gulahammad',
          description: 'Full optical fiber distribution across residential lanes and nearby roads.',
        },
        {
          title: 'Masajidda',
          description: 'Primary Roman Communication hub with rapid same-day installation support.',
        },
        {
          title: 'Sitakunda Bazar & Sadar Road',
          description: 'Residential apartments, commercial shops, and office broadband coverage.',
        },
        {
          title: 'Adjacent Sitakunda Neighborhoods',
          description: 'Feasibility verified within 24 hours via local field survey.',
        },
      ],
    },
  },
  {
    id: 'default-contact-header',
    page_slug: 'contact',
    section_key: 'header',
    section_title: 'Contact Page Header',
    section_order: 1,
    is_custom: false,
    content: {
      kicker: 'Get in Touch',
      heading: 'Contact Us',
      description:
        'Reach out to Roman Communication for new broadband installations, package upgrades, or technical assistance in Sitakunda.',
    },
  },
];

export const FALLBACK_SEO: Record<CmsPageSlug, PageSeoData> = {
  home: {
    seo_title: 'Roman Communication | Internet Service Provider in Sitakunda, Chattogram',
    meta_description:
      'Fast, reliable broadband internet service from Roman Communication in Gulahammad, Masajidda, Sitakunda, Chattogram.',
    meta_keywords: 'Roman Communication, ISP in Sitakunda, Broadband Internet in Chattogram',
    og_title: 'Roman Communication | Internet Service Provider in Sitakunda, Chattogram',
    og_description:
      'Reliable high-speed broadband internet for homes and businesses in Sitakunda, Chattogram.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  about: {
    seo_title: 'About Us | Roman Communication – Sitakunda Broadband ISP',
    meta_description: 'Learn about Roman Communication in Gulahammad, Masajidda, Sitakunda.',
    meta_keywords: 'About Roman Communication, Sitakunda ISP',
    og_title: 'About Roman Communication',
    og_description: 'Dedicated local fiber internet provider in Sitakunda, Chattogram.',
    og_image_url: '/src/assets/images/about_network_noc_1795280419008.jpg',
    canonical_url: '',
  },
  packages: {
    seo_title: 'Internet Packages | Roman Communication – Sitakunda, Chattogram',
    meta_description: 'Compare affordable monthly fiber internet packages from Roman Communication.',
    meta_keywords: 'Sitakunda internet packages, Roman Communication plans',
    og_title: 'Fiber Internet Packages | Roman Communication',
    og_description: 'Transparent BDT monthly fiber plans in Sitakunda.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  offers: {
    seo_title: 'Special Offers | Roman Communication Broadband Promotions',
    meta_description: 'Explore active broadband promotional discounts from Roman Communication.',
    meta_keywords: 'Roman Communication offers, Sitakunda broadband discount',
    og_title: 'Promotional Broadband Offers | Roman Communication',
    og_description: 'Limited-time discounts on new optical fiber connections in Sitakunda.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  coverage: {
    seo_title: 'Coverage Area | Roman Communication – Gulahammad, Masajidda, Sitakunda',
    meta_description:
      'Check confirmed fiber broadband availability across Gulahammad, Masajidda, and Sitakunda.',
    meta_keywords: 'Internet connection in Masajidda, Gulahammad broadband coverage',
    og_title: 'Fiber Coverage Area | Roman Communication',
    og_description: 'Verify optical broadband service availability at your Sitakunda address.',
    og_image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
    canonical_url: '',
  },
  contact: {
    seo_title: 'Contact Us | Roman Communication – Sitakunda, Chattogram',
    meta_description: 'Contact Roman Communication at Gulahammad, Masajidda, Sitakunda.',
    meta_keywords: 'Contact Roman Communication, Sitakunda ISP support',
    og_title: 'Contact Roman Communication',
    og_description: 'Get in touch with our local broadband support and installation team.',
    og_image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
    canonical_url: '',
  },
};

export const FALLBACK_PUBLIC_SITE: PublicSitePayload = {
  isPreview: false,
  settings: FALLBACK_SETTINGS,
  sections: FALLBACK_SECTIONS,
  seo: FALLBACK_SEO,
};
