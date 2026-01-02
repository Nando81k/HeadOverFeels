# 🛡️ Security Quick Reference

## 🔐 Security Status: PRODUCTION-READY

### Critical Protections Active ✅
- ✅ **SQL Injection**: Protected (Prisma ORM)
- ✅ **XSS**: Protected (React + CSP headers)
- ✅ **CSRF**: Protected (Origin validation)
- ✅ **Brute Force**: Protected (Rate limiting)
- ✅ **Session Hijacking**: Protected (HttpOnly + Secure cookies)
- ✅ **Clickjacking**: Protected (X-Frame-Options: DENY)
- ✅ **Weak Passwords**: Protected (bcrypt + validation)

---

## 🚀 Quick Start: Apply Security to New API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { validateData, yourSchema } from '@/lib/security/validation'

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check (if admin route)
    await requireAdmin(request)
    
    // 2. Validate input
    const data = validateData(yourSchema, await request.json())
    
    // 3. Database operation
    const result = await prisma.model.create({ data })
    
    // 4. Return
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: error instanceof Error ? 400 : 500 }
    )
  }
}
```

---

## 📋 Available Validation Schemas

**Import from**: `/lib/security/validation.ts`

### Authentication
- `emailSchema` - Email validation
- `passwordSchema` - Strong password (8+ chars, mixed case, numbers)
- `nameSchema` - Name with character restrictions

### E-commerce
- `productCreateSchema` / `productUpdateSchema`
- `collectionCreateSchema` / `collectionUpdateSchema`
- `addressSchema` - Shipping/billing addresses
- `orderCreateSchema` - Order validation
- `cartItemSchema` - Cart items

### Loyalty
- `rewardCreateSchema` / `rewardUpdateSchema`
- `tierUpdateSchema` - Tier configuration

### Utilities
- `paginationSchema` - Page, limit params
- `sortSchema` - sortBy, sortOrder params
- `productFilterSchema` - Product filters
- `uuidSchema` - UUID validation
- `slugSchema` - URL slug validation

---

## 🔧 Utility Functions

**From**: `/lib/security/validation.ts`
```typescript
validateData<T>(schema, data)     // Throws on error
safeValidate<T>(schema, data)     // Returns { success, data/error }
```

**From**: `/lib/security/middleware.ts`
```typescript
sanitizeInput(input)               // Remove HTML, JS
isValidEmail(email)                // Email format check
isValidUrl(url)                    // URL format check (http/https)
generateSecureToken(length?)       // Crypto-secure random token
secureCompare(a, b)                // Constant-time comparison
```

---

## ⚡ Rate Limits

**Current Settings** (in `/middleware.ts`):
- **Auth endpoints** (`/api/auth/signin`, `/api/auth/signup`): 5 requests / 15 minutes
- **Admin endpoints** (`/api/admin/*`): 60 requests / minute
- **API endpoints** (`/api/*`): 100 requests / minute

**When hit**: Returns 429 status with `Retry-After` header

**Production Note**: Replace in-memory store with Redis for multi-server setups

---

## 🔒 Security Headers Applied

Auto-applied by middleware to all responses:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [comprehensive policy]
Strict-Transport-Security: max-age=31536000 (production only)
```

---

## 🧪 Testing Security

### Test Rate Limiting
```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/signin \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "Request $i"
done
```

### Test Security Headers
```bash
curl -I http://localhost:3000
# Look for X-Frame-Options, CSP, etc.
```

### Test Origin Validation
```bash
# Should be rejected
curl -X POST http://localhost:3000/api/products \
  -H "Origin: https://evil.com" \
  -d '{"name":"Test"}'
```

---

## 📦 Files Reference

| File | Purpose |
|------|---------|
| `/lib/security/middleware.ts` | Security headers, rate limiting, utilities |
| `/lib/security/validation.ts` | Zod schemas for all models |
| `/lib/security/config.ts` | Security configuration (deprecated, use middleware.ts) |
| `/middleware.ts` | Next.js middleware with security + auth |
| `/lib/auth/admin.ts` | Admin authentication helpers |
| `/docs/SECURITY.md` | Complete security documentation |

---

## 🚨 Emergency: Under Attack?

**Immediate Actions**:
1. Reduce rate limits in `/middleware.ts`:
   ```typescript
   const RATE_LIMITS = {
     auth: { maxRequests: 1, windowMs: 60000 },  // 1/min
     api: { maxRequests: 10, windowMs: 60000 },  // 10/min
   }
   ```

2. Enable IP blocking (add to middleware):
   ```typescript
   const BLOCKED_IPS = ['1.2.3.4', '5.6.7.8']
   if (BLOCKED_IPS.includes(getClientIp(request))) {
     return NextResponse.json({ error: 'Blocked' }, { status: 403 })
   }
   ```

3. Force logout all users:
   ```bash
   # In Prisma Studio or database
   DELETE FROM Session;
   ```

---

## 📚 Learn More

- **Full Documentation**: `/docs/SECURITY.md`
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Next.js Security**: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

---

**Status**: ✅ Production-Ready  
**Last Updated**: 2024  
**Security Level**: High
