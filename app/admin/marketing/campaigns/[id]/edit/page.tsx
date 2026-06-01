import { redirect, notFound } from 'next/navigation'
import { CampaignEditor } from '@/components/admin/marketing/editor/CampaignEditor'
import { loadCampaignDetail } from '@/lib/admin/marketing'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminCampaignEditPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect('/admin/newsletter')
  }

  const detail = await loadCampaignDetail(id)
  if (!detail) notFound()

  return <CampaignEditor detail={detail} campaignId={id} />
}
