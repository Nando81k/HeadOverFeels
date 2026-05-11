import { redirect } from 'next/navigation'

// Safety net for legacy notifications + any stray "/loyalty" link.
// The actual loyalty experience is split across the rewards hub on the
// profile page and dedicated subroutes (/loyalty/points, /loyalty/tiers,
// /loyalty/history). Bare /loyalty lands customers on the rewards hub.
export default function LoyaltyIndexPage() {
  redirect('/profile#rewards')
}
