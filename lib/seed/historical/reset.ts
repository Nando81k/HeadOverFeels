import { AdminRole, PrismaClient } from '@prisma/client'

export interface AdminUserIdentityBackup {
  id: string
  email: string
  name: string
  password: string
  role: AdminRole
  isActive: boolean
}

export interface AdminCustomerIdentityBackup {
  id: string
  email: string
  password: string | null
  name: string | null
  isAdmin: boolean
}

export interface AdminIdentitySnapshot {
  adminUsers: AdminUserIdentityBackup[]
  adminCustomers: AdminCustomerIdentityBackup[]
}

export interface DatabaseTargetInfo {
  provider: string
  host: string
  database: string
  schema: string
}

export function inspectDatabaseTarget(databaseUrlRaw: string | undefined): DatabaseTargetInfo {
  if (!databaseUrlRaw) {
    throw new Error('DATABASE_URL is not set')
  }

  const parsed = new URL(databaseUrlRaw)
  const databaseName = parsed.pathname.replace(/^\//, '') || 'unknown'
  const schema = parsed.searchParams.get('schema') ?? 'public'

  return {
    provider: parsed.protocol.replace(':', ''),
    host: parsed.host || 'unknown',
    database: databaseName,
    schema,
  }
}

export async function snapshotAdminIdentities(prisma: PrismaClient): Promise<AdminIdentitySnapshot> {
  const [adminUsers, adminCustomers] = await Promise.all([
    prisma.adminUser.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        isActive: true,
      },
    }),
    prisma.customer.findMany({
      where: { isAdmin: true },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        isAdmin: true,
      },
    }),
  ])

  return {
    adminUsers,
    adminCustomers,
  }
}

export function hasAnyAdminIdentity(snapshot: AdminIdentitySnapshot): boolean {
  return snapshot.adminUsers.length > 0 || snapshot.adminCustomers.length > 0
}

export async function truncatePublicTables(prisma: PrismaClient): Promise<number> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) {
    throw new Error('No public tables were found to truncate')
  }

  const tableNames = tables.map((table) => `"public"."${table.tablename.replace(/"/g, '""')}"`)
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames.join(', ')} RESTART IDENTITY CASCADE;`)

  return tables.length
}

export async function restoreAdminIdentities(
  prisma: PrismaClient,
  snapshot: AdminIdentitySnapshot
): Promise<{ restoredAdminUsers: number; restoredAdminCustomers: number }> {
  if (snapshot.adminUsers.length > 0) {
    await prisma.adminUser.createMany({
      data: snapshot.adminUsers.map((adminUser) => ({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        password: adminUser.password,
        role: adminUser.role,
        isActive: adminUser.isActive,
      })),
      skipDuplicates: true,
    })
  }

  if (snapshot.adminCustomers.length > 0) {
    await prisma.customer.createMany({
      data: snapshot.adminCustomers.map((adminCustomer) => ({
        id: adminCustomer.id,
        email: adminCustomer.email.toLowerCase(),
        password: adminCustomer.password,
        name: adminCustomer.name,
        isAdmin: true,
        newsletter: false,
        smsOptIn: false,
        totalSpent: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        annualSpend: 0,
        currentPoints: 0,
        lifetimePoints: 0,
        annualPointsEarned: 0,
      })),
      skipDuplicates: true,
    })
  }

  return {
    restoredAdminUsers: snapshot.adminUsers.length,
    restoredAdminCustomers: snapshot.adminCustomers.length,
  }
}
