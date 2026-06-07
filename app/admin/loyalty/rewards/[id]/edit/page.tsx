import { redirect, notFound } from 'next/navigation'
import { RewardEditor } from '@/components/admin/loyalty/RewardEditor'
import { loadRewardDetail, loadTiersTab } from '@/lib/admin/loyalty'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect(`/admin/loyalty-v1/rewards/${id}/edit`)
  }

  const [detail, tiers] = await Promise.all([loadRewardDetail(id), loadTiersTab()])
  if (!detail) notFound()

  let isSuperAdmin = false
  try {
    const session = await getSession()
    if (session?.userId) {
      const customer = await prisma.customer.findUnique({
        where: { id: session.userId },
        select: { adminRole: true },
      })
      isSuperAdmin = customer?.adminRole === 'SUPER_ADMIN'
    }
  } catch {
    // fall through — isSuperAdmin stays false
  }

  return (
    <RewardEditor
      detail={detail}
      rewardId={id}
      tiers={tiers.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
      isSuperAdmin={isSuperAdmin}
    />
  )
}
