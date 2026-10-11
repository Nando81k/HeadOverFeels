import * as React from 'react'
import Link from 'next/link'
import { isColorOptionName } from '@/lib/shopify/queries/fragments'
import type { ProductDetail, ProductOption } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import {
  optionValueAvailability,
  variantHref,
  type OptionValueAvailability,
  type SelectedOptions,
} from '@/lib/storefront/variants'

export interface VariantSelectorProps {
  product: ProductDetail
  /** Current selection, from `selectVariant`. */
  selectedOptions: SelectedOptions
  /** Page the option links point back at (`/products/<handle>`). */
  pathname: string
}

/**
 * The colour a swatch should paint: the admin swatch, else the `custom.color_hex`
 * of a variant carrying that value. Merchandiser data, so it lands as an inline
 * `background-color` rather than a token.
 */
function swatchColor(product: ProductDetail, option: ProductOption, value: string): string | null {
  const fromOption = option.values.find((candidate) => candidate.name === value)?.swatchColor
  if (fromOption) return fromOption

  const fromVariant = product.variants.find(
    (variant) =>
      variant.colorHex !== null &&
      variant.selectedOptions.some(
        (selected) => isColorOptionName(selected.name) && selected.value === value
      )
  )
  return fromVariant?.colorHex ?? null
}

/** Case-insensitive read of the current value for an option. */
function selectedValue(selectedOptions: SelectedOptions, name: string): string | undefined {
  const key = Object.keys(selectedOptions).find(
    (candidate) => candidate.trim().toLowerCase() === name.trim().toLowerCase()
  )
  return key ? selectedOptions[key] : undefined
}

/**
 * Variant pickers (spec §5.4): colour swatches and size chips, both rendered as
 * links so variant state stays in the URL and the page works without JS. A
 * combination that exists but is out of stock stays navigable — customers need
 * to be able to land on it and see "Sold out".
 *
 * Server-safe: no state, no handlers.
 */
export function VariantSelector({ product, selectedOptions, pathname }: VariantSelectorProps) {
  const options = product.options.filter((option) => option.values.length > 0)
  if (options.length === 0) return null

  return (
    <div data-variant-selector="" className="flex flex-col gap-6">
      {options.map((option) => {
        const selected = selectedValue(selectedOptions, option.name)
        const isColor = isColorOptionName(option.name)

        return (
          <div key={option.id} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-ink-mute">
              {selected ? `${option.name} — ${selected}` : option.name}
            </p>

            <div
              role="group"
              aria-label={option.name}
              className={cn('flex flex-wrap items-center', isColor ? 'gap-3' : 'gap-2')}
            >
              {option.values.map((value) => {
                const availability: OptionValueAvailability = optionValueAvailability(
                  product,
                  selectedOptions,
                  option.name,
                  value.name
                )
                const active = selected === value.name
                const href = variantHref(pathname, selectedOptions, {
                  name: option.name,
                  value: value.name,
                })
                const shared = {
                  href,
                  scroll: false as const,
                  title: value.name,
                  'data-availability': availability,
                  'aria-current': active ? ('true' as const) : undefined,
                  'aria-disabled': availability === 'available' ? undefined : ('true' as const),
                }

                if (isColor) {
                  const color = swatchColor(product, option, value.name)
                  return (
                    <Link
                      key={value.id}
                      {...shared}
                      aria-label={value.name}
                      style={{ backgroundColor: color ?? undefined }}
                      className={cn(
                        'size-8 rounded-pill border border-line-strong',
                        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
                        color ? null : 'bg-line',
                        active && 'outline-2 outline-solid outline-ink outline-offset-2',
                        availability === 'soldout' && 'opacity-60',
                        availability === 'unavailable' && 'opacity-40'
                      )}
                    />
                  )
                }

                return (
                  <Link
                    key={value.id}
                    {...shared}
                    className={cn(
                      'inline-flex h-11 items-center rounded-sharp border px-4 text-sm',
                      'transition-colors duration-sf-fast ease-sf-out',
                      'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
                      active
                        ? 'border-ink bg-ink text-bone'
                        : 'border-line-strong text-ink hover:border-ink',
                      availability === 'soldout' && 'border-line text-ink-mute line-through',
                      availability === 'unavailable' && 'border-line text-ink-mute opacity-40'
                    )}
                  >
                    {value.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
