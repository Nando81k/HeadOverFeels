/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReactNode } from 'react'
import { HomePageSections } from '@/components/home/HomePageSections'
import type { HomePageData, HomeProductCard } from '@/components/home/types'
import type { ActiveDrop } from '@/lib/drops'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('@/components/marketing/NewsletterSignup', () => ({
  NewsletterSignup: () => <div data-testid="newsletter-signup">Newsletter Signup</div>,
}))

vi.mock('@/components/drops/DropHeroSection', () => ({
  default: ({ product }: { product: ActiveDrop }) => (
    <div data-testid="drop-hero">Drop spotlight: {product.name}</div>
  ),
}))

function product(id: string, name: string, slug: string): HomeProductCard {
  return {
    id,
    name,
    slug,
    price: 88,
    compareAtPrice: 110,
    imageUrl: '/product.jpg',
    categoryName: 'Hoodies',
    isSoldOut: false,
    colorCues: [{ label: 'Navy', hex: '#1e2b4f', previewImageUrl: '/product-navy.jpg' }],
  }
}

const baseData: HomePageData = {
  bestSellers: [product('best-1', 'Calm Hoodie', 'calm-hoodie')],
  newArrivals: [product('new-1', 'Fresh Tee', 'fresh-tee')],
  trending: [product('trend-1', 'Focus Crewneck', 'focus-crewneck')],
  categories: [
    {
      id: 'cat-1',
      name: 'Hoodies',
      slug: 'hoodies',
      href: '/products?category=hoodies',
      imageUrl: '/cat-hoodies.jpg',
      productCount: 4,
    },
  ],
  reviewSummary: {
    averageRating: 4.7,
    totalReviews: 18,
  },
  reviewHighlights: [
    {
      id: 'review-1',
      productName: 'Calm Hoodie',
      productSlug: 'calm-hoodie',
      customerName: 'Jordan',
      rating: 5,
      snippet: 'The fabric quality is incredible.',
    },
  ],
}

const activeDrop: ActiveDrop = {
  id: 'drop-1',
  name: 'Limited Calm Drop',
  slug: 'limited-calm-drop',
  description: 'Limited run',
  price: 120,
  compareAtPrice: 150,
  images: ['/drop.jpg'],
  releaseDate: new Date('2026-03-25T00:00:00.000Z'),
  dropEndDate: new Date('2026-03-28T00:00:00.000Z'),
  maxQuantity: 2,
  variants: [{ inventory: 5 }],
}

function expectBefore(first: HTMLElement, second: HTMLElement) {
  const relation = first.compareDocumentPosition(second)
  expect((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
}

describe('HomePageSections', () => {
  it('renders homepage sections in the intended order with drop spotlight', () => {
    render(<HomePageSections data={baseData} activeDrop={activeDrop} />)

    const hero = screen.getByTestId('home-hero')
    const trust = screen.getByTestId('home-trust-bar')
    const bestSellers = screen.getByTestId('home-best-sellers')
    const categories = screen.getByTestId('home-categories')
    const arrivals = screen.getByTestId('home-new-arrivals')
    const trending = screen.getByTestId('home-trending')
    const drop = screen.getByTestId('home-drop')
    const social = screen.getByTestId('home-social-proof')
    const newsletter = screen.getByTestId('home-newsletter')
    const footer = screen.getByTestId('home-footer')

    expectBefore(hero, trust)
    expectBefore(trust, bestSellers)
    expectBefore(bestSellers, categories)
    expectBefore(categories, arrivals)
    expectBefore(arrivals, trending)
    expectBefore(trending, drop)
    expectBefore(drop, social)
    expectBefore(social, newsletter)
    expectBefore(newsletter, footer)
  })

  it('renders core CTA and discovery links with expected routes', () => {
    render(<HomePageSections data={baseData} activeDrop={activeDrop} />)

    expect(screen.getByRole('link', { name: 'Shop All' }).getAttribute('href')).toBe('/products')
    expect(screen.getByRole('link', { name: 'New Arrivals' }).getAttribute('href')).toBe('/products?sortBy=newest')
    const categoriesSection = screen.getByTestId('home-categories')
    expect(within(categoriesSection).getByRole('link', { name: /Hoodies/i }).getAttribute('href')).toBe('/products?category=hoodies')

    const bestSellerSection = screen.getByTestId('home-best-sellers')
    expect(within(bestSellerSection).getByRole('link', { name: /Calm Hoodie/i }).getAttribute('href')).toBe('/products/calm-hoodie')
  })

  it('only renders drop spotlight when an active or upcoming drop exists', () => {
    const { rerender } = render(<HomePageSections data={baseData} activeDrop={activeDrop} />)
    expect(screen.getByTestId('home-drop')).toBeTruthy()

    rerender(<HomePageSections data={baseData} activeDrop={null} />)
    expect(screen.queryByTestId('home-drop')).toBeNull()
  })

  it('exposes semantic landmarks and labelled product rails', () => {
    render(<HomePageSections data={baseData} activeDrop={activeDrop} />)

    expect(screen.getByRole('main', { name: 'Homepage' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: /Premium essentials built for everyday expression/i })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Most loved right now products' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Fresh drops, same signature comfort products' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Popular picks across everyone products' })).toBeTruthy()
  })

  it('renders trending product cards from provided data', () => {
    render(<HomePageSections data={baseData} activeDrop={null} />)

    const trendingSection = screen.getByTestId('home-trending')
    expect(within(trendingSection).getByText('Focus Crewneck')).toBeTruthy()
    expect(within(trendingSection).getByText('$88.00')).toBeTruthy()
  })

  it('previews color-specific image on swatch interaction', () => {
    render(<HomePageSections data={baseData} activeDrop={null} />)

    const bestSellerSection = screen.getByTestId('home-best-sellers')
    const productImage = within(bestSellerSection).getByAltText('Calm Hoodie')
    const swatchButton = within(bestSellerSection).getByRole('button', { name: 'Preview Navy' })

    expect(productImage.getAttribute('src')).toContain('/product.jpg')

    fireEvent.mouseEnter(swatchButton)
    expect(productImage.getAttribute('src')).toContain('/product-navy.jpg')

    fireEvent.mouseLeave(swatchButton)
    expect(productImage.getAttribute('src')).toContain('/product.jpg')
  })
})
