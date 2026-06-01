import { redirect, notFound } from 'next/navigation'
import { PopupEditor } from '@/components/admin/marketing/editor/PopupEditor'
import { loadPopupDetail } from '@/lib/admin/marketing'

export const revalidate = 60

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminPopupEditPage({ params }: PageProps) {
  const { id } = await params

  if (process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED !== 'true') {
    redirect(`/admin/popups/${id}`)
  }

  const detail = await loadPopupDetail(id)
  if (!detail) notFound()

  return <PopupEditor detail={detail} popupId={id} />
}
