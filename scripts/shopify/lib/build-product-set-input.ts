/**
 * Pure Prisma → Shopify `ProductSetInput` mapper (Phase 1, Task 4).
 *
 * No I/O and no Prisma import: `MigrationProduct` is a structural type covering only the
 * Prisma `Product` / `ProductVariant` / `Category` / `Collection` fields the migration reads,
 * so the shape a `prisma.product.findMany({ include: ... })` returns is assignable to it and
 * tests can build fixtures without a database.
 *
 * Target: Admin API 2026-07 `ProductSetInput`. The GraphQL documents that consume this live in
 * scripts/shopify/migrate-catalog.ts and must be validated before the first `--apply` run.
 */

// ---------------------------------------------------------------------------
// Input (Prisma-shaped)
// ---------------------------------------------------------------------------

/** Prisma `DateTime` columns arrive as `Date`; JSON round-trips arrive as ISO strings. */
export type MigrationDate = Date | string | null

/** The `ProductVariant` columns the migration reads. */
export interface MigrationVariant {
  id: string
  sku: string
  size: string | null
  color: string | null
  colorHex: string | null
  /** JSON string of image URLs (or `[{ url }]` objects), like `Product.images`. */
  images: string | null
  /** Variant price override; falls back to `Product.price` when null. */
  price: number | null
  inventory: number
  isActive: boolean
  costPrice: number | null
}

/** The `Category` columns the migration reads. */
export interface MigrationCategory {
  name: string
  slug: string
}

/** One `CollectionProduct` join row with its `Collection`. */
export interface MigrationCollectionLink {
  sortOrder: number
  collection: {
    slug: string
    name: string
  }
}

/** The `Product` columns the migration reads, plus its relations. */
export interface MigrationProduct {
  id: string
  name: string
  description: string | null
  slug: string
  price: number
  compareAtPrice: number | null
  /** JSON string of image URLs. */
  images: string
  materials: string | null
  careGuide: string | null
  isLimitedEdition: boolean
  releaseDate: MigrationDate
  dropEndDate: MigrationDate
  maxQuantity: number | null
  isActive: boolean
  isFeatured: boolean
  isFeaturedNewArrival: boolean
  costPrice: number | null
  variants: MigrationVariant[]
  category: MigrationCategory | null
  collections: MigrationCollectionLink[]
}

// ---------------------------------------------------------------------------
// Output (Admin API `ProductSetInput`)
// ---------------------------------------------------------------------------

export interface MetafieldSetInput {
  namespace: string
  key: string
  type: string
  value: string
}

export interface FileSetInput {
  originalSource: string
  contentType: 'IMAGE'
}

export interface VariantOptionValueInput {
  optionName: string
  name: string
}

export interface ProductSetInventoryInput {
  locationId: string
  name: 'available'
  quantity: number
}

export interface ProductVariantSetInput {
  sku?: string
  price: string
  compareAtPrice?: string
  optionValues?: VariantOptionValueInput[]
  inventoryQuantities: ProductSetInventoryInput[]
  inventoryItem?: { cost: string; tracked: true }
  metafields?: MetafieldSetInput[]
  file?: FileSetInput
}

export interface OptionSetInput {
  name: string
  values: { name: string }[]
}

export interface ProductSetInput {
  /** Set by the migration script when an existing product is being updated in place. */
  id?: string
  handle: string
  title: string
  descriptionHtml: string
  productType: string
  status: 'ACTIVE' | 'DRAFT'
  tags: string[]
  productOptions?: OptionSetInput[]
  files?: FileSetInput[]
  variants: ProductVariantSetInput[]
  metafields?: MetafieldSetInput[]
}

export interface BuildProductSetInputOptions {
  /** Location GID inventory is set at, e.g. `gid://shopify/Location/123`. */
  locationId: string
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
// Shopify fetches `file.originalSource` itself, so only absolute http(s) URLs are usable.
// Site-relative placeholders (e.g. /assets/coming-soon-placeholder.svg) are skipped.
const REMOTE_URL = /^https?:\/\//i
const SIZE_OPTION = 'Size'
const COLOR_OPTION = 'Color'

/** Shopify `rich_text_field` documents are a JSON string with this exact root shape. */
export function toRichTextJson(text: string): string {
  return JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }],
  })
}

/** Parses the JSON `images` column into a list of remote image URLs, tolerating bad data. */
function parseImageUrls(raw: string | null | undefined): string[] {
  if (typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  // A bare (non-JSON) value is only useful if it is already a remote image URL.
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return REMOTE_URL.test(trimmed) ? [trimmed] : []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed]
  return entries
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && 'url' in entry) {
        const url = (entry as { url?: unknown }).url
        return typeof url === 'string' ? url.trim() : ''
      }
      return ''
    })
    .filter((url) => REMOTE_URL.test(url))
}

function money(value: number): string {
  return value.toFixed(2)
}

function toIsoString(value: MigrationDate): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Distinct non-empty values of `pick` across the variants, in first-seen order. */
function distinctValues(
  variants: MigrationVariant[],
  pick: (variant: MigrationVariant) => string | null
): string[] {
  const seen: string[] = []
  for (const variant of variants) {
    const raw = pick(variant)
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value && !seen.includes(value)) seen.push(value)
  }
  return seen
}

/** Plain text becomes a single paragraph; anything already containing markup is passed through. */
function toDescriptionHtml(description: string | null): string {
  const text = (description ?? '').trim()
  if (!text) return ''
  return text.includes('<') ? text : `<p>${text}</p>`
}

function buildTags(product: MigrationProduct): string[] {
  const tags: string[] = []
  if (product.isLimitedEdition) tags.push('drop')
  if (product.isFeatured) tags.push('featured')
  if (product.isFeaturedNewArrival) tags.push('new-arrival')
  return tags
}

function buildProductMetafields(product: MigrationProduct): MetafieldSetInput[] {
  const metafields: MetafieldSetInput[] = []

  const materials = product.materials?.trim()
  if (materials) {
    metafields.push({
      namespace: 'custom',
      key: 'materials',
      type: 'rich_text_field',
      value: toRichTextJson(materials),
    })
  }

  const careGuide = product.careGuide?.trim()
  if (careGuide) {
    metafields.push({
      namespace: 'custom',
      key: 'care_guide',
      type: 'rich_text_field',
      value: toRichTextJson(careGuide),
    })
  }

  const dropStart = toIsoString(product.releaseDate)
  if (dropStart) {
    metafields.push({
      namespace: 'custom',
      key: 'drop_start',
      type: 'date_time',
      value: dropStart,
    })
  }

  const dropEnd = toIsoString(product.dropEndDate)
  if (dropEnd) {
    metafields.push({ namespace: 'custom', key: 'drop_end', type: 'date_time', value: dropEnd })
  }

  if (typeof product.maxQuantity === 'number') {
    metafields.push({
      namespace: 'custom',
      key: 'max_per_order',
      type: 'number_integer',
      value: String(Math.trunc(product.maxQuantity)),
    })
  }

  return metafields
}

function buildVariant(
  product: MigrationProduct,
  variant: MigrationVariant,
  options: { hasSize: boolean; hasColor: boolean },
  locationId: string
): ProductVariantSetInput {
  const price = variant.price ?? product.price
  const compareAt = product.compareAtPrice
  const size = variant.size?.trim() ?? ''
  const color = variant.color?.trim() ?? ''

  const optionValues: VariantOptionValueInput[] = []
  if (options.hasSize && size) optionValues.push({ optionName: SIZE_OPTION, name: size })
  if (options.hasColor && color) optionValues.push({ optionName: COLOR_OPTION, name: color })

  // Variant unit cost: the variant's own cost price, falling back to the product's
  // (scripts/add-cost-prices.ts writes both, older rows only have the product one).
  const cost = variant.costPrice ?? product.costPrice
  const firstImage = parseImageUrls(variant.images)[0]

  const built: ProductVariantSetInput = {
    price: money(price),
    inventoryQuantities: [
      { locationId, name: 'available', quantity: variant.inventory ?? 0 },
    ],
  }

  if (variant.sku) built.sku = variant.sku
  if (typeof compareAt === 'number' && compareAt > price) built.compareAtPrice = money(compareAt)
  if (optionValues.length > 0) built.optionValues = optionValues
  if (typeof cost === 'number') built.inventoryItem = { cost: money(cost), tracked: true }
  if (variant.colorHex && HEX_COLOR.test(variant.colorHex)) {
    built.metafields = [
      { namespace: 'custom', key: 'color_hex', type: 'color', value: variant.colorHex },
    ]
  }
  if (firstImage) built.file = { originalSource: firstImage, contentType: 'IMAGE' }

  return built
}

/**
 * Builds the `ProductSetInput` for one Prisma product.
 *
 * Options are `Size` and `Color`, taken from the distinct non-null variant values in
 * first-seen order. A product whose variants have neither gets no `productOptions` and a
 * single default variant (Shopify titles it "Default Title") with `optionValues` omitted.
 */
export function buildProductSetInput(
  product: MigrationProduct,
  opts: BuildProductSetInputOptions
): ProductSetInput {
  const { locationId } = opts
  const variants = product.variants ?? []

  const sizes = distinctValues(variants, (variant) => variant.size)
  const colors = distinctValues(variants, (variant) => variant.color)
  const hasSize = sizes.length > 0
  const hasColor = colors.length > 0

  const productOptions: OptionSetInput[] = []
  if (hasSize) {
    productOptions.push({ name: SIZE_OPTION, values: sizes.map((name) => ({ name })) })
  }
  if (hasColor) {
    productOptions.push({ name: COLOR_OPTION, values: colors.map((name) => ({ name })) })
  }

  // With no options Shopify allows exactly one (default-titled) variant.
  const sourceVariants =
    productOptions.length === 0 ? variants.slice(0, 1) : variants

  const builtVariants =
    sourceVariants.length > 0
      ? sourceVariants.map((variant) =>
          buildVariant(product, variant, { hasSize, hasColor }, locationId)
        )
      : [
          {
            price: money(product.price),
            inventoryQuantities: [
              { locationId, name: 'available' as const, quantity: 0 },
            ],
          },
        ]

  // Every file referenced by a variant must also appear in the product's `files`.
  const fileUrls: string[] = []
  for (const url of parseImageUrls(product.images)) {
    if (!fileUrls.includes(url)) fileUrls.push(url)
  }
  for (const variant of variants) {
    const url = parseImageUrls(variant.images)[0]
    if (url && !fileUrls.includes(url)) fileUrls.push(url)
  }

  const metafields = buildProductMetafields(product)

  const input: ProductSetInput = {
    handle: product.slug,
    title: product.name,
    descriptionHtml: toDescriptionHtml(product.description),
    productType: product.category?.name ?? '',
    status: product.isActive ? 'ACTIVE' : 'DRAFT',
    tags: buildTags(product),
    variants: builtVariants,
  }

  if (productOptions.length > 0) input.productOptions = productOptions
  if (fileUrls.length > 0) {
    input.files = fileUrls.map((originalSource) => ({
      originalSource,
      contentType: 'IMAGE' as const,
    }))
  }
  if (metafields.length > 0) input.metafields = metafields

  return input
}
