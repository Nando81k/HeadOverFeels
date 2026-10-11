import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Removed standalone output - it was preventing Prisma binaries from being included
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.headoverfeels.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/admin/orders/:id',
        destination: '/admin/fulfillment?orderId=:id',
        permanent: true,
      },
      {
        source: '/admin/orders',
        destination: '/admin/fulfillment',
        permanent: true,
      },
      {
        source: '/admin/fulfillment/details',
        destination: '/admin/fulfillment',
        permanent: true,
      },
      // Storefront rebuild (Phase 2): the legacy standalone policy pages and
      // the `/products` index were replaced by Shopify-backed routes.
      {
        source: '/privacy',
        destination: '/policies/privacy-policy',
        permanent: true,
      },
      {
        source: '/terms',
        destination: '/policies/terms-of-service',
        permanent: true,
      },
      // Exactly `/products` — `/products/:handle` is a real PDP route.
      {
        source: '/products',
        destination: '/collections/all',
        permanent: true,
      },
      // Storefront rebuild (Phase 3): checkout happens on Shopify and the
      // custom checkout/confirmation pages are gone. Order history lives at
      // `/account/orders` (Phase 4).
      {
        source: '/checkout',
        destination: '/cart',
        permanent: true,
      },
      {
        source: '/order/confirmation',
        destination: '/account/orders',
        permanent: true,
      },
      // Storefront rebuild (Phase 4): the legacy customer auth, profile,
      // orders and loyalty pages were removed; accounts live under
      // `/account/*` (Shopify Customer Account API) and Care Points under
      // `/loyalty`. `/signin` is the admin login and is NOT redirected.
      {
        source: '/forgot-password',
        destination: '/account/login',
        permanent: true,
      },
      {
        source: '/reset-password',
        destination: '/account/login',
        permanent: true,
      },
      {
        source: '/verify-email',
        destination: '/account/login',
        permanent: true,
      },
      {
        source: '/profile',
        destination: '/account',
        permanent: true,
      },
      {
        source: '/profile/:path*',
        destination: '/account',
        permanent: true,
      },
      {
        source: '/orders',
        destination: '/account/orders',
        permanent: true,
      },
      {
        source: '/orders/:id/track',
        destination: '/account/orders/:id',
        permanent: true,
      },
      {
        source: '/order/track/:id',
        destination: '/account/orders/:id',
        permanent: true,
      },
      {
        source: '/loyalty/rewards',
        destination: '/loyalty#rewards',
        permanent: true,
      },
      {
        source: '/loyalty/tiers',
        destination: '/loyalty#tiers',
        permanent: true,
      },
      {
        source: '/loyalty/points',
        destination: '/loyalty#history',
        permanent: true,
      },
      {
        source: '/loyalty/history',
        destination: '/loyalty#history',
        permanent: true,
      },
      {
        source: '/loyalty/referrals',
        destination: '/loyalty#refer',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
