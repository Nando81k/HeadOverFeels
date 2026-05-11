'use client'

import { X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

interface KeyboardShortcutHelpProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['j'], label: 'Move selection down' },
  { keys: ['k'], label: 'Move selection up' },
  { keys: ['o'], label: 'Open drawer for selected row' },
  { keys: ['a'], label: 'Run primary action on selected row' },
  { keys: ['s'], label: 'Mark selected order shipped' },
  { keys: ['b'], label: 'Toggle selected order in batch' },
  { keys: ['l'], label: 'Buy / open label for selected order' },
  { keys: ['p'], label: 'Re-open last purchased label' },
  { keys: ['←'], label: 'Previous order (drawer open)' },
  { keys: ['→'], label: 'Next order (drawer open)' },
  { keys: ['?'], label: 'Toggle this help' },
  { keys: ['Esc'], label: 'Close drawer / clear batch / close help' },
]

/**
 * Modal listing every keyboard shortcut available on the workbench.
 *
 * Bound to `?` in the page-level keydown handler. Closes on backdrop click,
 * Esc, or the explicit close button.
 */
export function KeyboardShortcutHelp({ isOpen, onClose }: KeyboardShortcutHelpProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[1px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-neutral-950 shadow-2xl shadow-black/70"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm font-bold text-white tracking-tight">Keyboard shortcuts</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close help"
                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <ul className="p-4 space-y-2">
              {SHORTCUTS.map(({ keys, label }) => (
                <li key={label} className="flex items-center justify-between gap-3 text-xs text-white/85">
                  <span>{label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {keys.map((key) => (
                      <kbd
                        key={key}
                        className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded border border-white/15 bg-white/5 text-[11px] font-mono text-white/85"
                      >
                        {key}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <footer className="px-4 py-2.5 border-t border-white/10 text-[10px] uppercase tracking-[0.14em] text-white/40">
              Tip: shortcuts are ignored while typing in inputs.
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
