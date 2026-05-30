import { AdminLayoutV1 } from './AdminLayoutV1'
import { AdminLayoutV2 } from './v2/AdminLayoutV2'

export interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
  pendingOrders?: number
  activeDrops?: number
  userName?: string
  userRole?: string
  contentScroll?: 'auto' | 'hidden'
  contentClassName?: string
}

const isV2Enabled = () => process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED === 'true'

export function AdminLayout(props: AdminLayoutProps) {
  if (isV2Enabled()) {
    return <AdminLayoutV2 {...props} />
  }
  return <AdminLayoutV1 {...props} />
}
