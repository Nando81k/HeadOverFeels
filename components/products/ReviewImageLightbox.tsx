'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface ReviewImageLightboxProps {
  isOpen: boolean
  images: string[]
  startIndex?: number
  onClose: () => void
}

/**
 * Fullscreen image viewer for review photos.
 *
 * Triggered by clicking any review image. Supports keyboard nav (←/→/Esc),
 * arrow buttons, a thumbnail strip for quick jump, and a small counter so
 * the operator/customer always knows where they are in the set. The host
 * passes the image array + a starting index; closing returns control via
 * onClose. Pure UI — no API dependency, no server roundtrip.
 */
export function ReviewImageLightbox({
  isOpen,
  images,
  startIndex = 0,
  onClose,
}: ReviewImageLightboxProps) {
  const [index, setIndex] = useState(startIndex)
  const [lastStartIndex, setLastStartIndex] = useState(startIndex)

  // React-docs pattern for "adjust state on prop change" — derive during
  // render instead of an effect. When the parent opens the lightbox at a
  // new image (different startIndex), reset the active index without going
  // through a render→effect→render cycle.
  if (startIndex !== lastStartIndex) {
    setLastStartIndex(startIndex)
    setIndex(startIndex)
  }

  const goPrev = useCallback(() => {
    setIndex((current) => (current === 0 ? images.length - 1 : current - 1))
  }, [images.length])

  const goNext = useCallback(() => {
    setIndex((current) => (current === images.length - 1 ? 0 : current + 1))
  }, [images.length])

  // Keyboard nav + body-scroll lock while open.
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose, goPrev, goNext])

  if (!images.length) return null
  const activeUrl = images[index]
  const showNav = images.length > 1

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-100 bg-black/90 backdrop-blur-sm flex flex-col"
        >
          {/* Header — counter + close. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 text-white"
          >
            <span className="text-[12px] font-bold tabular-nums tracking-[0.12em]">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image viewer"
              className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-white/10"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>
          </div>

          {/* Main image area. */}
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex-1 min-h-0 relative flex items-center justify-center px-4 sm:px-12"
          >
            {/* The image itself — uses unoptimized so user-uploaded URLs from
                Cloudinary or other domains don't need to be allow-listed. */}
            <div className="relative w-full h-full max-w-5xl">
              <Image
                key={activeUrl}
                src={activeUrl}
                alt={`Review photo ${index + 1} of ${images.length}`}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            </div>

            {showNav ? (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous image"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 inline-flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white"
                >
                  <CaretLeft className="w-5 h-5" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next image"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-10 w-10 sm:h-12 sm:w-12 inline-flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white"
                >
                  <CaretRight className="w-5 h-5" weight="bold" />
                </button>
              </>
            ) : null}
          </div>

          {/* Thumbnail strip — quick jump. Hidden when only one image. */}
          {showNav ? (
            <div
              onClick={(event) => event.stopPropagation()}
              className="shrink-0 px-4 py-3 sm:py-4 overflow-x-auto"
            >
              <div className="flex gap-2 justify-center min-w-min mx-auto">
                {images.map((url, thumbIndex) => {
                  const isActive = thumbIndex === index
                  return (
                    <button
                      key={`${url}-${thumbIndex}`}
                      type="button"
                      onClick={() => setIndex(thumbIndex)}
                      aria-label={`Jump to image ${thumbIndex + 1}`}
                      className={`shrink-0 relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden border-2 transition-colors ${
                        isActive
                          ? 'border-white'
                          : 'border-white/20 hover:border-white/50 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
