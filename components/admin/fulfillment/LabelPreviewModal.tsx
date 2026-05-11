'use client'

import { useEffect } from 'react'
import { ArrowSquareOut, DownloadSimple, Printer, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface LabelPreviewModalProps {
  isOpen: boolean
  url: string | null
  onClose: () => void
}

/**
 * In-drawer label preview.
 *
 * Renders the freshly-purchased shipping label inside an iframe, so the
 * operator can print it without leaving the admin workbench. The previous
 * flow used `window.open(url, '_blank')` after an async fetch — but
 * browsers treat post-await popups as programmatic and either block them
 * or navigate the current tab, throwing the operator out of context. This
 * modal sidesteps that entirely.
 */
export function LabelPreviewModal({ isOpen, url, onClose }: LabelPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  const handlePrint = () => {
    const iframe = document.getElementById('label-preview-frame') as HTMLIFrameElement | null
    try {
      iframe?.contentWindow?.focus()
      iframe?.contentWindow?.print()
    } catch {
      // Cross-origin frames can't be printed programmatically; fallback to
      // opening in a new tab where the operator can hit ⌘P themselves.
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && url ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-[1px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-[90] -translate-x-1/2 -translate-y-1/2 w-[min(40rem,calc(100vw-2rem))] h-[min(85vh,40rem)] flex flex-col rounded-xl border border-white/15 bg-neutral-950 shadow-2xl shadow-black/70"
          >
            <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <div>
                <p className="text-sm font-bold text-white tracking-tight">Shipping label ready</p>
                <p className="text-[11px] text-white/55">Print, download, or open in a new tab.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[#FF3131] text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#ff4747]"
                >
                  <Printer className="w-3.5 h-3.5" weight="bold" />
                  Print
                </button>
                <a
                  href={url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                  title="Download a local copy"
                >
                  <DownloadSimple className="w-3.5 h-3.5" />
                  Download
                </a>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.12em] text-white/75 hover:text-white hover:bg-white/10"
                >
                  <ArrowSquareOut className="w-3.5 h-3.5" />
                  New tab
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close label preview"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>
            <div className="flex-1 min-h-0 bg-white">
              <iframe
                id="label-preview-frame"
                src={url}
                title="Shipping label preview"
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
