export type PlaceholderView = 'front' | 'back' | 'detail'

export interface PlaceholderImageContext {
  productName: string
  productSlug?: string | null
  color?: string | null
  colorHex?: string | null
  size?: string | null
  view?: PlaceholderView
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 1000
const DEFAULT_NEUTRAL_HEX = '#1A1A1A'
const DEFAULT_LIGHT_TEXT_HEX = '#FFFFFF'
const DEFAULT_DARK_TEXT_HEX = '#111111'

const PLACEHOLDER_HOSTS = new Set([
  'placehold.co',
  'via.placeholder.com',
  'images.unsplash.com',
  'cdn.headoverfeels.com',
])

const FALLBACK_COLOR_MAP: Record<string, string> = {
  black: '#111111',
  white: '#f8f8f8',
  cream: '#f2ebdd',
  beige: '#d8c2a4',
  sand: '#c7b79d',
  heather: '#9ca3af',
  gray: '#6b7280',
  grey: '#6b7280',
  charcoal: '#3f3f46',
  navy: '#1d2e4f',
  blue: '#3b5a9a',
  sky: '#90aed7',
  rose: '#c4878a',
  pink: '#d96a8b',
  burgundy: '#7f1d1d',
  red: '#b91c1c',
  green: '#356b43',
  forest: '#2f4a3c',
  olive: '#6b7b3f',
  mocha: '#6e5443',
  brown: '#6f4e37',
  tan: '#c59d72',
  yellow: '#d4a017',
  purple: '#5b4ea3',
}

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$/

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function clampChannel(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return Math.round(value)
}

function toHexChannel(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0').toUpperCase()
}

function normalizeHexBody(value: string): string | null {
  const trimmed = value.trim()
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null
  }

  const cleaned = trimmed.replace('#', '')
  if (cleaned.length === 3) {
    return cleaned
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()
  }

  return cleaned.toUpperCase()
}

function hexBodyToRgb(hexBody: string): [number, number, number] {
  const red = parseInt(hexBody.slice(0, 2), 16)
  const green = parseInt(hexBody.slice(2, 4), 16)
  const blue = parseInt(hexBody.slice(4, 6), 16)
  return [red, green, blue]
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`
}

function shadeHex(hex: string, amount: number): string {
  const normalized = normalizeHexColor(hex)
  if (!normalized) {
    return DEFAULT_NEUTRAL_HEX
  }

  const [red, green, blue] = hexBodyToRgb(normalized.replace('#', ''))
  return rgbToHex(red + amount, green + amount, blue + amount)
}

function truncateLabel(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function fallbackNeutralHex(seed: string): string {
  const neutralPalette = ['#111111', '#171717', '#1F2937', '#374151', '#262626', '#0F172A']
  const index = hashString(seed.toLowerCase()) % neutralPalette.length
  return neutralPalette[index]
}

function buildTextLines(context: PlaceholderImageContext): string[] {
  const productLabel = truncateLabel(context.productName || context.productSlug || 'Head Over Feels', 30)
  const variantBits = [context.color, context.size].filter(Boolean).map((value) => truncateLabel(String(value), 16))
  const variantLabel = variantBits.length > 0 ? variantBits.join(' • ').toUpperCase() : 'CORE'
  const viewLabel = (context.view || 'front').toUpperCase()
  return [productLabel, variantLabel, viewLabel]
}

function hexWithoutPound(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

function buildPlaceholdUrl(hex: string, textHex: string, lines: string[], width: number, height: number): string {
  const text = encodeURIComponent(lines.join('\n'))
  // Force raster output so Next.js image optimizer can process it reliably.
  return `https://placehold.co/${width}x${height}/${hexWithoutPound(hex)}/${hexWithoutPound(textHex)}/png?text=${text}`
}

export function parseImageList(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return parseImageList(JSON.parse(trimmed))
      } catch {
        return []
      }
    }

    return [trimmed]
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim()
        }
        if (typeof entry === 'object' && entry !== null && 'url' in entry) {
          const candidate = (entry as { url?: unknown }).url
          return typeof candidate === 'string' ? candidate.trim() : ''
        }
        return ''
      })
      .filter(Boolean)
  }

  if (typeof value === 'object' && value !== null && 'url' in value) {
    const candidate = (value as { url?: unknown }).url
    return typeof candidate === 'string' && candidate.trim().length > 0 ? [candidate.trim()] : []
  }

  return []
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const body = normalizeHexBody(value)
  if (!body) {
    return null
  }

  return `#${body}`
}

export function fallbackColorHex(colorLabel: string | null | undefined): string | null {
  if (!colorLabel) {
    return null
  }

  const normalized = colorLabel.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  for (const [key, hex] of Object.entries(FALLBACK_COLOR_MAP)) {
    if (normalized.includes(key)) {
      return hex
    }
  }

  return null
}

export function resolveColorHex(colorHex?: string | null, colorLabel?: string | null): string | null {
  return normalizeHexColor(colorHex) ?? fallbackColorHex(colorLabel)
}

export function isLightColor(hexColor: string): boolean {
  const normalized = normalizeHexColor(hexColor)
  if (!normalized) {
    return false
  }

  const [red, green, blue] = hexBodyToRgb(normalized.replace('#', ''))
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.58
}

export function getContrastTextHex(backgroundHex: string): string {
  return isLightColor(backgroundHex) ? DEFAULT_DARK_TEXT_HEX : DEFAULT_LIGHT_TEXT_HEX
}

export function buildProductPlaceholderImages(context: PlaceholderImageContext): string[] {
  const width = context.width ?? DEFAULT_WIDTH
  const height = context.height ?? DEFAULT_HEIGHT
  const baseHex = fallbackNeutralHex(context.productSlug || context.productName || 'head-over-feels')
  const textHex = getContrastTextHex(baseHex)
  const baseContext = {
    ...context,
    color: context.color ?? null,
    size: context.size ?? null,
  }

  return (['front', 'back', 'detail'] as const).map((view) => {
    const shadeAmount = view === 'front' ? 0 : view === 'back' ? 18 : -12
    const viewHex = shadeHex(baseHex, shadeAmount)
    return buildPlaceholdUrl(viewHex, textHex, buildTextLines({ ...baseContext, view }), width, height)
  })
}

export function buildVariantPlaceholderImages(context: PlaceholderImageContext): string[] {
  const width = context.width ?? DEFAULT_WIDTH
  const height = context.height ?? DEFAULT_HEIGHT
  const variantHex = resolveColorHex(context.colorHex, context.color) ?? fallbackNeutralHex(context.productName)
  const textHex = getContrastTextHex(variantHex)

  return (['front', 'back', 'detail'] as const).map((view) => {
    const shadeAmount = view === 'front' ? 0 : view === 'back' ? 14 : -10
    const viewHex = shadeHex(variantHex, shadeAmount)
    return buildPlaceholdUrl(viewHex, textHex, buildTextLines({ ...context, view }), width, height)
  })
}

export function isPlaceholderLikeImageUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (trimmed.startsWith('/placeholder-product')) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    if (!PLACEHOLDER_HOSTS.has(parsed.hostname)) {
      return false
    }

    if (parsed.hostname === 'cdn.headoverfeels.com') {
      return parsed.pathname.startsWith('/products/') || parsed.pathname.includes('/seed/')
    }

    return true
  } catch {
    return trimmed.toLowerCase().includes('placeholder')
  }
}

export function rewritePlaceholderLikeImages(existingImages: string[], replacementImages: string[]): {
  images: string[]
  replacedCount: number
} {
  if (replacementImages.length === 0) {
    return {
      images: existingImages,
      replacedCount: 0,
    }
  }

  if (existingImages.length === 0) {
    return {
      images: replacementImages,
      replacedCount: replacementImages.length,
    }
  }

  let replacedCount = 0
  const rewritten = existingImages.map((image, index) => {
    if (!isPlaceholderLikeImageUrl(image)) {
      return image
    }

    replacedCount += 1
    return replacementImages[Math.min(index, replacementImages.length - 1)]
  })

  return { images: rewritten, replacedCount }
}

export function getPrimaryImageWithFallback(input: {
  images: unknown
  productName: string
  productSlug?: string | null
  color?: string | null
  colorHex?: string | null
  size?: string | null
}): string {
  const parsed = parseImageList(input.images)
  if (parsed.length > 0) {
    return parsed[0]
  }

  const hasVariantContext = Boolean(input.color || input.colorHex || input.size)
  if (hasVariantContext) {
    return buildVariantPlaceholderImages({
      productName: input.productName,
      productSlug: input.productSlug,
      color: input.color,
      colorHex: input.colorHex,
      size: input.size,
      view: 'front',
    })[0]
  }

  return buildProductPlaceholderImages({
    productName: input.productName,
    productSlug: input.productSlug,
    view: 'front',
  })[0]
}
