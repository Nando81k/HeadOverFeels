/**
 * Metafield definitions for the Shopify-backed storefront (Phase 1, Task 3).
 *
 * Source of truth: docs/superpowers/plans/2026-09-06-storefront-rebuild-phase1-foundation.md
 * ("Shared contracts" → metafield definitions table). Every definition is granted
 * `access.storefront = PUBLIC_READ`; without it every `metafield(...)` selection in the
 * Storefront API queries returns `null`.
 *
 * Pure data + mapping only — no I/O, so it is unit-testable without Shopify credentials.
 */

/** Owner resource for a metafield definition (Admin API `MetafieldOwnerType`). */
export type MetafieldOwnerType = 'PRODUCT' | 'PRODUCTVARIANT' | 'COLLECTION'

/** One row of the plan's metafield table. */
export interface MetafieldDefinitionRow {
  /** Human-readable name shown in the Shopify admin. */
  name: string
  /** Always `custom` — the reserved app-less namespace used by this store. */
  namespace: 'custom'
  key: string
  /** Shopify metafield type id, e.g. `rich_text_field`, `date_time`, `number_integer`. */
  type: string
  ownerType: MetafieldOwnerType
  description: string
}

/** Admin API 2026-07 `MetafieldDefinitionInput` (the subset this script sets). */
export interface MetafieldDefinitionInput {
  name: string
  namespace: string
  key: string
  type: string
  ownerType: MetafieldOwnerType
  description: string
  /** Pin the definition so it shows up on the resource page in the admin. */
  pin: true
  access: { storefront: 'PUBLIC_READ' }
}

export const METAFIELD_DEFINITIONS: readonly MetafieldDefinitionRow[] = [
  {
    name: 'Materials',
    namespace: 'custom',
    key: 'materials',
    type: 'rich_text_field',
    ownerType: 'PRODUCT',
    description: 'Fabric and material composition shown on the product detail page.',
  },
  {
    name: 'Care guide',
    namespace: 'custom',
    key: 'care_guide',
    type: 'rich_text_field',
    ownerType: 'PRODUCT',
    description: 'Washing and care instructions shown on the product detail page.',
  },
  {
    name: 'Drop start',
    namespace: 'custom',
    key: 'drop_start',
    type: 'date_time',
    ownerType: 'PRODUCT',
    description: 'When a limited-edition drop goes live. Paired with the "drop" tag.',
  },
  {
    name: 'Drop end',
    namespace: 'custom',
    key: 'drop_end',
    type: 'date_time',
    ownerType: 'PRODUCT',
    description: 'When a limited-edition drop closes. Paired with the "drop" tag.',
  },
  {
    name: 'Max per order',
    namespace: 'custom',
    key: 'max_per_order',
    type: 'number_integer',
    ownerType: 'PRODUCT',
    description: 'Purchase limit per order for a limited-edition drop.',
  },
  {
    name: 'Featured',
    namespace: 'custom',
    key: 'featured',
    type: 'boolean',
    ownerType: 'COLLECTION',
    description: 'Whether the collection is surfaced in featured storefront modules.',
  },
  {
    name: 'Colour hex',
    namespace: 'custom',
    key: 'color_hex',
    type: 'color',
    ownerType: 'PRODUCTVARIANT',
    description: 'Swatch colour for the variant, used when the option has no Shopify swatch.',
  },
] as const

/** Maps a table row to the `MetafieldDefinitionInput` accepted by `metafieldDefinitionCreate`. */
export function toDefinitionInput(row: MetafieldDefinitionRow): MetafieldDefinitionInput {
  return {
    name: row.name,
    namespace: row.namespace,
    key: row.key,
    type: row.type,
    ownerType: row.ownerType,
    description: row.description,
    pin: true,
    access: { storefront: 'PUBLIC_READ' },
  }
}
