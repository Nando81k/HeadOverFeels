import type { ComponentType } from 'react'
import { Fire, GridFour, Hoodie, Sparkle, TShirt, Watch } from '@phosphor-icons/react'
import type { IconWeight } from '@phosphor-icons/react'

type NavIconComponent = ComponentType<{
  size?: number
  className?: string
  weight?: IconWeight
}>

export interface NavCategoryLink {
  href: string
  label: string
  description: string
  icon: NavIconComponent
}

export interface NavCategoryApiRecord {
  id: string
  name: string
  slug: string
}

export interface NavResolvedCategory extends NavCategoryLink {
  id: string
  slug: string
}

export interface NavFeaturedLink {
  href: string
  eyebrow: string
  label: string
  description: string
  icon: NavIconComponent
}

const NAV_CATEGORY_PRESENTATION: Record<string, { description: string; icon: NavIconComponent }> = {
  hoodies: {
    description: 'Cozy essentials',
    icon: Hoodie,
  },
  tshirts: {
    description: 'Everyday basics',
    icon: TShirt,
  },
  tees: {
    description: 'Everyday basics',
    icon: TShirt,
  },
  accessories: {
    description: 'Complete your look',
    icon: Watch,
  },
  bottoms: {
    description: 'Comfort-driven fits',
    icon: TShirt,
  },
  outerwear: {
    description: 'Layer-ready staples',
    icon: Hoodie,
  },
  sets: {
    description: 'Matching edits',
    icon: GridFour,
  },
}

function toDisplayLabel(name: string, slug: string): string {
  if (name.trim().length > 0) {
    return name.trim()
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeCategorySlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function resolveNavCategoryPresentation(slug: string): { description: string; icon: NavIconComponent } {
  const normalizedSlug = normalizeCategorySlug(slug)
  return NAV_CATEGORY_PRESENTATION[normalizedSlug] ?? {
    description: 'Shop category picks',
    icon: Sparkle,
  }
}

export function resolveNavCategoryLink(category: NavCategoryApiRecord): NavResolvedCategory {
  const cleanSlug = category.slug.trim()
  const href = `/products?category=${encodeURIComponent(cleanSlug)}`
  const { description, icon } = resolveNavCategoryPresentation(cleanSlug)

  return {
    id: category.id,
    slug: cleanSlug,
    href,
    label: toDisplayLabel(category.name, cleanSlug),
    description,
    icon,
  }
}

export const NAV_CATEGORY_LINKS: NavResolvedCategory[] = [
  {
    id: 'fallback-hoodies',
    slug: 'hoodies',
    href: '/products?category=hoodies',
    label: 'Hoodies',
    description: 'Cozy essentials',
    icon: Hoodie,
  },
  {
    id: 'fallback-tshirts',
    slug: 'tshirts',
    href: '/products?category=tshirts',
    label: 'T-Shirts',
    description: 'Everyday basics',
    icon: TShirt,
  },
  {
    id: 'fallback-accessories',
    slug: 'accessories',
    href: '/products?category=accessories',
    label: 'Accessories',
    description: 'Complete your look',
    icon: Watch,
  },
]

export interface NavFeaturedDrop {
  href: string
  imageSrc: string
  imageAlt: string
  eyebrow: string
  title: string
  subtitle: string
  ctaLabel: string
}

// Lifestyle hero shown on the left side of the desktop Shop mega-menu.
// Editorial control lives here so copy/imagery can be swapped without
// touching navigation JSX. `imageSrc` may be replaced at runtime in
// Navigation.tsx with the first available product image as a fallback
// when the configured asset is missing.
export const NAV_FEATURED_DROP: NavFeaturedDrop = {
  href: '/drops',
  imageSrc: '/images/nav/shop-hero.jpg',
  imageAlt: 'Latest drop lookbook',
  eyebrow: 'Featured Drop',
  title: 'The Latest Capsule',
  subtitle: 'Limited pieces, made to last.',
  ctaLabel: 'Shop the drop',
}

export const NAV_FEATURED_LINKS: NavFeaturedLink[] = [
  {
    href: '/products',
    eyebrow: 'Browse',
    label: 'All Products',
    description: 'Explore the full catalog in one place.',
    icon: GridFour,
  },
  {
    href: '/collections',
    eyebrow: 'Curated',
    label: 'Collections',
    description: 'Shop thoughtfully grouped looks.',
    icon: Sparkle,
  },
  {
    href: '/drops',
    eyebrow: 'Latest',
    label: 'New Drops',
    description: 'See the newest arrivals first.',
    icon: Fire,
  },
]
