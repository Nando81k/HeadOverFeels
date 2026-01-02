'use client'

import { useState, useRef, useCallback, useSyncExternalStore, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { CaretLeft, CaretRight, MagnifyingGlassPlus, X } from '@phosphor-icons/react'

// Hook to safely check if we're on the client
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

interface ImageGalleryProps {
  images: Array<{ url: string; alt?: string }>
  productName: string
}

export function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isZooming, setIsZooming] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 })
  const [previewPosition, setPreviewPosition] = useState({ left: 0, top: 0 })
  const [previewSize, setPreviewSize] = useState({ width: 450, height: 450 })
  const [showHint, setShowHint] = useState(true)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()

  const ZOOM_LEVEL = 2.5
  const LENS_SIZE_PERCENT = 100 / ZOOM_LEVEL // Size of lens relative to image

  const validImages = images?.filter(img => img && img.url && img.url.trim() !== '') || []

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1))
  }, [validImages.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1))
  }, [validImages.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'Escape' && isZooming) setIsZooming(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isZooming, goToPrevious, goToNext])

  const calculatePreviewPosition = useCallback((rect: DOMRect) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 20
    const size = Math.min(rect.width, viewportHeight - 40) // Cap at viewport height

    // Check if there's room to the right
    const rightSpace = viewportWidth - rect.right - gap
    const hasRoomRight = rightSpace >= size

    // Calculate horizontal position
    let left: number
    if (hasRoomRight) {
      left = rect.right + gap
    } else {
      // Position to the left of the image
      left = Math.max(gap, rect.left - size - gap)
    }

    // Calculate vertical position - center with image, keep within viewport
    let top = rect.top + (rect.height - size) / 2
    top = Math.max(gap, Math.min(top, viewportHeight - size - gap))

    return { left, top, size }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return
    
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    setZoomPosition({ 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    })

    // Position the preview intelligently
    const { left, top, size } = calculatePreviewPosition(rect)
    setPreviewPosition({ left, top })
    setPreviewSize({ width: size, height: size })
  }, [calculatePreviewPosition])

  const handleMouseEnter = () => {
    if (!imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const { left, top, size } = calculatePreviewPosition(rect)
    setPreviewPosition({ left, top })
    setPreviewSize({ width: size, height: size })
    setIsZooming(true)
    if (showHint) setShowHint(false) // Hide hint on first interaction
  }

  const handleMouseLeave = () => setIsZooming(false)

  if (validImages.length === 0) {
    return (
      <div className="aspect-square bg-neutral-100 border border-neutral-200 flex items-center justify-center rounded-lg">
        <span className="text-neutral-400 text-sm">No image available</span>
      </div>
    )
  }

  // Portal-based zoom preview for rendering above all content
  const zoomPreview = isClient && isZooming && createPortal(
    <div 
      className="fixed bg-white overflow-hidden hidden lg:block rounded-lg animate-in fade-in zoom-in-95 duration-200"
      style={{
        width: previewSize.width,
        height: previewSize.height,
        left: previewPosition.left,
        top: previewPosition.top,
        zIndex: 9999,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Zoomed Image - Full bleed */}
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url(${validImages[currentIndex].url})`,
          backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
          backgroundSize: `${ZOOM_LEVEL * 100}%`,
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Floating Header */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <MagnifyingGlassPlus size={14} weight="bold" />
          <span>{ZOOM_LEVEL}× Zoom</span>
        </div>
        <button 
          onClick={() => setIsZooming(false)}
          className="pointer-events-auto bg-black/80 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black transition-colors"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>,
    document.body
  )

  return (
    <div className="space-y-3">
      {/* Main Image Container */}
      <div className="relative">
        <div 
          ref={imageContainerRef}
          className="relative aspect-square overflow-hidden bg-neutral-50 border border-neutral-200 cursor-crosshair group rounded-lg"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          tabIndex={0}
          role="img"
          aria-label={`${productName} - Press arrow keys to navigate images`}
        >
          {/* Main Image */}
          <Image
            src={validImages[currentIndex].url}
            alt={validImages[currentIndex].alt || `${productName} - Image ${currentIndex + 1}`}
            fill
            className="object-cover transition-transform duration-300"
            priority
          />

          {/* Lens Overlay - Shows zoomed area on main image */}
          {isZooming && (
            <div 
              className="absolute pointer-events-none z-20 hidden lg:block transition-opacity duration-150"
              style={{
                left: `${zoomPosition.x}%`,
                top: `${zoomPosition.y}%`,
                width: `${LENS_SIZE_PERCENT}%`,
                height: `${LENS_SIZE_PERCENT}%`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(0, 0, 0, 0.3)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.15)',
              }}
            />
          )}

          {/* Hover hint - First time user guidance */}
          {!isZooming && showHint && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="bg-black/75 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full flex items-center gap-2">
                <MagnifyingGlassPlus size={18} weight="bold" />
                <span>Hover to zoom</span>
              </div>
            </div>
          )}

          {/* Zoom active indicator */}
          {isZooming && (
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full items-center gap-1.5 z-10 hidden lg:flex">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Zoom active</span>
            </div>
          )}

          {/* Navigation Arrows */}
          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                onMouseEnter={handleMouseLeave}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm hover:bg-white border border-neutral-200 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-105 z-10 shadow-lg"
                aria-label="Previous image"
              >
                <CaretLeft size={20} weight="bold" className="text-neutral-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                onMouseEnter={handleMouseLeave}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm hover:bg-white border border-neutral-200 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-105 z-10 shadow-lg"
                aria-label="Next image"
              >
                <CaretRight size={20} weight="bold" className="text-neutral-700" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {validImages.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full z-10 font-medium">
              {currentIndex + 1} / {validImages.length}
            </div>
          )}
        </div>
      </div>

      {/* Zoom Preview Portal */}
      {zoomPreview}

      {/* Thumbnails */}
      {validImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {validImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative shrink-0 w-16 h-16 overflow-hidden rounded-md border-2 transition-all hover:scale-105 ${
                index === currentIndex
                  ? 'border-black ring-2 ring-black/10'
                  : 'border-transparent hover:border-neutral-300'
              }`}
              aria-label={`View image ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : 'false'}
            >
              <Image
                src={image.url}
                alt={image.alt || `${productName} thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
              {index === currentIndex && (
                <div className="absolute inset-0 bg-black/10" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <p className="text-xs text-neutral-400 text-center hidden lg:block">
        Use ← → arrow keys to navigate • Hover to zoom
      </p>
    </div>
  )
}
