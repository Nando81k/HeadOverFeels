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

export interface NavFeaturedLink {
  href: string
  eyebrow: string
  label: string
  description: string
  icon: NavIconComponent
}

export const NAV_CATEGORY_LINKS: NavCategoryLink[] = [
  {
    href: '/products?category=hoodies',
    label: 'Hoodies',
    description: 'Cozy essentials',
    icon: Hoodie,
  },
  {
    href: '/products?category=tshirts',
    label: 'T-Shirts',
    description: 'Everyday basics',
    icon: TShirt,
  },
  {
    href: '/products?category=accessories',
    label: 'Accessories',
    description: 'Complete your look',
    icon: Watch,
  },
]

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
