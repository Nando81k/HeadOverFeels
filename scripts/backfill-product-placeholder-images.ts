import { PrismaClient } from '@prisma/client'
import {
  buildProductPlaceholderImages,
  buildVariantPlaceholderImages,
  parseImageList,
  rewritePlaceholderLikeImages,
} from '../lib/commerce/product-placeholders'

const prisma = new PrismaClient()

interface BackfillStats {
  productsScanned: number
  productsUpdated: number
  productImageEntriesRewritten: number
  variantsScanned: number
  variantsUpdated: number
  variantImageEntriesRewritten: number
}

function hasApplyFlag(): boolean {
  return process.argv.includes('--apply')
}

function hasDryRunFlag(): boolean {
  return process.argv.includes('--dry-run')
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

async function runBackfill(): Promise<BackfillStats> {
  const apply = hasApplyFlag()
  const dryRun = hasDryRunFlag() || !apply

  console.log('🧩 Product/variant placeholder image backfill')
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`)
  if (dryRun) {
    console.log('Tip: run with --apply to persist changes.')
  }

  const stats: BackfillStats = {
    productsScanned: 0,
    productsUpdated: 0,
    productImageEntriesRewritten: 0,
    variantsScanned: 0,
    variantsUpdated: 0,
    variantImageEntriesRewritten: 0,
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      images: true,
    },
  })

  stats.productsScanned = products.length

  for (const product of products) {
    const currentImages = parseImageList(product.images)
    const replacementImages = buildProductPlaceholderImages({
      productName: product.name,
      productSlug: product.slug,
    })
    const rewritten = rewritePlaceholderLikeImages(currentImages, replacementImages)

    if (arraysEqual(currentImages, rewritten.images)) {
      continue
    }

    stats.productsUpdated += 1
    stats.productImageEntriesRewritten += rewritten.replacedCount

    if (!dryRun) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          images: JSON.stringify(rewritten.images),
        },
      })
    }
  }

  const variants = await prisma.productVariant.findMany({
    select: {
      id: true,
      color: true,
      colorHex: true,
      size: true,
      images: true,
      product: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  })

  stats.variantsScanned = variants.length

  for (const variant of variants) {
    const currentImages = parseImageList(variant.images)
    const replacementImages = buildVariantPlaceholderImages({
      productName: variant.product.name,
      productSlug: variant.product.slug,
      color: variant.color,
      colorHex: variant.colorHex,
      size: variant.size,
    })
    const rewritten = rewritePlaceholderLikeImages(currentImages, replacementImages)

    if (arraysEqual(currentImages, rewritten.images)) {
      continue
    }

    stats.variantsUpdated += 1
    stats.variantImageEntriesRewritten += rewritten.replacedCount

    if (!dryRun) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          images: JSON.stringify(rewritten.images),
        },
      })
    }
  }

  return stats
}

async function main() {
  const stats = await runBackfill()

  console.log('\n📊 Backfill summary')
  console.log(`Products scanned: ${stats.productsScanned}`)
  console.log(`Products updated: ${stats.productsUpdated}`)
  console.log(`Product image entries rewritten: ${stats.productImageEntriesRewritten}`)
  console.log(`Variants scanned: ${stats.variantsScanned}`)
  console.log(`Variants updated: ${stats.variantsUpdated}`)
  console.log(`Variant image entries rewritten: ${stats.variantImageEntriesRewritten}`)
}

main()
  .catch((error) => {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
