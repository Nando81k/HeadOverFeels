import { loadCustomerNotes } from '@/lib/admin/customers'
import { CustomerNotesPanelClient } from './CustomerNotesPanelClient'

export interface CustomerNotesPanelProps {
  customerId: string
}

export async function CustomerNotesPanel({ customerId }: CustomerNotesPanelProps) {
  const notes = await loadCustomerNotes(customerId)
  return <CustomerNotesPanelClient customerId={customerId} notes={notes} />
}
