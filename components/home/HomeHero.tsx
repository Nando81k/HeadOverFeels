'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const HERO_BACKGROUND_IMAGES = [
  '/assets/Sweatshirt_hoodie_collection.png',
  '/assets/Tee_tops_collection.png',
  '/assets/Accessories.png',
  '/assets/stitching_img.png',
] as const

const SLIDE_INTERVAL_MS = 4500

export function HomeHero() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    const timerId = window.setInterval(() => {
      setActiveSlide((currentIndex) => (currentIndex + 1) % HERO_BACKGROUND_IMAGES.length)
    }, SLIDE_INTERVAL_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [prefersReducedMotion])

  return (
    <section
      id="home-hero"
      data-testid="home-hero"
      aria-labelledby="home-hero-title"
      className="relative overflow-hidden border-b border-black/10 bg-black"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {HERO_BACKGROUND_IMAGES.map((imageSrc, index) => (
          <Image
            key={imageSrc}
            src={imageSrc}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className={`object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}

        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.62)_45%,rgba(0,0,0,0.45)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:px-8 lg:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Head Over Feels</p>
        <h1
          id="home-hero-title"
          className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          Premium essentials built for everyday expression.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          Discover elevated hoodies, tees, and accessories in a clean monochrome edit.
          Fast checkout, thoughtful fit, and pieces designed to be worn on repeat.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/90 motion-reduce:transition-none"
          >
            Shop All
          </Link>
          <Link
            href="/products?sortBy=newest"
            className="inline-flex items-center justify-center rounded-full border border-white/55 bg-transparent px-7 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-200 hover:border-white hover:bg-white hover:text-black motion-reduce:transition-none"
          >
            New Arrivals
          </Link>
        </div>

        {!prefersReducedMotion && (
          <div className="mt-8 flex items-center gap-1.5" aria-hidden="true">
            {HERO_BACKGROUND_IMAGES.map((imageSrc, index) => (
              <span
                key={`${imageSrc}-indicator`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === activeSlide ? 'w-8 bg-white' : 'w-3 bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
