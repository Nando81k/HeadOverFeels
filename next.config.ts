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
    ]
  },
};

export default nextConfig;
