'use client'

import { Navigation } from '@/components/layout/Navigation'
import { Heart, Sparkle, Users, Target } from '@phosphor-icons/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <div className="bg-white text-black border-b border-black/10 py-20 pt-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-6">
            About Head Over Feels
          </h1>
          <p className="text-xl text-black/70">
            Where street culture meets authentic expression
          </p>
        </div>
      </div>

      {/* Our Story */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black mb-6">Our Story</h2>
          <div className="space-y-6 text-lg text-black/70 leading-relaxed">
            <p>
              Head Over Feels was born from a simple belief: streetwear should be more than just fashion. 
              It should be a canvas for self-expression, a statement of authenticity, and a celebration of urban culture.
            </p>
            <p>
              Founded in 2025, we set out to create pieces that resonate with those who dare to be different. 
              Every hoodie, every tee, every accessory we design tells a story—your story.
            </p>
            <p>
              We blend premium quality with contemporary design, ensuring that when you wear Head Over Feels, 
              you&apos;re not just wearing clothes—you&apos;re wearing confidence, creativity, and culture.
            </p>
          </div>
        </div>

        {/* Values Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          <div className="bg-white border border-black/10 p-8 rounded-none">
            <div className="w-12 h-12 bg-black rounded-none flex items-center justify-center mb-4">
              <Heart size={24} weight="bold" className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Authenticity</h3>
            <p className="text-black/70">
              We believe in staying true to yourself. Our designs celebrate individuality and encourage 
              you to express your unique personality without compromise.
            </p>
          </div>

          <div className="bg-white border border-black/10 p-8 rounded-none">
            <div className="w-12 h-12 bg-black rounded-none flex items-center justify-center mb-4">
              <Sparkle size={24} weight="fill" className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Quality First</h3>
            <p className="text-black/70">
              Premium materials, meticulous craftsmanship, and attention to detail in every stitch. 
              We create pieces built to last, not just for a season.
            </p>
          </div>

          <div className="bg-white border border-black/10 p-8 rounded-none">
            <div className="w-12 h-12 bg-black rounded-none flex items-center justify-center mb-4">
              <Users size={24} weight="bold" className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Community Driven</h3>
            <p className="text-black/70">
              Our community is at the heart of everything we do. We listen, we collaborate, 
              and we grow together with the people who wear our brand.
            </p>
          </div>

          <div className="bg-white border border-black/10 p-8 rounded-none">
            <div className="w-12 h-12 bg-black rounded-none flex items-center justify-center mb-4">
              <Target size={24} weight="bold" className="text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3">Sustainable Vision</h3>
            <p className="text-black/70">
              We&apos;re committed to making responsible choices—from ethical manufacturing to 
              sustainable materials—because style shouldn&apos;t cost the earth.
            </p>
          </div>
        </div>

        {/* Mission Statement */}
        <div className="bg-black text-white p-12 rounded-none text-center">
          <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
          <p className="text-xl text-black/70 max-w-3xl mx-auto">
            To empower individuals through authentic streetwear that breaks boundaries, 
            challenges norms, and celebrates the raw, unfiltered beauty of urban expression.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white border-t border-black/10 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black mb-4">Ready to Join the Movement?</h2>
          <p className="text-black/70 mb-8 text-lg">
            Explore our collections and find pieces that speak to your soul
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/products">
              <Button size="lg" className="w-full sm:w-auto">
                Shop Collection
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Get in Touch
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
