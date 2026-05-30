'use client'

import { motion } from 'framer-motion'
import { X, Envelope } from '@phosphor-icons/react'
import { useState } from 'react'
import Image from 'next/image'

export interface PopupContent {
  heading?: string
  body?: string
  buttonText?: string
  buttonUrl?: string
  image?: string
  backgroundColor?: string
  textColor?: string
  buttonColor?: string
  placeholderText?: string
  successMessage?: string
}

export interface PopupTemplateProps {
  content: PopupContent
  onClose: () => void
  onAction: (data?: { email?: string }) => Promise<{ promoCode?: string; discountDescription?: string; message?: string } | void> | void
  variantId?: string
  previewMode?: boolean
}

// Shared backdrop component
export function PopupBackdrop({ 
  children, 
  onClose,
  previewMode = false
}: { 
  children: React.ReactNode
  onClose: () => void
  previewMode?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${previewMode ? 'absolute' : 'fixed'} inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4`}
      onClick={onClose}
    >
      {children}
    </motion.div>
  )
}

// Email Capture Modal Template
export function EmailCaptureModal({ content, onClose, onAction, previewMode }: PopupTemplateProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [promoResult, setPromoResult] = useState<{ promoCode?: string; discountDescription?: string; message?: string } | null>(null)
  
  const {
    heading = 'Get 10% Off Your First Order',
    body = 'Subscribe to our newsletter and receive exclusive offers, early access to new drops, and more.',
    buttonText = 'Subscribe',
    image,
    backgroundColor = '#000000',
    textColor = '#ffffff',
    buttonColor = '#FF3131',
    placeholderText = 'Enter your email',
    successMessage = 'Thanks for subscribing! Check your email for your discount code.'
  } = content
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email')
      return
    }
    
    setLoading(true)
    try {
      const result = await onAction({ email })
      setPromoResult(result || null)
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <PopupBackdrop onClose={onClose} previewMode={previewMode}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-md w-full overflow-hidden"
        style={{ backgroundColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 transition-colors"
          style={{ color: textColor }}
        >
          <X size={20} weight="bold" />
        </button>
        
        {/* Image */}
        {image && (
          <div className="relative h-48 w-full">
            <Image
              src={image}
              alt={heading}
              fill
              className="object-cover"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: buttonColor }}
              >
                <Envelope size={32} weight="bold" color={textColor} />
              </div>
              
              {promoResult?.promoCode ? (
                <>
                  <p style={{ color: textColor }} className="text-lg font-medium mb-4">
                    🎉 Here&apos;s your exclusive code!
                  </p>
                  <div 
                    className="bg-white/10 border-2 border-dashed border-white/30 rounded-lg p-4 mb-4"
                  >
                    <p className="text-xs uppercase tracking-wide opacity-60 mb-1" style={{ color: textColor }}>
                      Your Code
                    </p>
                    <p className="text-2xl font-bold tracking-widest font-mono" style={{ color: textColor }}>
                      {promoResult.promoCode}
                    </p>
                    {promoResult.discountDescription && (
                      <p className="text-sm mt-2" style={{ color: buttonColor }}>
                        {promoResult.discountDescription}
                      </p>
                    )}
                  </div>
                  <p style={{ color: textColor }} className="text-sm opacity-80">
                    {promoResult.message || 'We\'ve also sent this code to your email!'}
                  </p>
                </>
              ) : (
                <p style={{ color: textColor }} className="text-lg font-medium">
                  {promoResult?.message || successMessage}
                </p>
              )}
            </div>
          ) : (
            <>
              <h2 
                className="text-2xl font-bold mb-3"
                style={{ color: textColor }}
              >
                {heading}
              </h2>
              <p 
                className="text-sm opacity-80 mb-6"
                style={{ color: textColor }}
              >
                {body}
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    placeholder={placeholderText}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    style={{ color: textColor }}
                  />
                  {error && (
                    <p className="text-red-400 text-sm mt-1">{error}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: buttonColor, color: textColor }}
                >
                  {loading ? 'Please wait...' : buttonText}
                </button>
              </form>
              
              <p 
                className="text-xs text-center mt-4 opacity-50"
                style={{ color: textColor }}
              >
                No spam, unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </PopupBackdrop>
  )
}

// Standard Modal Template
export function ModalTemplate({ content, onClose, onAction, previewMode }: PopupTemplateProps) {
  const {
    heading = 'Special Offer',
    body = 'Don\'t miss out on this limited time deal!',
    buttonText = 'Shop Now',
    buttonUrl = '/products',
    image,
    backgroundColor = '#000000',
    textColor = '#ffffff',
    buttonColor = '#FF3131'
  } = content
  
  const handleClick = () => {
    onAction()
    if (buttonUrl) {
      window.location.href = buttonUrl
    }
  }
  
  return (
    <PopupBackdrop onClose={onClose} previewMode={previewMode}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-lg w-full overflow-hidden"
        style={{ backgroundColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 hover:bg-white/10 transition-colors"
          style={{ color: textColor }}
        >
          <X size={20} weight="bold" />
        </button>
        
        {/* Image */}
        {image && (
          <div className="relative h-64 w-full">
            <Image
              src={image}
              alt={heading}
              fill
              className="object-cover"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-8 text-center">
          <h2 
            className="text-3xl font-bold mb-3"
            style={{ color: textColor }}
          >
            {heading}
          </h2>
          <p 
            className="text-base opacity-80 mb-6"
            style={{ color: textColor }}
          >
            {body}
          </p>
          
          <button
            onClick={handleClick}
            className="px-8 py-3 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: buttonColor, color: textColor }}
          >
            {buttonText}
          </button>
        </div>
      </motion.div>
    </PopupBackdrop>
  )
}
