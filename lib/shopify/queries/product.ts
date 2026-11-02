import { storefrontFetch } from '../client'
import type { ProductDetail, ProductOption, ProductVariant } from '../types'
import {
  CATALOG_REVALIDATE,
  PRODUCT_CARD_FIELDS,
  isColorOptionName,
  isHigher,
  toImage,
  toMoney,
  toProductCard,
  type RawImage,
  type RawMoney,
  type RawProductCard,
} from './fragments'

/**
 * PDP document. `gallery: images(first: 12)` is aliased on purpose: it would
 * otherwise conflict with `ProductCardFields.images(first: 2)` (same response
 * key, different arguments) and fail Storefront validation.
 *
 * `options` is selected twice — once inside the card fragment (name + value
 * names/swatches) and once here with ids. GraphQL merges the two selections, so
 * the response carries a single `options` array with every field.
 */
export const PRODUCT_BY_HANDLE_QUERY = `query ProductByHandle($handle: String!) {
  product(handle: $handle) {
    ...ProductCardFields
    descriptionHtml
    vendor
    productType
    seo { title description }
    gallery: images(first: 12) { nodes { ...ImageFields } }
    options { id name optionValues { id name swatch { color } } }
    variants(first: 100) {
      nodes {
        id
        title
        sku
        availableForSale
        quantityAvailable
        price { ...MoneyFields }
        compareAtPrice { ...MoneyFields }
        selectedOptions { name value }
        image { ...ImageFields }
        colorHex: metafield(namespace: "custom", key: "color_hex") { value }
      }
    }
    materials: metafield(namespace: "custom", key: "materials") { value type }
    careGuide: metafield(namespace: "custom", key: "care_guide") { value type }
    dropStart: metafield(namespace: "custom", key: "drop_start") { value }
    dropEnd: metafield(namespace: "custom", key: "drop_end") { value }
    maxPerOrder: metafield(namespace: "custom", key: "max_per_order") { value }
  }
}

${PRODUCT_CARD_FIELDS}`

// ---------------------------------------------------------------- raw shapes

type RawMetafield = { value: string } | null
type RawTypedMetafield = { value: string; type: string } | null

export type RawProductDetailOption = {
  id: string
  name: string
  optionValues: { id: string; name: string; swatch: { color: string | null } | null }[]
}

export type RawProductVariant = {
  id: string
  title: string
  sku: string | null
  availableForSale: boolean
  quantityAvailable: number | null
  price: RawMoney
  compareAtPrice: RawMoney | null
  selectedOptions: { name: string; value: string }[]
  image: RawImage | null
  colorHex: RawMetafield
}

export type RawProductDetail = Omit<RawProductCard, 'options'> & {
  descriptionHtml: string
  vendor: string
  productType: string
  seo: { title: string | null; description: string | null }
  gallery: { nodes: RawImage[] } | null
  options: RawProductDetailOption[] | null
  variants: { nodes: RawProductVariant[] } | null
  materials: RawTypedMetafield
  careGuide: RawTypedMetafield
  dropStart: RawMetafield
  dropEnd: RawMetafield
  maxPerOrder: RawMetafield
}

type ProductByHandleResponse = { product: RawProductDetail | null }

// ---------------------------------------------------------------- normaliser

function toOption(raw: RawProductDetailOption): ProductOption {
  return {
    id: raw.id,
    name: raw.name,
    values: raw.optionValues.map((value) => ({
      id: value.id,
      name: value.name,
      swatchColor: value.swatch?.color ?? null,
    })),
  }
}

function toVariant(raw: RawProductVariant): ProductVariant {
  return {
    id: raw.id,
    title: raw.title,
    sku: raw.sku ?? null,
    availableForSale: raw.availableForSale,
    quantityAvailable: raw.quantityAvailable ?? null,
    price: toMoney(raw.price),
    compareAtPrice: raw.compareAtPrice ? toMoney(raw.compareAtPrice) : null,
    selectedOptions: raw.selectedOptions.map((o) => ({ name: o.name, value: o.value })),
    image: toImage(raw.image),
    colorHex: raw.colorHex?.value ?? null,
  }
}

/** Colour-value name -> `custom.color_hex` of the first variant carrying that value. */
function variantColorHexByValue(variants: ProductVariant[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const variant of variants) {
    if (!variant.colorHex) continue
    const selected = variant.selectedOptions.find((o) => isColorOptionName(o.name))
    if (selected && !map.has(selected.value)) map.set(selected.value, variant.colorHex)
  }
  return map
}

function toIntOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

export function normalizeProduct(raw: RawProductDetail): ProductDetail {
  const card = toProductCard({ ...raw, options: raw.options })
  const options = (raw.options ?? []).map(toOption)
  const variants = (raw.variants?.nodes ?? []).map(toVariant)

  // A colour value with no admin swatch falls back to the variant metafield.
  const fallbackColors = variantColorHexByValue(variants)
  const swatches = card.swatches.map((swatch) => ({
    name: swatch.name,
    color: swatch.color ?? fallbackColors.get(swatch.name) ?? null,
  }))

  // The card-level compare-at range reads 0.0 when only *some* variants are on
  // sale, so the sale badge is decided per variant.
  const onSale =
    card.compareAtPrice !== null ||
    (raw.variants?.nodes ?? []).some((variant) => isHigher(variant.compareAtPrice, variant.price))

  const badges: ProductDetail['badges'] = []
  if (onSale) badges.push('sale')
  if (raw.tags.includes('drop')) badges.push('drop')
  if (raw.tags.includes('new-arrival')) badges.push('new')
  if (!raw.availableForSale) badges.push('soldout')

  const drop = raw.tags.includes('drop')
    ? {
        start: raw.dropStart?.value ?? null,
        end: raw.dropEnd?.value ?? null,
        maxPerOrder: toIntOrNull(raw.maxPerOrder?.value),
      }
    : null

  return {
    ...card,
    swatches,
    badges,
    descriptionHtml: raw.descriptionHtml,
    vendor: raw.vendor,
    productType: raw.productType,
    tags: raw.tags,
    seo: { title: raw.seo?.title ?? null, description: raw.seo?.description ?? null },
    images: (raw.gallery?.nodes ?? []).flatMap((node) => {
      const image = toImage(node)
      return image ? [image] : []
    }),
    options,
    variants,
    materials: raw.materials?.value ?? null,
    careGuide: raw.careGuide?.value ?? null,
    drop,
  }
}

// ---------------------------------------------------------------- fetcher

export async function getProduct(handle: string): Promise<ProductDetail | null> {
  const data = await storefrontFetch<ProductByHandleResponse>(PRODUCT_BY_HANDLE_QUERY, {
    variables: { handle },
    tags: [`product:${handle}`],
    revalidate: CATALOG_REVALIDATE,
  })
  return data.product ? normalizeProduct(data.product) : null
}
