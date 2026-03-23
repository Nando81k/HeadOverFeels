'use client'

import { useState } from 'react'
import { EnvelopeSimple, Check, CircleNotch, Warning } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface NewsletterSignupProps {
  source?: string
  sourceDetails?: string
  variant?: 'default' | 'minimal' | 'inline'
  className?: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export function NewsletterSignup({ 
  source = 'footer', 
  sourceDetails,
  variant = 'default',
  className = ''
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || status === 'loading') return
    
    setStatus('loading')
    
    try {
      // Get UTM params from URL if available
      const urlParams = new URLSearchParams(window.location.search)
      
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source,
          sourceDetails,
          utmSource: urlParams.get('utm_source'),
          utmMedium: urlParams.get('utm_medium'),
          utmCampaign: urlParams.get('utm_campaign'),
          honeypot,
        }),
      })

      const data = await res.json()
      
      if (res.ok) {
        setStatus('success')
        setMessage(data.message || 'Thanks for subscribing!')
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Failed to subscribe')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  // Reset after showing success/error
  const handleReset = () => {
    setStatus('idle')
    setMessage('')
  }

  if (variant === 'minimal') {
    return (
      <form onSubmit={handleSubmit} className={`relative ${className}`}>
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] opacity-0"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          disabled={status === 'loading' || status === 'success'}
          className="w-full px-4 py-3 pr-12 bg-white border border-black/10 text-sm focus:outline-none focus:border-black disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!email || status === 'loading' || status === 'success'}
          className="absolute right-0 top-0 h-full px-4 bg-black text-white hover:bg-black/80 disabled:opacity-50 transition-colors"
        >
          {status === 'loading' && <CircleNotch size={18} className="animate-spin" />}
          {status === 'success' && <Check size={18} weight="bold" />}
          {(status === 'idle' || status === 'error') && <EnvelopeSimple size={18} weight="bold" />}
        </button>
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute -bottom-6 left-0 text-xs ${
                status === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={className}>
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-green-600"
            >
              <Check size={18} weight="bold" />
              <span className="text-sm font-medium">{message}</span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="flex gap-2"
            >
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] opacity-0"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                disabled={status === 'loading'}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-black/10 focus:outline-none focus:border-black"
              />
              <button
                type="submit"
                disabled={!email || status === 'loading'}
                className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-black/80 disabled:opacity-50 flex items-center gap-2"
              >
                {status === 'loading' ? (
                  <CircleNotch size={16} className="animate-spin" />
                ) : (
                  'Subscribe'
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
        {status === 'error' && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <Warning size={12} weight="bold" />
            {message}
          </p>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div className={`bg-black/5 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <EnvelopeSimple size={20} weight="bold" className="text-black" />
        <h3 className="font-bold text-black">Stay in the loop</h3>
      </div>
      <p className="text-sm text-black/60 mb-4">
        Get early access to drops, exclusive offers, and self-care tips.
      </p>
      
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-green-50 border border-green-200 p-4 text-center"
          >
            <Check size={24} weight="bold" className="text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-800">{message}</p>
            <button
              onClick={handleReset}
              className="mt-2 text-xs text-green-600 hover:underline"
            >
              Subscribe another email
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] opacity-0"
            />
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                disabled={status === 'loading'}
                className="w-full px-4 py-3 bg-white border border-black/10 text-sm focus:outline-none focus:border-black disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!email || status === 'loading'}
              className="w-full py-3 bg-black text-white font-bold hover:bg-black/80 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {status === 'loading' ? (
                <>
                  <CircleNotch size={18} className="animate-spin" />
                  Subscribing...
                </>
              ) : (
                'Subscribe'
              )}
            </button>
            {status === 'error' && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-600 flex items-center gap-1"
              >
                <Warning size={12} weight="bold" />
                {message}
              </motion.p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
      
      <p className="mt-3 text-[10px] text-black/40">
        By subscribing, you agree to receive marketing emails. Unsubscribe anytime.
      </p>
    </div>
  )
}
