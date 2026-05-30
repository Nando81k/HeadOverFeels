import { Navigation } from '@/components/layout/Navigation'
import type { HomeProductCard } from '@/components/home/types'
import { HomePageSections } from '@/components/home/HomePageSections'
import { getActiveDrop } from '@/lib/drops'
import { loadHomePageData } from '@/lib/home/homepage-data'
import {
  combineSchemas,
  generateOrganizationSchema,
  generateWebsiteSchema,
  jsonLdScript,
} from '@/lib/seo/schemas'

export const revalidate = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'

function buildHomepageItemListSchema(products: HomeProductCard[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Homepage Product Highlights',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: `${BASE_URL}/products/${product.slug}`,
        image: product.imageUrl,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: product.price.toFixed(2),
          availability: product.isSoldOut
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
        },
      },
    })),
  }
}

function buildPrimarySchemaProducts(data: {
  bestSellers: HomeProductCard[]
  newArrivals: HomeProductCard[]
  trending: HomeProductCard[]
}): HomeProductCard[] {
  const merged = [...data.bestSellers, ...data.newArrivals, ...data.trending]
  const seen = new Set<string>()
  const unique: HomeProductCard[] = []

  for (const product of merged) {
    if (seen.has(product.id)) {
      continue
    }

    unique.push(product)
    seen.add(product.id)

    if (unique.length >= 16) {
      break
    }
  }

  return unique
}

export default async function Home() {
  const [data, activeDrop] = await Promise.all([loadHomePageData(), getActiveDrop()])

  const organizationSchema = generateOrganizationSchema()
  const websiteSchema = generateWebsiteSchema()
  const itemListSchema = buildHomepageItemListSchema(buildPrimarySchemaProducts(data))
  const homeSchemas = combineSchemas(organizationSchema, websiteSchema, itemListSchema)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(homeSchemas) }}
      />

      <div className="bg-white">
        <Navigation />
        <HomePageSections data={data} activeDrop={activeDrop} />
      </div>
    </>
  )
}
