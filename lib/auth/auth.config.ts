import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const CANONICAL_CUSTOMER_ORDER = [
  { totalOrders: 'desc' as const },
  { lifetimePoints: 'desc' as const },
  { currentPoints: 'desc' as const },
  { createdAt: 'asc' as const },
]

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

async function findCanonicalCustomerByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  return prisma.customer.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
    orderBy: CANONICAL_CUSTOMER_ORDER,
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
    },
  })
}

// Build providers array conditionally based on available env vars
const providers: NextAuthConfig['providers'] = [];

// Only add Google OAuth if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Only add GitHub OAuth if credentials are configured
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Email/Password credentials (always available)
providers.push(
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = credentials.email as string;
      const password = credentials.password as string;
      const normalizedEmail = normalizeEmail(email)

      const customer = await prisma.customer.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          password: {
            not: null,
          },
        },
        orderBy: CANONICAL_CUSTOMER_ORDER,
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          isAdmin: true,
        },
      });

      if (!customer || !customer.password) {
        return null;
      }

      const passwordMatch = await bcrypt.compare(password, customer.password);

      if (!passwordMatch) {
        return null;
      }

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        isAdmin: customer.isAdmin,
      };
    },
  })
);

export const authConfig: NextAuthConfig = {
  providers,
  
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, create or link customer account
      if (account?.provider !== 'credentials' && user.email) {
        const normalizedEmail = normalizeEmail(user.email)
        const existingCustomer = await findCanonicalCustomerByEmail(normalizedEmail)

        if (!existingCustomer) {
          const defaultTier = await prisma.loyaltyTier.findFirst({
            where: { isActive: true, isInviteOnly: false },
            orderBy: { minAnnualPoints: 'asc' },
            select: { id: true },
          })

          // Create new customer for OAuth user
          await prisma.customer.create({
            data: {
              email: normalizedEmail,
              name: user.name || profile?.name || null,
              loyaltyTierId: defaultTier?.id,
              // No password for OAuth users
            },
          });
        }
        user.email = normalizedEmail
      }
      return true;
    },
    
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      
      // Resolve canonical customer by email to avoid split accounts caused by
      // mixed-case provider emails (e.g. User@Email.com vs user@email.com).
      if (token.email) {
        const customer = await findCanonicalCustomerByEmail(token.email as string)
        if (customer) {
          token.id = customer.id;
          token.isAdmin = customer.isAdmin;
          token.email = customer.email;
          if (!token.name && customer.name) {
            token.name = customer.name;
          }
        }
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  
  trustHost: true,
};
