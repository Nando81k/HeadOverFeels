'use client'

import { motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { PopupContent, PopupTemplateProps } from './ModalTemplates'

// Top/Bottom Banner Template
export function BannerTemplate({ 
  content, 
  onClose, 
  onAction,
  position = 'top',
  previewMode = false
}: PopupTemplateProps & { position?: 'top' | 'bottom' }) {
  const {
    heading = '🎉 Free Shipping on Orders Over $100!',
    buttonText = 'Shop Now',
    buttonUrl = '/products',
    backgroundColor = '#FF3131',
    textColor = '#ffffff',
    buttonColor = '#000000'
  } = content
  
  const handleClick = () => {
    onAction()
    if (buttonUrl) {
      window.location.href = buttonUrl
    }
  }
  
  const isTop = position === 'top'
  
  return (
    <motion.div
      initial={{ y: isTop ? -100 : 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: isTop ? -100 : 100, opacity: 0 }}
      className={`${previewMode ? 'absolute' : 'fixed'} left-0 right-0 z-[100] ${isTop ? 'top-0' : 'bottom-0'}`}
      style={{ backgroundColor }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <p 
          className="text-sm font-medium flex-1 text-center"
          style={{ color: textColor }}
        >
          {heading}
        </p>
        
        <div className="flex items-center gap-3">
          {buttonText && (
            <button
              onClick={handleClick}
              className="px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: buttonColor, color: textColor }}
            >
              {buttonText}
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 transition-colors"
            style={{ color: textColor }}
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Announcement Banner (larger, with optional image)
export function AnnouncementBanner({ 
  content, 
  onClose, 
  onAction,
  position = 'top',
  previewMode = false
}: PopupTemplateProps & { position?: 'top' | 'bottom' }) {
  const {
    heading = 'Flash Sale: 24 Hours Only',
    body = 'Get 30% off everything with code FLASH30',
    buttonText = 'Shop the Sale',
    buttonUrl = '/products',
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
  
  const isTop = position === 'top'
  
  return (
    <motion.div
      initial={{ y: isTop ? -100 : 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: isTop ? -100 : 100, opacity: 0 }}
      className={`${previewMode ? 'absolute' : 'fixed'} left-0 right-0 z-[100] border-b border-white/10 ${isTop ? 'top-0' : 'bottom-0'}`}
      style={{ backgroundColor }}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-6">
        <div className="flex-1">
          <h3 
            className="text-lg font-bold"
            style={{ color: textColor }}
          >
            {heading}
          </h3>
          {body && (
            <p 
              className="text-sm opacity-80"
              style={{ color: textColor }}
            >
              {body}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {buttonText && (
            <button
              onClick={handleClick}
              className="px-6 py-2 text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ backgroundColor: buttonColor, color: textColor }}
            >
              {buttonText}
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors"
            style={{ color: textColor }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Export content type for use elsewhere
export type { PopupContent }
