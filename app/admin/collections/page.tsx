'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, PencilSimple, Trash, CircleNotch, Star, Eye, EyeSlash, Tag, Download, DotsSixVertical } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { TableSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Collection {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  _count: {
    products: number
  }
  createdAt: string
  updatedAt: string
}

interface SortableRowProps {
  collection: Collection
  deleting: string | null
  onDelete: (id: string, name: string) => void
}

function SortableRow({ collection, deleting, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="hover:bg-white/5"
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <button
            className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50"
            {...attributes}
            {...listeners}
          >
            <DotsSixVertical size={20} weight="bold" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-white">
                {collection.name}
              </div>
              {collection.isFeatured && (
                <Star size={16} weight="bold" className="text-amber-400 fill-amber-400" />
              )}
            </div>
            {collection.description && (
              <div className="text-sm text-white/40 truncate max-w-xs">
                {collection.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-white/70">{collection.slug}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-white/70">
          {collection._count.products} {collection._count.products === 1 ? 'product' : 'products'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {collection.isActive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">
              <Eye size={12} weight="bold" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-white/10 text-white/70">
              <EyeSlash size={12} weight="bold" />
              Inactive
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-white/70">{collection.sortOrder}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/admin/collections/${collection.id}`}>
            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20">
              <PencilSimple size={16} weight="bold" />
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(collection.id, collection.name)}
            disabled={deleting === collection.id}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-0"
          >
            {deleting === collection.id ? (
              <CircleNotch size={16} weight="bold" className="animate-spin" />
            ) : (
              <Trash size={16} weight="bold" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadCollections()
  }, [])

  const loadCollections = async () => {
    try {
      const response = await fetch('/api/collections')
      if (response.ok) {
        const data = await response.json()
        setCollections(data)
      }
    } catch (error) {
      console.error('Failed to load collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will remove all product associations.`)) {
      return
    }

    const loadingToast = toast.loading('Deleting collection...')
    setDeleting(id)
    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCollections(collections.filter(c => c.id !== id))
        toast.dismiss(loadingToast)
        toast.success('Collection deleted', `"${name}" was successfully deleted`)
      } else {
        toast.dismiss(loadingToast)
        toast.error('Delete failed', 'Could not delete the collection. Please try again.')
      }
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Delete failed', 'An error occurred while deleting the collection')
    } finally {
      setDeleting(null)
    }
  }

  const handleExportCollections = () => {
    const loadingToast = toast.loading('Exporting collections...')
    
    try {
      const csv = [
        ['Name', 'Slug', 'Products', 'Status', 'Featured', 'Sort Order', 'Created'],
        ...collections.map(c => [
          c.name,
          c.slug,
          c._count.products.toString(),
          c.isActive ? 'Active' : 'Inactive',
          c.isFeatured ? 'Yes' : 'No',
          c.sortOrder.toString(),
          new Date(c.createdAt).toLocaleDateString()
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `collections-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.dismiss(loadingToast)
      toast.success('Collections exported successfully', `Downloaded ${collections.length} collections`)
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Export failed', 'Could not export collections')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = collections.findIndex((c) => c.id === active.id)
    const newIndex = collections.findIndex((c) => c.id === over.id)

    const reorderedCollections = arrayMove(collections, oldIndex, newIndex)
    
    // Update sortOrder for all affected collections
    const updatedCollections = reorderedCollections.map((collection, index) => ({
      ...collection,
      sortOrder: index
    }))

    setCollections(updatedCollections)

    const loadingToast = toast.loading('Updating collection order...')

    try {
      // Update sortOrder in database for all affected collections
      await Promise.all(
        updatedCollections.map((collection) =>
          fetch(`/api/collections/${collection.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: collection.sortOrder }),
          })
        )
      )

      toast.dismiss(loadingToast)
      toast.success('Collection order updated', 'Changes saved successfully')
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Update failed', 'Could not save the new order')
      // Revert on error
      loadCollections()
    }
  }

  return (
    <AdminLayout
      title="Collections"
      subtitle="Organize your products into collections"
      headerActions={
        <div className="flex gap-2">
          <button
            onClick={handleExportCollections}
            disabled={collections.length === 0}
            className="inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={16} weight="bold" className="mr-2" />
            Export
          </button>
          <Link href="/admin/collections/new">
            <Button className="bg-[#FF3131] hover:bg-[#E02828]">
              <Plus size={16} weight="bold" className="mr-2" />
              New Collection
            </Button>
          </Link>
        </div>
      }
    >
      {loading ? (
        <TableSkeleton rows={5} columns={6} />
        ) : collections.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No Collections Yet"
            description="Collections help you organize products into groups like 'Summer Collection' or 'Best Sellers'. Create your first collection to get started."
            action={{
              label: 'Create Collection',
              href: '/admin/collections/new',
            }}
            secondaryAction={{
              label: 'View Products',
              href: '/admin/products',
            }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="bg-neutral-900 border border-white/10 overflow-hidden">
              <table className="min-w-full divide-y divide-white/5">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Collection
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Slug
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Products
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Sort Order
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <SortableContext
                  items={collections.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody className="divide-y divide-white/5">
                    {collections.map((collection) => (
                      <SortableRow
                        key={collection.id}
                        collection={collection}
                        deleting={deleting}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </SortableContext>
              </table>
            </div>
          </DndContext>
        )}

        {/* Mobile Floating Add Button */}
        <Link
          href="/admin/collections/new"
          className="sm:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-[#FF3131] hover:bg-[#E02828] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label="New Collection"
        >
          <Plus size={24} weight="bold" />
        </Link>
      </AdminLayout>
  )
}
