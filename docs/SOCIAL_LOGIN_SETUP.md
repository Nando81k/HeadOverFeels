# Social Login Setup Guide

Head Over Feels supports social authentication through Google and GitHub using NextAuth.js v5.

## Overview

Users can now sign in/sign up using:
- **Email & Password** (existing system)
- **Google** (OAuth 2.0)
- **GitHub** (OAuth)

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# NextAuth.js Secret (generate a secure random string)
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth  
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy the Client ID and Client Secret to your `.env.local`

## Setting Up GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - **Application name**: Head Over Feels
   - **Homepage URL**: `http://localhost:3000` (or production URL)
   - **Authorization callback URL**: 
     - Development: `http://localhost:3000/api/auth/callback/github`
     - Production: `https://yourdomain.com/api/auth/callback/github`
4. Copy the Client ID
5. Generate a new Client Secret and copy it
6. Add both to your `.env.local`

## Architecture

### Files Modified/Created

| File | Purpose |
|------|---------|
| `lib/auth/auth.config.ts` | NextAuth configuration with all providers |
| `lib/auth/auth.ts` | NextAuth instance with Prisma adapter |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth API route handler |
| `app/signin/page.tsx` | Updated with social login buttons |
| `app/providers.tsx` | Added SessionProvider wrapper |
| `lib/auth/context.tsx` | Integrated with NextAuth session |
| `app/api/auth/me/route.ts` | Updated to check NextAuth session |
| `types/next-auth.d.ts` | TypeScript declarations for session |

### Database Models (Prisma)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user Customer @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         Customer @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

## How It Works

### OAuth Flow

1. User clicks "Google" or "GitHub" button on signin page
2. NextAuth redirects to provider's OAuth consent screen
3. User authorizes the application
4. Provider redirects back with authorization code
5. NextAuth exchanges code for access token
6. If new user: Creates Customer record with email from provider
7. Links OAuth account to Customer via Account model
8. Creates JWT session with customer ID
9. User is authenticated and redirected

### Account Linking

When a user signs in with OAuth:
- If their email already exists (from email/password signup), the accounts are **automatically linked**
- This is enabled by `allowDangerousEmailAccountLinking: true` in the provider config
- Users can sign in with either method after linking

### Session Handling

The `AuthProvider` component:
1. Uses NextAuth's `useSession()` hook to detect OAuth sessions
2. Falls back to cookie-based auth for existing email/password users
3. Fetches full user data from `/api/auth/me` endpoint
4. Provides consistent `user` object to all components

## Testing

1. Start the development server: `npm run dev`
2. Navigate to `/signin`
3. Click "Google" or "GitHub" button
4. Complete OAuth flow
5. Verify you're redirected back and authenticated

## Troubleshooting

### "OAuth configuration error"
- Ensure all environment variables are set correctly
- Check redirect URIs match exactly in provider settings

### "User not found after OAuth"
- Check database has Account record linked to Customer
- Verify Customer was created with correct email

### Session not persisting
- Ensure `AUTH_SECRET` is set
- Check browser cookies are enabled
- Verify SessionProvider is wrapping the app

## Security Notes

- OAuth tokens are stored encrypted in the database
- `allowDangerousEmailAccountLinking` should only be used when you trust the OAuth providers
- All sessions use JWT strategy for stateless authentication
- Sessions expire after 7 days by default

## Future Enhancements

Potential additions:
- Apple Sign In
- Discord OAuth
- Phone number authentication (SMS verification)
- Two-factor authentication (2FA)
