/**
 * Dynamic Sitemap Generator
 * 
 * Generates XML sitemap for all public pages, products, collections, and drops
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering (sitemap needs DB access)
export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/collections`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/loyalty`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  // Get all active products
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Get all active collections
  const collections = await prisma.collection.findMany({
    where: {
      isActive: true,
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  const collectionPages: MetadataRoute.Sitemap = collections.map((collection) => ({
    url: `${BASE_URL}/collections/${collection.slug}`,
    lastModified: collection.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Get limited edition drops (products with isLimitedEdition)
  const now = new Date()
  const drops = await prisma.product.findMany({
    where: {
      isActive: true,
      isLimitedEdition: true,
      OR: [
        { dropEndDate: { gte: now } }, // Active or upcoming
        { 
          dropEndDate: { lt: now },
          releaseDate: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } // Past 30 days
        },
      ],
    },
    select: {
      slug: true,
      updatedAt: true,
      releaseDate: true,
    },
    orderBy: {
      releaseDate: 'desc',
    },
  })

  const dropPages: MetadataRoute.Sitemap = drops.map((drop) => ({
    url: `${BASE_URL}/drops/${drop.slug}`,
    lastModified: drop.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.9, // Drops are high priority
  }))

  // Get active categories
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  })

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/products?category=${category.slug}`,
    lastModified: category.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [
    ...staticPages,
    ...productPages,
    ...collectionPages,
    ...dropPages,
    ...categoryPages,
  ]
}
