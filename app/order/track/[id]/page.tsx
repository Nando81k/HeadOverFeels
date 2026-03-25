import { redirect } from 'next/navigation'

interface LegacyOrderTrackPageProps {
  params: Promise<{ id: string }>
}

export default async function LegacyOrderTrackPage({ params }: LegacyOrderTrackPageProps) {
  const { id } = await params
  redirect(`/orders/${id}/track`)
}
