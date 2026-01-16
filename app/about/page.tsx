'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Navigation } from '@/components/layout/Navigation'
import { Heart, Sparkle, Users, Target, ArrowRight, ArrowDown, Lightning, Leaf, ShieldCheck } from '@phosphor-icons/react'
import Link from 'next/link'

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start']
  })

  const textY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Navigation />

      {/* Hero Section - Matching NeonHero Style */}
      <section 
        ref={containerRef}
        className="relative min-h-[90svh] flex flex-col justify-center overflow-hidden bg-black -mt-24 pt-24"
      >
        {/* Grain overlay for texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        
        {/* Animated corner accents */}
        <motion.div 
          className="absolute top-28 left-8 w-24 h-24 border-l border-t border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        />
        <motion.div 
          className="absolute top-28 right-8 w-24 h-24 border-r border-t border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        />
        <motion.div 
          className="absolute bottom-8 left-8 w-24 h-24 border-l border-b border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
        />
        <motion.div 
          className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-white/10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        />

        {/* Main Content */}
        <motion.div 
          style={{ y: textY, opacity }}
          className="relative z-10 flex-1 flex items-center justify-center px-6"
        >
          <div className="max-w-7xl mx-auto w-full">
            {/* Minimal top label */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-8"
            >
              <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase">
                Our Story
              </span>
            </motion.div>

            {/* Giant Typography */}
            <div className="relative mb-12">
              <motion.h1
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(2.5rem,12vw,9rem)] font-black leading-[0.85] tracking-tighter text-white"
              >
                WHERE
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(2.5rem,12vw,9rem)] font-black leading-[0.85] tracking-tighter text-white"
              >
                CULTURE
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(2.5rem,12vw,9rem)] font-black leading-[0.85] tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/60"
              >
                MEETS SOUL
              </motion.h1>

              {/* Floating descriptor */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block max-w-xs"
              >
                <p className="text-sm text-white/50 leading-relaxed font-light">
                  Streetwear should be more than fashion. It should be a canvas for self-expression.
                </p>
              </motion.div>
            </div>

            {/* Mobile description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="lg:hidden text-sm text-white/50 leading-relaxed font-light max-w-sm mb-12"
            >
              Streetwear should be more than fashion. It should be a canvas for self-expression.
            </motion.p>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="relative z-10 px-6 pb-12"
        >
          <div className="max-w-7xl mx-auto flex justify-center">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] uppercase tracking-widest text-white/40">Discover More</span>
              <ArrowDown className="w-4 h-4 text-white/40" weight="bold" />
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
      </section>

      {/* Our Story Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-6">
              The Beginning
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-black mb-8">
              Born from Passion
            </h2>
            <div className="max-w-3xl mx-auto space-y-6 text-lg text-black/60 leading-relaxed">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Head Over Feels was born from a simple belief: streetwear should be more than just fashion. 
                It should be a canvas for self-expression, a statement of authenticity, and a celebration of urban culture.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Founded in 2025, we set out to create pieces that resonate with those who dare to be different. 
                Every hoodie, every tee, every accessory we design tells a story—your story.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                We blend premium quality with contemporary design, ensuring that when you wear Head Over Feels, 
                you&apos;re not just wearing clothes—you&apos;re wearing confidence, creativity, and culture.
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section - Card Grid */}
      <section className="py-24 px-6 bg-black relative overflow-hidden">
        {/* Grain texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase block mb-6">
              What We Stand For
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              Our Values
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Heart,
                title: 'Authenticity',
                description: 'We believe in staying true to yourself. Our designs celebrate individuality.',
                delay: 0.1
              },
              {
                icon: Sparkle,
                title: 'Quality First',
                description: 'Premium materials and meticulous craftsmanship in every piece.',
                delay: 0.2
              },
              {
                icon: Users,
                title: 'Community',
                description: 'Our community is at the heart of everything we do.',
                delay: 0.3
              },
              {
                icon: Leaf,
                title: 'Sustainability',
                description: 'Responsible choices and ethical manufacturing practices.',
                delay: 0.4
              }
            ].map((value) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: value.delay }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 p-8 hover:bg-white/10 transition-all duration-500"
              >
                <div className="w-14 h-14 bg-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <value.icon size={28} weight="bold" className="text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{value.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 px-6 bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '2025', label: 'Founded' },
              { value: '10K+', label: 'Community Members' },
              { value: '100%', label: 'Ethically Made' },
              { value: '4.9', label: 'Customer Rating' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-5xl md:text-6xl font-black text-black mb-2">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-black/40">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-32 px-6 bg-black relative overflow-hidden">
        {/* Grain texture */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Corner accents */}
        <div className="absolute top-8 left-8 w-24 h-24 border-l border-t border-white/10" />
        <div className="absolute bottom-8 right-8 w-24 h-24 border-r border-b border-white/10" />

        <div className="max-w-4xl mx-auto relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase block mb-8">
              Our Mission
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-8">
              To empower individuals through authentic streetwear that breaks boundaries, 
              challenges norms, and celebrates the raw, unfiltered beauty of urban expression.
            </h2>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center justify-center gap-3"
            >
              <Lightning size={20} weight="fill" className="text-white/40" />
              <span className="text-white/40 text-sm uppercase tracking-widest">Powered by Passion</span>
              <Lightning size={20} weight="fill" className="text-white/40" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 px-6 bg-[#FAF8F5]">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-6">
              The Difference
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-black">
              Why Head Over Feels?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: ShieldCheck,
                title: 'Premium Quality',
                description: 'Every piece is crafted with attention to detail using premium materials that last.',
              },
              {
                icon: Target,
                title: 'Limited Drops',
                description: 'Exclusive releases ensure you stand out with unique pieces not everyone has.',
              },
              {
                icon: Heart,
                title: 'Community First',
                description: 'Join a community of like-minded individuals who value authenticity.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white border border-black/5 p-8 hover:border-black/20 transition-all duration-300 hover:shadow-xl"
              >
                <div className="w-14 h-14 bg-black flex items-center justify-center mb-6">
                  <feature.icon size={28} weight="bold" className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-black mb-3">{feature.title}</h3>
                <p className="text-black/60 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-[#FAF8F5] border-t border-black/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-[10px] font-medium tracking-[0.3em] text-black/40 uppercase block mb-6">
              Join the Movement
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-black mb-6">
              Ready to Express Yourself?
            </h2>
            <p className="text-lg text-black/60 mb-10 max-w-2xl mx-auto">
              Explore our collections and find pieces that speak to your soul. 
              Join thousands who wear their feelings on their sleeve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex items-center gap-4 px-8 py-4 bg-black text-white font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-black/80"
                >
                  <span>Shop Collection</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" weight="bold" />
                </motion.button>
              </Link>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 border border-black text-black font-semibold text-sm uppercase tracking-wider transition-all duration-300 hover:bg-black hover:text-white"
                >
                  Get in Touch
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
