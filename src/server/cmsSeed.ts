import type { CmsPageSlug, PageSectionContent, PageSeoData, WebsiteSettingsMap } from '../types/isp.js';

export interface DefaultSectionSeed {
  page_slug: CmsPageSlug;
  section_key: string;
  section_title: string;
  section_order: number;
  content: PageSectionContent;
}

export const DEFAULT_SECTIONS: DefaultSectionSeed[] = [
  // HOME PAGE
  {
    page_slug: 'home',
    section_key: 'hero',
    section_title: 'Hero Banner',
    section_order: 1,
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
    page_slug: 'home',
    section_key: 'why_choose_us',
    section_title: 'Why Choose Us',
    section_order: 2,
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
    page_slug: 'home',
    section_key: 'packages_preview',
    section_title: 'Internet Packages Preview',
    section_order: 3,
    content: {
      heading: 'Internet Packages',
      description: 'Clear monthly rates in BDT with unlimited data across every tier.',
      primary_cta_text: 'See all packages',
      primary_cta_link: '/packages',
    },
  },
  {
    page_slug: 'home',
    section_key: 'offers_preview',
    section_title: 'Special Offers Preview',
    section_order: 4,
    content: {
      heading: 'Current Promotional Offers',
      description: 'Limited-time savings available for eligible broadband subscriptions.',
      primary_cta_text: 'View all offers',
      primary_cta_link: '/offers',
    },
  },
  {
    page_slug: 'home',
    section_key: 'coverage_preview',
    section_title: 'Coverage Area Preview',
    section_order: 5,
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
    page_slug: 'home',
    section_key: 'cta_banner',
    section_title: 'Call to Action Banner',
    section_order: 6,
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

  // ABOUT US PAGE
  {
    page_slug: 'about',
    section_key: 'intro',
    section_title: 'Company Introduction',
    section_order: 1,
    content: {
      kicker: 'About Roman Communication',
      heading: 'Dependable Local Broadband Built for Sitakunda.',
      description:
        'Headquartered at Gulahammad, Masajidda, Sitakunda, Chattogram, Roman Communication was established to bring stable, fairly priced fiber internet to families, students, and local enterprises. Rather than overpromising distant hubs, we focus on clean optical infrastructure and responsive local care in the communities we know first-hand.',
      primary_cta_text: 'Request Connection',
      primary_cta_link: '#connect',
      secondary_cta_text: 'View Internet Packages',
      secondary_cta_link: '/packages',
      image_url: '/src/assets/images/about_network_noc_1795280419008.jpg',
      image_alt: 'Roman Communication optical fiber distribution rack',
    },
  },
  {
    page_slug: 'about',
    section_key: 'mission_vision',
    section_title: 'Mission, Vision & Commitment',
    section_order: 2,
    content: {
      heading: 'Our Principles',
      items: [
        {
          title: 'Our Mission',
          description:
            'Deliver uninterrupted, high-speed internet connectivity with straightforward pricing and timely technical assistance for every household and business in our service zone.',
        },
        {
          title: 'Our Vision',
          description:
            'Become Sitakunda’s most trusted neighborhood broadband network, supporting digital learning, remote work, and local commerce across Chattogram.',
        },
        {
          title: 'Our Commitment',
          description:
            'Maintain disciplined line quality, proactive maintenance, and transparent customer records so subscribers always receive the bandwidth they signed up for.',
        },
      ],
    },
  },
  {
    page_slug: 'about',
    section_key: 'why_subscribers',
    section_title: 'Why Subscribers Choose Us',
    section_order: 3,
    content: {
      heading: 'Why Subscribers Choose Roman Communication',
      items: [
        {
          index: '01',
          title: 'Direct Local Technicians',
          description:
            'Our field team is stationed right in Masajidda, enabling rapid fiber splicing, router setup, and physical line inspections without multi-day delays.',
        },
        {
          index: '02',
          title: 'Honest Bandwidth Allocation',
          description:
            'Every package reflects real-world usable speeds for video conferencing, cloud backups, and family streaming—backed by clean optical distribution.',
        },
        {
          index: '03',
          title: 'Transparent Subscription Records',
          description:
            'Customers receive clear package assignments, predictable monthly rates, and documented plan upgrades whenever their needs grow.',
        },
        {
          index: '04',
          title: 'Ready for Growing Homes & Businesses',
          description:
            'From single-user study plans to 60 Mbps commercial links, upgrading between plans is seamless with zero line replacement hassle.',
        },
      ],
    },
  },

  // PACKAGES PAGE
  {
    page_slug: 'packages',
    section_key: 'header',
    section_title: 'Packages Page Header',
    section_order: 1,
    content: {
      kicker: 'Broadband Plans',
      heading: 'Internet Packages',
      description:
        'All active fiber broadband plans from Roman Communication. Select a package to request installation in Gulahammad, Masajidda, or Sitakunda.',
    },
  },

  // OFFERS PAGE
  {
    page_slug: 'offers',
    section_key: 'header',
    section_title: 'Offers Page Header',
    section_order: 1,
    content: {
      kicker: 'Promotions',
      heading: 'Special Promotional Offers',
      description:
        'Verified active offers currently within their validity period. Expired or inactive promotions are automatically excluded.',
    },
  },

  // COVERAGE PAGE
  {
    page_slug: 'coverage',
    section_key: 'header',
    section_title: 'Coverage Page Header',
    section_order: 1,
    content: {
      kicker: 'Network Footprint',
      heading: 'Coverage Area',
      description:
        'Confirmed optical fiber availability in Gulahammad, Masajidda, Sitakunda, Chattogram. Only verified active service zones are listed below.',
      image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
      image_alt: 'Sitakunda Chattogram broadband service area',
    },
  },
  {
    page_slug: 'coverage',
    section_key: 'confirmed_zones',
    section_title: 'Confirmed Service Locations',
    section_order: 2,
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

  // CONTACT PAGE
  {
    page_slug: 'contact',
    section_key: 'header',
    section_title: 'Contact Page Header',
    section_order: 1,
    content: {
      kicker: 'Get in Touch',
      heading: 'Contact Us',
      description:
        'Reach out to Roman Communication for new broadband installations, package upgrades, or technical assistance in Sitakunda.',
    },
  },
];

export const DEFAULT_SETTINGS: WebsiteSettingsMap = {
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
  footer_copyright: '© 2026 Roman Communication. All rights reserved.',
  footer_subtext: 'Internet Service Provider · Sitakunda, Chattogram',
};

export const DEFAULT_PAGE_SEO: Record<CmsPageSlug, PageSeoData> = {
  home: {
    seo_title: 'Roman Communication | Internet Service Provider in Sitakunda, Chattogram',
    meta_description:
      'Fast, reliable broadband internet service from Roman Communication in Gulahammad, Masajidda, Sitakunda, Chattogram. View fiber internet packages and apply for a new connection.',
    meta_keywords:
      'Roman Communication, ISP in Sitakunda, Internet Service Provider in Sitakunda, Internet Connection in Masajidda, Broadband Internet in Chattogram',
    og_title: 'Roman Communication | Internet Service Provider in Sitakunda, Chattogram',
    og_description:
      'Reliable high-speed broadband internet for homes and businesses in Gulahammad, Masajidda, Sitakunda, Chattogram.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  about: {
    seo_title: 'About Us | Roman Communication – Sitakunda Broadband ISP',
    meta_description:
      'Learn about Roman Communication, our fiber network infrastructure, mission, and local technical support in Gulahammad, Masajidda, Sitakunda.',
    meta_keywords: 'About Roman Communication, Sitakunda ISP, Masajidda Fiber Network',
    og_title: 'About Roman Communication – Local Fiber ISP in Sitakunda',
    og_description:
      'Dedicated local fiber internet provider serving families and businesses across Sitakunda, Chattogram.',
    og_image_url: '/src/assets/images/about_network_noc_1795280419008.jpg',
    canonical_url: '',
  },
  packages: {
    seo_title: 'Internet Packages | Roman Communication – Sitakunda, Chattogram',
    meta_description:
      'Compare affordable monthly fiber internet packages from Roman Communication with unlimited data and reliable speed tiers in Sitakunda.',
    meta_keywords: 'Sitakunda internet packages, Masajidda broadband price, Roman Communication plans',
    og_title: 'Fiber Internet Packages | Roman Communication',
    og_description: 'Transparent BDT monthly fiber plans for homes and businesses in Sitakunda.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  offers: {
    seo_title: 'Special Offers | Roman Communication Broadband Promotions',
    meta_description:
      'Explore active broadband promotional discounts and seasonal connection offers from Roman Communication in Sitakunda, Chattogram.',
    meta_keywords: 'Roman Communication offers, Sitakunda broadband discount, internet promo',
    og_title: 'Promotional Broadband Offers | Roman Communication',
    og_description: 'Limited-time discounts on new optical fiber connections in Sitakunda.',
    og_image_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    canonical_url: '',
  },
  coverage: {
    seo_title: 'Coverage Area | Roman Communication – Gulahammad, Masajidda, Sitakunda',
    meta_description:
      'Check confirmed fiber broadband availability across Gulahammad, Masajidda, Sitakunda Bazar, and Sadar Road in Chattogram.',
    meta_keywords: 'Internet connection in Masajidda, Gulahammad broadband coverage, Sitakunda ISP area',
    og_title: 'Fiber Coverage Area | Roman Communication',
    og_description: 'Verify optical broadband service availability at your Sitakunda address.',
    og_image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
    canonical_url: '',
  },
  contact: {
    seo_title: 'Contact Us | Roman Communication – Sitakunda, Chattogram',
    meta_description:
      'Contact Roman Communication at Gulahammad, Masajidda, Sitakunda for new broadband connections, upgrades, or technical support.',
    meta_keywords: 'Contact Roman Communication, Sitakunda ISP support, Masajidda office',
    og_title: 'Contact Roman Communication',
    og_description: 'Get in touch with our local broadband support and installation team.',
    og_image_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
    canonical_url: '',
  },
};

export const BUILTIN_MEDIA_SEEDS = [
  {
    file_name: 'roman-communication-logo.png',
    file_url: '/assets/aistudio/image_4c43d9bf.png',
    alt_text: 'Roman Communication Logo',
    file_type: 'image/png',
    file_size: 48200,
    category: 'logo',
  },
  {
    file_name: 'hero-fiber-connectivity.jpg',
    file_url: '/src/assets/images/hero_fiber_connectivity_1795280418498.jpg',
    alt_text: 'Bright modern connected home study powered by Roman Communication broadband',
    file_type: 'image/jpeg',
    file_size: 245000,
    category: 'hero',
  },
  {
    file_name: 'about-network-rack.jpg',
    file_url: '/src/assets/images/about_network_noc_1795280419008.jpg',
    alt_text: 'Roman Communication optical fiber distribution rack',
    file_type: 'image/jpeg',
    file_size: 210000,
    category: 'about',
  },
  {
    file_name: 'coverage-sitakunda-landscape.jpg',
    file_url: '/src/assets/images/coverage_sitakunda_landscape_1795280418727.jpg',
    alt_text: 'Sitakunda Chattogram broadband service area landscape',
    file_type: 'image/jpeg',
    file_size: 230000,
    category: 'banner',
  },
];
