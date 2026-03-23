'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Command } from 'cmdk'
import { Layout, Package, ShoppingCart, Users, Tag, Star, ChartBar, Wallet, Gift, Lightning, MagnifyingGlass, Plus, FileText, EnvelopeSimple } from '@phosphor-icons/react'

interface CommandPaletteProps {
  isAdmin?: boolean
}

export function CommandPalette({ isAdmin = false }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const pathname = usePathname()

  // Toggle command palette with Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Close on route change (using useEffect cleanup pattern)
  useEffect(() => {
    const closeOnRouteChange = () => setOpen(false)
    closeOnRouteChange()
  }, [pathname])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const adminCommands = [
    {
      group: 'Navigation',
      items: [
        { icon: Layout, label: 'Dashboard', href: '/admin', shortcut: 'G → D' as const },
        { icon: Package, label: 'Products', href: '/admin/products', shortcut: 'G → P' as const },
        { icon: ShoppingCart, label: 'Orders', href: '/admin/orders', shortcut: 'G → O' as const },
        { icon: Users, label: 'Customers', href: '/admin/customers', shortcut: 'G → C' as const },
        { icon: Tag, label: 'Collections', href: '/admin/collections', shortcut: 'G → L' as const },
        { icon: Star, label: 'Reviews', href: '/admin/reviews', shortcut: 'G → R' as const },
        { icon: ChartBar, label: 'Analytics', href: '/admin/analytics', shortcut: 'G → A' as const },
        { icon: Wallet, label: 'Financial', href: '/admin/financial', shortcut: 'G → F' as const },
        { icon: Gift, label: 'Loyalty', href: '/admin/loyalty', shortcut: 'G → Y' as const },
        { icon: EnvelopeSimple, label: 'Newsletter', href: '/admin/newsletter', shortcut: 'G → N' as const },
        { icon: Lightning, label: 'Drops', href: '/admin/drops', shortcut: 'G → R' as const },
      ],
    },
    {
      group: 'Actions',
      items: [
        { icon: Plus, label: 'New Product', href: '/admin/products/new', shortcut: 'Ctrl + N' as const },
        { icon: Plus, label: 'New Collection', href: '/admin/collections/new', shortcut: 'Ctrl + Shift + N' as const },
        { icon: FileText, label: 'Export Data', href: '/admin/analytics', shortcut: 'Ctrl + E' as const },
      ],
    },
  ]

  const publicCommands = [
    {
      group: 'Navigation',
      items: [
        { icon: Layout, label: 'Home', href: '/' },
        { icon: Package, label: 'Products', href: '/products' },
        { icon: Tag, label: 'Collections', href: '/collections' },
        { icon: ShoppingCart, label: 'Cart', href: '/cart' },
      ],
    },
  ]

  const commands = isAdmin ? adminCommands : publicCommands

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50"
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl">
        <Command className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Accessible Title - Visually Hidden */}
          <h2 className="sr-only">Command Menu</h2>
          
          <div className="flex items-center border-b border-gray-200 px-4">
            <MagnifyingGlass size={24} weight="bold" className="h-5 w-5 text-gray-400 mr-3" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 py-4 text-sm outline-none placeholder:text-gray-400"
            />
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>

            {commands.map((group) => (
              <Command.Group 
                key={group.group} 
                heading={group.group}
                className="mb-2"
              >
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.group}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => navigate(item.href)}
                      className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.label}
                        </span>
                      </div>
                      {'shortcut' in item && typeof (item as {shortcut?: string}).shortcut === 'string' && (
                        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded">
                          {(item as {shortcut: string}).shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  )
                })}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-gray-300">K</kbd>
              to close
            </span>
          </div>
        </Command>
      </div>
    </Command.Dialog>
  )
}
