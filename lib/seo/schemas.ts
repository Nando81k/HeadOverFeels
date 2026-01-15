/**
 * SEO Utilities
 * 
 * JSON-LD structured data generators for improved search visibility
 * @see https://schema.org/
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */

// ===== TYPE DEFINITIONS =====

export interface ProductSchemaData {
  name: string
  description: string
  slug: string
  images: string[]
  price: number
  compareAtPrice?: number | null
  sku?: string
  brand?: string
  category?: string
  inStock: boolean
  reviewCount?: number
  averageRating?: number
}

export interface OrganizationSchemaData {
  name: string
  url: string
  logo: string
  description: string
  email?: string
  phone?: string
  address?: {
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  socialMedia?: {
    instagram?: string
    twitter?: string
    facebook?: string
    tiktok?: string
  }
}

export interface BreadcrumbItem {
  name: string
  url: string
}

// ===== CONSTANTS =====

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'

const DEFAULT_ORGANIZATION: OrganizationSchemaData = {
  name: 'Head Over Feels',
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description: 'Premium streetwear and fashion brand delivering bold, expressive designs for those who lead with their emotions.',
  email: 'support@headoverfeels.com',
  socialMedia: {
    instagram: 'https://instagram.com/headoverfeels',
    twitter: 'https://twitter.com/headoverfeels',
    tiktok: 'https://tiktok.com/@headoverfeels',
  },
}

// ===== SCHEMA GENERATORS =====

/**
 * Generate Product schema (JSON-LD)
 */
export function generateProductSchema(product: ProductSchemaData): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images,
    url: `${BASE_URL}/products/${product.slug}`,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'Head Over Feels',
    },
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/products/${product.slug}`,
      priceCurrency: 'USD',
      price: product.price.toFixed(2),
      availability: product.inStock 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Head Over Feels',
      },
    },
  }

  // Add SKU if available
  if (product.sku) {
    schema.sku = product.sku
  }

  // Add category if available
  if (product.category) {
    schema.category = product.category
  }

  // Add aggregate rating if reviews exist
  if (product.reviewCount && product.reviewCount > 0 && product.averageRating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating.toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: '5',
      worstRating: '1',
    }
  }

  // Add sale price if on sale
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    const offers = schema.offers as Record<string, unknown>
    offers.priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    offers.highPrice = product.compareAtPrice.toFixed(2)
  }

  return schema
}

/**
 * Generate Organization schema (JSON-LD)
 */
export function generateOrganizationSchema(org: OrganizationSchemaData = DEFAULT_ORGANIZATION): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo,
    description: org.description,
  }

  if (org.email) {
    schema.email = org.email
  }

  if (org.phone) {
    schema.telephone = org.phone
  }

  if (org.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: org.address.street,
      addressLocality: org.address.city,
      addressRegion: org.address.state,
      postalCode: org.address.zip,
      addressCountry: org.address.country,
    }
  }

  if (org.socialMedia) {
    const sameAs = Object.values(org.socialMedia).filter(Boolean)
    if (sameAs.length > 0) {
      schema.sameAs = sameAs
    }
  }

  return schema
}

/**
 * Generate WebSite schema with search action (JSON-LD)
 */
export function generateWebsiteSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Head Over Feels',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Generate BreadcrumbList schema (JSON-LD)
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  }
}

/**
 * Generate CollectionPage schema (JSON-LD)
 */
export function generateCollectionSchema(collection: {
  name: string
  description: string
  slug: string
  image?: string
  productCount: number
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.name,
    description: collection.description,
    url: `${BASE_URL}/collections/${collection.slug}`,
    image: collection.image,
    numberOfItems: collection.productCount,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: collection.productCount,
    },
  }
}

/**
 * Generate Event schema for Limited Drops (JSON-LD)
 */
export function generateDropEventSchema(drop: {
  name: string
  description: string
  slug: string
  image?: string
  startDate: Date
  endDate: Date
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SaleEvent',
    name: drop.name,
    description: drop.description,
    url: `${BASE_URL}/drops/${drop.slug}`,
    image: drop.image,
    startDate: drop.startDate.toISOString(),
    endDate: drop.endDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: `${BASE_URL}/drops/${drop.slug}`,
    },
    organizer: {
      '@type': 'Organization',
      name: 'Head Over Feels',
      url: BASE_URL,
    },
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/drops/${drop.slug}`,
      availability: new Date() < drop.startDate 
        ? 'https://schema.org/PreOrder'
        : 'https://schema.org/InStock',
    },
  }
}

/**
 * Generate FAQ schema (JSON-LD)
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// ===== REACT COMPONENT HELPERS =====

/**
 * Generate script tag content for JSON-LD
 */
export function jsonLdScript(schema: object): string {
  return JSON.stringify(schema)
}

/**
 * Combine multiple schemas into a graph
 */
export function combineSchemas(...schemas: object[]): object {
  return {
    '@context': 'https://schema.org',
    '@graph': schemas.map(schema => {
      // Remove @context from individual schemas when combining
      const { '@context': _, ...rest } = schema as Record<string, unknown>
      return rest
    }),
  }
}
