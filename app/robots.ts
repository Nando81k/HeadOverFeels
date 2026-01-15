/**
 * Robots.txt Configuration
 * 
 * Controls search engine crawler behavior
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',           // Admin dashboard
          '/api/',             // API endpoints
          '/checkout/',        // Checkout flow
          '/cart/',            // Shopping cart
          '/profile/',         // User profile
          '/orders/',          // Order history
          '/signin/',          // Authentication
          '/_next/',           // Next.js internals
          '/order/confirmation', // Order confirmation
        ],
      },
      {
        // Googlebot-specific rules
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout/',
          '/cart/',
          '/profile/',
          '/orders/',
          '/signin/',
        ],
      },
      {
        // Block aggressive bots
        userAgent: 'AhrefsBot',
        disallow: '/',
      },
      {
        userAgent: 'SemrushBot',
        crawlDelay: 10,
        allow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
