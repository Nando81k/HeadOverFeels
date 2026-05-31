// app/admin/products/collections/[id]/page.tsx

import { notFound } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { CollectionDetailView } from '@/components/admin/products/CollectionDetailView'
import { loadCollectionDetail } from '@/lib/admin/products'

export const dynamic = 'force-dynamic'

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { id } = await params
  const collection = await loadCollectionDetail(id)

  if (!collection) notFound()

  return (
    <AdminLayout
      title={collection.name}
      subtitle={`Collection · ${collection.products.length} product${collection.products.length !== 1 ? 's' : ''}`}
    >
      <CollectionDetailView collection={collection} />
    </AdminLayout>
  )
}
