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
    ]
  },
};

export default nextConfig;
