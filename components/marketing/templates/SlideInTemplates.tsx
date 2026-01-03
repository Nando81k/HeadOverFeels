'use client'

import { motion } from 'framer-motion'
import { X, ShoppingBag } from '@phosphor-icons/react'
import { PopupTemplateProps } from './ModalTemplates'
import Image from 'next/image'

type SlidePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

// Slide-in Notification Template
export function SlideInTemplate({ 
  content, 
  onClose, 
  onAction,
  position = 'bottom-right',
  previewMode = false
}: PopupTemplateProps & { position?: SlidePosition }) {
  const {
    heading = 'New Drop Alert!',
    body = 'Check out our latest limited edition release.',
    buttonText = 'View Now',
    buttonUrl = '/products',
    image,
    backgroundColor = '#18181B',
    textColor = '#ffffff',
    buttonColor = '#FF3131'
  } = content
  
  const handleClick = () => {
    onAction()
    if (buttonUrl) {
      window.location.href = buttonUrl
    }
  }
  
  // Position classes
  const positionClasses: Record<SlidePosition, string> = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }
  
  // Animation variants based on position
  const getInitial = () => {
    if (position.includes('right')) return { x: 100, opacity: 0 }
    return { x: -100, opacity: 0 }
  }
  
  return (
    <motion.div
      initial={getInitial()}
      animate={{ x: 0, opacity: 1 }}
      exit={getInitial()}
      className={`${previewMode ? 'absolute' : 'fixed'} z-[100] w-80 shadow-2xl ${positionClasses[position]}`}
      style={{ backgroundColor }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1.5 hover:bg-white/10 transition-colors z-10"
        style={{ color: textColor }}
      >
        <X size={16} weight="bold" />
      </button>
      
      <div className="flex gap-3 p-4">
        {/* Image or Icon */}
        {image ? (
          <div className="relative w-16 h-16 shrink-0">
            <Image
              src={image}
              alt=""
              fill
              className="object-cover rounded"
            />
          </div>
        ) : (
          <div 
            className="w-16 h-16 shrink-0 flex items-center justify-center rounded"
            style={{ backgroundColor: buttonColor }}
          >
            <ShoppingBag size={24} weight="bold" color={textColor} />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <h4 
            className="font-semibold text-sm truncate"
            style={{ color: textColor }}
          >
            {heading}
          </h4>
          <p 
            className="text-xs opacity-70 mt-0.5 line-clamp-2"
            style={{ color: textColor }}
          >
            {body}
          </p>
          
          {buttonText && (
            <button
              onClick={handleClick}
              className="mt-2 px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: buttonColor, color: textColor }}
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Exit Intent Modal - Special styling for "before you go" messages
export function ExitIntentModal({ content, onClose, onAction, previewMode }: PopupTemplateProps) {
  const {
    heading = 'Wait! Before You Go...',
    body = 'Get 15% off your first order when you sign up for our newsletter.',
    buttonText = 'Get My Discount',
    buttonUrl,
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${previewMode ? 'absolute' : 'fixed'} inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
        
        {/* Decorative top border */}
        <div className="h-1" style={{ backgroundColor: buttonColor }} />
        
        {/* Image */}
        {image && (
          <div className="relative h-48 w-full">
            <Image
              src={image}
              alt=""
              fill
              className="object-cover"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-8 text-center">
          <h2 
            className="text-2xl font-bold mb-3"
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
            className="w-full py-3 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: buttonColor, color: textColor }}
          >
            {buttonText}
          </button>
          
          <button
            onClick={onClose}
            className="mt-3 text-sm opacity-50 hover:opacity-70 transition-opacity"
            style={{ color: textColor }}
          >
            No thanks, I&apos;ll pay full price
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Full Screen Takeover Template
export function FullScreenTemplate({ content, onClose, onAction, previewMode }: PopupTemplateProps) {
  const {
    heading = 'EXCLUSIVE DROP',
    body = 'Limited edition collection available now. First come, first served.',
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${previewMode ? 'absolute' : 'fixed'} inset-0 z-[100] flex items-center justify-center`}
      style={{ backgroundColor }}
    >
      {/* Background image */}
      {image && (
        <div className="absolute inset-0">
          <Image
            src={image}
            alt=""
            fill
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
      )}
      
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 p-3 hover:bg-white/10 transition-colors border border-white/20"
        style={{ color: textColor }}
      >
        <X size={24} weight="bold" />
      </button>
      
      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-2xl">
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tight mb-4"
          style={{ color: textColor }}
        >
          {heading}
        </motion.h1>
        
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl opacity-80 mb-8 max-w-md mx-auto"
          style={{ color: textColor }}
        >
          {body}
        </motion.p>
        
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleClick}
          className="px-12 py-4 text-lg font-bold transition-all hover:scale-105"
          style={{ backgroundColor: buttonColor, color: textColor }}
        >
          {buttonText}
        </motion.button>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-sm opacity-50 cursor-pointer hover:opacity-70"
          style={{ color: textColor }}
          onClick={onClose}
        >
          Press ESC or click to close
        </motion.p>
      </div>
    </motion.div>
  )
}
