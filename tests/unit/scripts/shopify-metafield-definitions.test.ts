// tests/unit/scripts/shopify-metafield-definitions.test.ts
import { describe, it, expect } from 'vitest'

import {
  METAFIELD_DEFINITIONS,
  toDefinitionInput,
  type MetafieldDefinitionRow,
} from '@/scripts/shopify/lib/metafield-definitions'

const OWNER_TYPES = ['PRODUCT', 'PRODUCTVARIANT', 'COLLECTION']

describe('METAFIELD_DEFINITIONS', () => {
  it('contains exactly the 7 rows from the plan, in order', () => {
    expect(METAFIELD_DEFINITIONS.map((row) => `${row.ownerType}.${row.key}:${row.type}`)).toEqual([
      'PRODUCT.materials:rich_text_field',
      'PRODUCT.care_guide:rich_text_field',
      'PRODUCT.drop_start:date_time',
      'PRODUCT.drop_end:date_time',
      'PRODUCT.max_per_order:number_integer',
      'COLLECTION.featured:boolean',
      'PRODUCTVARIANT.color_hex:color',
    ])
  })

  it('uses the custom namespace, a known owner type, and a human name + description everywhere', () => {
    for (const row of METAFIELD_DEFINITIONS) {
      expect(row.namespace).toBe('custom')
      expect(OWNER_TYPES).toContain(row.ownerType)
      expect(row.name.length).toBeGreaterThan(0)
      expect(row.description.length).toBeGreaterThan(0)
    }
  })

  it('has unique owner+key pairs', () => {
    const keys = METAFIELD_DEFINITIONS.map((row) => `${row.ownerType}.${row.key}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('toDefinitionInput', () => {
  it('produces a MetafieldDefinitionInput with PUBLIC_READ storefront access and pin: true', () => {
    const row: MetafieldDefinitionRow = METAFIELD_DEFINITIONS[0]
    expect(toDefinitionInput(row)).toEqual({
      name: row.name,
      namespace: 'custom',
      key: row.key,
      type: row.type,
      ownerType: row.ownerType,
      description: row.description,
      pin: true,
      access: { storefront: 'PUBLIC_READ' },
    })
  })

  it('grants storefront PUBLIC_READ to every definition (without it the Storefront API returns null)', () => {
    for (const row of METAFIELD_DEFINITIONS) {
      const input = toDefinitionInput(row)
      expect(input.access).toEqual({ storefront: 'PUBLIC_READ' })
      expect(input.pin).toBe(true)
      expect(Object.keys(input).sort()).toEqual(
        ['access', 'description', 'key', 'name', 'namespace', 'ownerType', 'pin', 'type'].sort()
      )
    }
  })
})
