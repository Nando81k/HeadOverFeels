/**
 * /admin/products/reviews/[id] — Review reply page.
 *
 * Phase 3 Task 12.
 * Loads the review via loadReviewWithReplies and renders ReviewReplyView
 * inside the AdminLayout dispatcher (V1 / V2).
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { ReviewReplyView } from '@/components/admin/products/ReviewReplyView'
import { loadReviewWithReplies } from '@/lib/admin/products'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReviewReplyPage({ params }: PageProps) {
  const { id } = await params
  const review = await loadReviewWithReplies(id)

  if (!review) {
    notFound()
  }

  return (
    <AdminLayout
      title="Review Reply"
      subtitle={`Replying to ${review.customerName}'s review of ${review.productName}`}
      headerActions={
        <Link
          href="/admin/products"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          ← Back to Products
        </Link>
      }
    >
      <ReviewReplyView review={review} />
    </AdminLayout>
  )
}
