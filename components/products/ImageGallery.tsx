'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

interface ImageGalleryProps {
  images: Array<{ url: string; alt?: string }>
  productName: string
}

export function ImageGallery({ images, productName }: ImageGalleryProps) {
  // Create a stable key from images to detect changes and reset state
  const imagesKey = JSON.stringify(images?.map(img => img?.url) || [])
  
  return <ImageGalleryInner key={imagesKey} images={images} productName={productName} />
}

function ImageGalleryInner({ images, productName }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToPrevious, goToNext])

  if (validImages.length === 0) {
    return (
      <div className="aspect-square bg-neutral-100 border border-neutral-200 flex items-center justify-center rounded-lg">
        <span className="text-neutral-400 text-sm">No image available</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Main Image Container */}
      <div className="relative">
        <div 
          className="relative aspect-square overflow-hidden bg-neutral-50 border border-neutral-200 group rounded-lg"
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

          {/* Navigation Arrows */}
          {validImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm hover:bg-white border border-neutral-200 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-105 z-10 shadow-lg"
                aria-label="Previous image"
              >
                <CaretLeft size={20} weight="bold" className="text-neutral-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
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
      {validImages.length > 1 && (
        <p className="text-xs text-neutral-400 text-center hidden lg:block">
          Use ← → arrow keys to navigate
        </p>
      )}
    </div>
  )
}
