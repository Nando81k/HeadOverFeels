'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Command } from 'cmdk'
import {
  Layout,
  Package,
  ShoppingCart,
  Users,
  Tag,
  Star,
  ChartBar,
  Wallet,
  Gift,
  Lightning,
  MagnifyingGlass,
  Plus,
  FileText,
  EnvelopeSimple,
  CircleNotch,
} from '@phosphor-icons/react'

interface CommandPaletteProps {
  isAdmin?: boolean
}

interface ProductHit {
  id: string
  name: string
  slug: string
  price?: number
}

interface OrderHit {
  id: string
  orderNumber: string
  status: string
  total: number
  customerEmail: string
}

interface CustomerHit {
  id: string
  email: string
  name: string | null
  currentPoints: number
}

interface DynamicResults {
  products: ProductHit[]
  orders: OrderHit[]
  customers: CustomerHit[]
}

const EMPTY_RESULTS: DynamicResults = { products: [], orders: [], customers: [] }

export function CommandPalette({ isAdmin = false }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dynamicResults, setDynamicResults] = useState<DynamicResults>(EMPTY_RESULTS)
  const [searchLoading, setSearchLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Toggle command palette with Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearch('')
      setDynamicResults(EMPTY_RESULTS)
      setSearchLoading(false)
    }
  }, [open])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Debounced dynamic search (admin only — public mode keeps the static commands)
  useEffect(() => {
    if (!isAdmin) return
    const trimmed = search.trim()

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (trimmed.length < 2) {
      setDynamicResults(EMPTY_RESULTS)
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      try {
        const [productsRes, ordersRes, customersRes] = await Promise.all([
          fetch(
            `/api/products/search?q=${encodeURIComponent(trimmed)}&limit=5`,
            { signal: controller.signal }
          ),
          fetch(
            `/api/orders?search=${encodeURIComponent(trimmed)}&limit=5`,
            { signal: controller.signal }
          ),
          fetch(
            `/api/admin/loyalty/customers?search=${encodeURIComponent(trimmed)}&limit=5`,
            { signal: controller.signal }
          ),
        ])

        const [products, orders, customers] = await Promise.all([
          productsRes.ok ? productsRes.json() : { data: [] },
          ordersRes.ok ? ordersRes.json() : { data: [] },
          customersRes.ok ? customersRes.json() : { data: [] },
        ])

        setDynamicResults({
          products: (products.data ?? products ?? []).slice(0, 5),
          orders: (orders.data ?? orders ?? []).slice(0, 5),
          customers: (customers.data ?? customers ?? []).slice(0, 5),
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Command palette search failed:', error)
        }
      } finally {
        setSearchLoading(false)
      }
    }, 220)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, isAdmin])

  const navigate = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  const adminCommands = useMemo(
    () => [
      {
        group: 'Navigation',
        items: [
          { icon: Layout, label: 'Dashboard', href: '/admin', shortcut: 'G → D' },
          { icon: Package, label: 'Products', href: '/admin/products', shortcut: 'G → P' },
          { icon: ShoppingCart, label: 'Orders', href: '/admin/fulfillment', shortcut: 'G → O' },
          { icon: Users, label: 'Customers', href: '/admin/customers', shortcut: 'G → C' },
          { icon: Tag, label: 'Collections', href: '/admin/collections', shortcut: 'G → L' },
          { icon: Star, label: 'Reviews', href: '/admin/reviews', shortcut: 'G → R' },
          { icon: ChartBar, label: 'Analytics', href: '/admin/analytics', shortcut: 'G → A' },
          { icon: Wallet, label: 'Financial', href: '/admin/financial', shortcut: 'G → F' },
          { icon: Gift, label: 'Loyalty', href: '/admin/loyalty', shortcut: 'G → Y' },
          { icon: EnvelopeSimple, label: 'Newsletter', href: '/admin/newsletter', shortcut: 'G → N' },
          { icon: Lightning, label: 'Drops', href: '/admin/drops' },
        ],
      },
      {
        group: 'Actions',
        items: [
          { icon: Plus, label: 'New Product', href: '/admin/products/new', shortcut: 'Ctrl + N' },
          { icon: Plus, label: 'New Collection', href: '/admin/collections/new' },
          { icon: FileText, label: 'Export Data', href: '/admin/analytics' },
        ],
      },
    ],
    []
  )

  const publicCommands = useMemo(
    () => [
      {
        group: 'Navigation',
        items: [
          { icon: Layout, label: 'Home', href: '/' },
          { icon: Package, label: 'Products', href: '/products' },
          { icon: Tag, label: 'Collections', href: '/collections' },
          { icon: ShoppingCart, label: 'Cart', href: '/cart' },
        ],
      },
    ],
    []
  )

  const commands = isAdmin ? adminCommands : publicCommands

  // Filter static commands by the current query when there is one. We disable
  // cmdk's built-in filtering so we can manage both static + dynamic results.
  const lowerSearch = search.trim().toLowerCase()
  const filteredCommands = lowerSearch
    ? commands
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => item.label.toLowerCase().includes(lowerSearch)),
        }))
        .filter((g) => g.items.length > 0)
    : commands

  const hasDynamicResults =
    dynamicResults.products.length > 0 ||
    dynamicResults.orders.length > 0 ||
    dynamicResults.customers.length > 0

  const hasAnyResults = filteredCommands.length > 0 || hasDynamicResults

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      className="fixed inset-0 z-50"
      shouldFilter={false}
    >
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl">
        <Command className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden" shouldFilter={false}>
          <h2 className="sr-only">Command Menu</h2>

          <div className="flex items-center border-b border-gray-200 px-4">
            <MagnifyingGlass size={20} weight="bold" className="text-gray-400 mr-3 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={isAdmin ? 'Search products, orders, customers…' : 'Type a command or search…'}
              className="flex-1 py-4 text-sm outline-none placeholder:text-gray-400"
            />
            {searchLoading && (
              <CircleNotch size={14} weight="bold" className="text-gray-400 animate-spin mr-2 shrink-0" />
            )}
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            {!hasAnyResults && !searchLoading && (
              <Command.Empty className="py-8 text-center text-sm text-gray-500">
                {lowerSearch ? `No results for "${search}"` : 'No commands available.'}
              </Command.Empty>
            )}

            {/* Dynamic Search Results — admin only */}
            {isAdmin && dynamicResults.products.length > 0 && (
              <Command.Group heading="Products" className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Products
                </div>
                {dynamicResults.products.map((product) => (
                  <Command.Item
                    key={`product-${product.id}`}
                    value={`product-${product.id}`}
                    onSelect={() => navigate(`/admin/products/${product.id}`)}
                    className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Package className="h-4 w-4 text-gray-500 shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </span>
                    </div>
                    {typeof product.price === 'number' && (
                      <span className="text-xs text-gray-500 shrink-0">
                        ${product.price.toFixed(2)}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {isAdmin && dynamicResults.orders.length > 0 && (
              <Command.Group heading="Orders" className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Orders
                </div>
                {dynamicResults.orders.map((order) => (
                  <Command.Item
                    key={`order-${order.id}`}
                    value={`order-${order.id}`}
                    onSelect={() => navigate(`/admin/fulfillment?orderId=${order.id}`)}
                    className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ShoppingCart className="h-4 w-4 text-gray-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          #{order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{order.customerEmail}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-gray-900">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase">{order.status}</p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {isAdmin && dynamicResults.customers.length > 0 && (
              <Command.Group heading="Customers" className="mb-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Customers
                </div>
                {dynamicResults.customers.map((customer) => (
                  <Command.Item
                    key={`customer-${customer.id}`}
                    value={`customer-${customer.id}`}
                    onSelect={() => navigate(`/admin/customers/${customer.id}`)}
                    className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer data-[selected=true]:bg-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Users className="h-4 w-4 text-gray-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {customer.name || customer.email}
                        </p>
                        {customer.name && (
                          <p className="text-xs text-gray-500 truncate">{customer.email}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {customer.currentPoints} pts
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Static commands — Navigation + Actions */}
            {filteredCommands.map((group) => (
              <Command.Group key={group.group} heading={group.group} className="mb-2">
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
                        <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      </div>
                      {'shortcut' in item && typeof (item as { shortcut?: string }).shortcut === 'string' && (
                        <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded">
                          {(item as { shortcut: string }).shortcut}
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
