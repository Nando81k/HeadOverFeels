# Admin System Documentation

## Overview
The Head Over Feels platform now has a role-based authentication system with **Admin** and **Customer** user types.

## User Types

### Customer (Default)
- Can sign up and sign in
- Can view their profile and order history
- Can shop and place orders
- **Cannot** access the admin dashboard

### Admin
- Has all customer permissions
- **Can** access the admin dashboard at `/admin`
- Can manage products, collections, and orders
- Admin link appears in navigation when signed in

## Database Schema

The `Customer` model includes an `isAdmin` boolean field:
```prisma
model Customer {
  id       String  @id @default(cuid())
  email    String  @unique
  password String?
  name     String?
  isAdmin  Boolean @default(false)  // Admin access flag
  // ... other fields
}
```

## Making a User an Admin

### Method 1: Using the Script (Recommended)

Use the provided script to promote an existing user to admin:

```bash
npx tsx scripts/set-admin.ts admin@example.com
```

**Example output:**
```
✅ Successfully set admin status!
   Name: John Doe
   Email: admin@example.com
   Admin: true
```

### Method 2: Direct Database Update

Using Prisma Studio:
```bash
npx prisma studio
```

1. Open the `Customer` table
2. Find the user by email
3. Set `isAdmin` to `true`
4. Save changes

### Method 3: SQL Query

Using SQLite directly:
```bash
sqlite3 prisma/dev.db
```

```sql
UPDATE customers 
SET isAdmin = 1 
WHERE email = 'admin@example.com';
```

## Admin Access Flow

1. **Sign Up/Sign In**: Admin users sign in normally at `/signin`
2. **Authentication**: Session cookie is created on successful login
3. **Navigation**: Admin link (gear icon) appears in the navigation bar
4. **Middleware Protection**: `/admin/*` routes check for:
   - Valid session cookie
   - User exists in database
   - User has `isAdmin = true`
5. **Access Denied**: Non-admin users are redirected to homepage

## Middleware Protection

The middleware (`/middleware.ts`) automatically protects all `/admin` routes:

```typescript
export const config = {
  matcher: '/admin/:path*',
}
```

### Protection Logic:
1. Check for `auth_session` cookie
2. If no session → redirect to `/signin?redirect=/admin/...`
3. Query database for user's admin status
4. If not admin → redirect to homepage
5. If admin → allow access

## Testing the Admin System

### 1. Create a Regular User
```bash
# Navigate to http://localhost:3000/signin
# Sign up with any email/password
# User will have isAdmin = false by default
```

### 2. Try Accessing Admin Dashboard
```bash
# Visit http://localhost:3000/admin
# You'll be redirected to the homepage (not an admin)
```

### 3. Promote User to Admin
```bash
npx tsx scripts/set-admin.ts your-email@example.com
```

### 4. Access Admin Dashboard
```bash
# Sign out and sign back in
# You'll now see the Admin link (gear icon) in the navigation
# Click it to access /admin
```

## Navigation Changes

### Desktop Navigation
- **User Icon**: Shows "Sign In" (not logged in) or "Profile" (logged in)
- **Gear Icon**: Only visible to admin users, links to `/admin`

### Mobile Navigation
- **Sign In/Profile**: Text link in mobile menu
- **Admin Dashboard**: Only visible to admin users in mobile menu

## API Endpoints

All auth endpoints now return `isAdmin` status:

### POST /api/auth/signup
Returns user with `isAdmin: false` by default

### POST /api/auth/signin
Returns user with current `isAdmin` status

### GET /api/auth/me
Returns current user including `isAdmin` field

## Security Considerations

1. **Server-Side Protection**: Middleware checks admin status on every request
2. **HttpOnly Cookies**: Session cookies are httpOnly, preventing XSS attacks
3. **Secure Flag**: Cookies use `secure: true` in production (HTTPS only)
4. **No Client-Side Bypass**: Admin status is verified server-side, not just hidden UI
5. **Session Validation**: Every admin request validates the session against the database

## Common Issues

### "Admin link not showing after promotion"
**Solution**: Sign out and sign back in to refresh the session

### "TypeScript errors in admin files"
**Solution**: Restart the Next.js dev server or VS Code to reload Prisma types

### "Still can't access admin after promotion"
**Solution**: 
1. Check the database: `npx prisma studio`
2. Verify `isAdmin` is `true`
3. Clear browser cookies
4. Sign in again

## Admin Dashboard Features

Once you have admin access, you can:

- **Products**: Create, edit, delete, and manage product variants
- **Collections**: Create and manage product collections
- **Orders**: View and manage customer orders
- **Limited Edition Drops**: Set up time-limited product releases

## First-Time Setup

To set up your first admin account:

1. **Sign up** for a regular account at `/signin`
2. **Promote to admin** using the script:
   ```bash
   npx tsx scripts/set-admin.ts your-email@example.com
   ```
3. **Sign in again** to load your admin session
4. **Access admin** via the gear icon in the navigation

---

**Need help?** Check the logs in the terminal for authentication errors.
