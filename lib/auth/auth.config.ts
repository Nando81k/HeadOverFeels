import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authConfig: NextAuthConfig = {
  providers: [
    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    
    // GitHub OAuth
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    
    // Email/Password credentials (existing system)
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

        const customer = await prisma.customer.findUnique({
          where: { email },
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
    }),
  ],
  
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, create or link customer account
      if (account?.provider !== 'credentials' && user.email) {
        const existingCustomer = await prisma.customer.findUnique({
          where: { email: user.email },
        });

        if (!existingCustomer) {
          // Create new customer for OAuth user
          await prisma.customer.create({
            data: {
              email: user.email,
              name: user.name || profile?.name || null,
              // No password for OAuth users
            },
          });
        }
      }
      return true;
    },
    
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      
      // On OAuth sign in, get the customer ID
      if (account?.provider !== 'credentials' && token.email) {
        const customer = await prisma.customer.findUnique({
          where: { email: token.email as string },
          select: { id: true, isAdmin: true },
        });
        if (customer) {
          token.id = customer.id;
          token.isAdmin = customer.isAdmin;
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
