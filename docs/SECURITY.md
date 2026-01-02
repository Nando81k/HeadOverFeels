# 🔒 Security Implementation Guide

## Overview
This document outlines the comprehensive security measures implemented in Head Over Feels. The codebase now includes multiple layers of protection against common web vulnerabilities.

## Security Features Implemented

### ✅ 1. SQL Injection Protection
**Status**: Protected by default
- **Implementation**: Prisma ORM automatically parameterizes all queries
- **No Action Required**: All database operations are safe
- **Verification**: Grep search confirmed zero raw SQL queries in codebase

### ✅ 2. Security Headers
**Status**: Fully implemented
**Location**: `/lib/security/middleware.ts` → `securityHeaders()` function

**Headers Applied**:
```
X-Frame-Options: DENY                      # Prevents clickjacking
X-Content-Type-Options: nosniff            # Prevents MIME sniffing
X-XSS-Protection: 1; mode=block            # XSS filter for older browsers
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [detailed policy]
Strict-Transport-Security: max-age=31536000 (production only)
```

**Content Security Policy (CSP)**:
- Scripts: Self + inline (unsafe-eval in dev for hot reload)
- Styles: Self + inline + Google Fonts
- Images: Self + data URIs + HTTPS + blob
- Fonts: Self + Google Fonts
- Connections: Self + Stripe API + Cloudinary API
- Frames: Self + Stripe.js
- Objects: None
- Upgrades insecure requests automatically

### ✅ 3. Rate Limiting
**Status**: Fully implemented
**Location**: `/middleware.ts` + `/lib/security/middleware.ts`

**Rate Limits**:
```typescript
Authentication endpoints (/api/auth/signin, /api/auth/signup):
  - 5 requests per 15 minutes per IP
  - Prevents brute force attacks

Admin endpoints (/api/admin/*):
  - 60 requests per minute per IP
  - Protects sensitive admin operations

API endpoints (/api/*):
  - 100 requests per minute per IP
  - General API protection
```

**Response Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `Retry-After`: Seconds until reset

**Note**: Currently uses in-memory storage. For production with multiple servers, replace with Redis:
```typescript
// In /lib/security/middleware.ts
// Replace rateLimitStore Map with Redis client
```

### ✅ 4. Origin Validation (CSRF Protection)
**Status**: Fully implemented
**Location**: `/middleware.ts` + `/lib/security/middleware.ts`

**Protection**:
- Validates `Origin` header matches `Host` header
- Applied to: POST, PUT, PATCH, DELETE requests
- Exceptions: Webhook endpoints (external services)
- Prevents Cross-Site Request Forgery attacks

### ✅ 5. Input Validation
**Status**: Comprehensive Zod schemas created
**Location**: `/lib/security/validation.ts`

**Schemas Available**:
- `emailSchema` - Email validation with format checking
- `passwordSchema` - Strong password requirements (8+ chars, mixed case, numbers)
- `nameSchema` - Name validation with character restrictions
- `productCreateSchema` / `productUpdateSchema` - Product validation
- `collectionCreateSchema` / `collectionUpdateSchema` - Collection validation
- `rewardCreateSchema` / `rewardUpdateSchema` - Loyalty reward validation
- `tierUpdateSchema` - Loyalty tier configuration
- `addressSchema` - Shipping/billing address validation
- `orderCreateSchema` - Order creation validation
- `cartItemSchema` - Cart item validation
- `dropNotificationSchema` - Drop notification signup
- `paginationSchema` - Query parameter validation
- `sortSchema` - Sorting parameter validation
- `productFilterSchema` - Filter parameter validation

**Helper Functions**:
```typescript
validateData<T>(schema, data)  // Throws on validation error
safeValidate<T>(schema, data)  // Returns { success, data/error }
```

**Usage Example**:
```typescript
import { productCreateSchema, validateData } from '@/lib/security/validation'

// In API route
const validatedData = validateData(productCreateSchema, await request.json())
// Throws user-friendly error if validation fails
```

### ✅ 6. Password Security
**Status**: Already implemented
**Location**: `/app/api/auth/*` routes

**Implementation**:
- bcryptjs with 12 rounds of hashing
- Passwords never stored in plaintext
- Email normalization (lowercase, trimmed)
- Strong password requirements enforced

### ✅ 7. Session Security
**Status**: Already implemented
**Location**: `/app/api/auth/*` routes

**Implementation**:
- HttpOnly cookies (prevents JavaScript access)
- Secure flag in production (HTTPS only)
- 7-day expiration
- Random session IDs
- Database-backed sessions (can't be forged)

### ✅ 8. Sanitization Functions
**Status**: Utility functions provided
**Location**: `/lib/security/middleware.ts`

**Functions**:
```typescript
sanitizeInput(input)      // Remove HTML tags, JS protocols, event handlers
isValidEmail(email)       // Email format validation
isValidUrl(url)           // URL format validation (http/https only)
generateSecureToken()     // Cryptographically secure random tokens
secureCompare(a, b)       // Constant-time comparison (prevents timing attacks)
```

**Note**: React/Next.js automatically escapes JSX output. Use `sanitizeInput()` only for:
- Storing user input in database
- Generating raw HTML (rare)
- API responses with unescaped content

### ✅ 9. Client IP Detection
**Status**: Implemented
**Location**: `/lib/security/middleware.ts` → `getClientIp()`

**Implementation**:
```typescript
1. Checks x-forwarded-for header (proxy support)
2. Checks x-real-ip header (alternative proxy header)
3. Falls back to direct connection IP
```

### ⚠️ 10. Security Logging
**Status**: Basic logging exists, audit logging recommended
**Current**: Console.log statements in middleware and auth routes
**Recommendation**: Add dedicated security event logging

**Events to Log** (Future Enhancement):
```typescript
- Failed login attempts (IP, timestamp, username)
- Rate limit violations (IP, endpoint, timestamp)
- Admin access (user ID, action, timestamp)
- Suspicious activity (multiple failed authentications)
- Security header violations
```

## Usage Guide

### Applying Security to New API Routes

**Template for Protected API Route**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { validateData, yourSchema } from '@/lib/security/validation'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const admin = await requireAdmin(request)
    
    // 2. Validate input
    const body = await request.json()
    const validatedData = validateData(yourSchema, body)
    
    // 3. Perform operation
    const result = await prisma.yourModel.create({
      data: validatedData,
    })
    
    // 4. Return success
    return NextResponse.json(result)
    
  } catch (error) {
    // 5. Handle errors safely (don't expose stack traces)
    console.error('API error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Adding New Validation Schemas

**Example**:
```typescript
// In /lib/security/validation.ts

export const yourModelSchema = z.object({
  field1: z.string().min(1).max(200).trim(),
  field2: z.number().positive(),
  email: emailSchema, // Reuse existing schemas
  // ... more fields
})

// Export update variant
export const yourModelUpdateSchema = yourModelSchema.partial()
```

### Adjusting Rate Limits

**Location**: `/middleware.ts`
```typescript
const RATE_LIMITS = {
  auth: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  api: { maxRequests: 100, windowMs: 60 * 1000 },
  admin: { maxRequests: 60, windowMs: 60 * 1000 },
}
```

**Increase limits** if legitimate users are being blocked.
**Decrease limits** if under attack or want stricter protection.

### Testing Security

**Test Rate Limiting**:
```bash
# Test auth endpoint (should block after 5 requests)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "\nRequest $i"
  sleep 1
done
```

**Test Origin Validation**:
```bash
# This should be rejected (wrong origin)
curl -X POST http://localhost:3000/api/products \
  -H "Origin: https://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

**Test Security Headers**:
```bash
curl -I http://localhost:3000
# Look for X-Frame-Options, X-Content-Type-Options, etc.
```

## Security Checklist

### ✅ Completed
- [x] SQL injection protection (Prisma ORM)
- [x] Security headers (CSP, X-Frame-Options, etc.)
- [x] Rate limiting (auth, admin, API)
- [x] Origin validation (CSRF protection)
- [x] Input validation schemas (comprehensive)
- [x] Password hashing (bcrypt)
- [x] Session security (httpOnly, secure cookies)
- [x] Sanitization utilities
- [x] Client IP detection

### 🔄 Recommended Future Enhancements
- [ ] Replace in-memory rate limit store with Redis (for multi-server deployments)
- [ ] Add security event audit logging
- [ ] Implement CAPTCHA for auth endpoints (optional, if bot attacks occur)
- [ ] Add file upload validation if implementing user avatars/uploads
- [ ] Set up automated security scanning (Dependabot, Snyk, etc.)
- [ ] Add Content-Security-Policy-Report-Only header for monitoring
- [ ] Implement API versioning for breaking changes
- [ ] Add request ID tracking for debugging

### 🎯 Production Deployment Checklist
- [ ] Set `NODE_ENV=production` (enables HSTS, stricter CSP)
- [ ] Configure environment variables:
  - [ ] Strong session secret
  - [ ] Cloudinary credentials
  - [ ] Stripe webhook secret
  - [ ] Database connection (production)
- [ ] Enable HTTPS (required for Stripe, secure cookies)
- [ ] Configure Redis for rate limiting (if multi-server)
- [ ] Set up error monitoring (Sentry, LogRocket, etc.)
- [ ] Configure database backups
- [ ] Review and test all security headers in production
- [ ] Run security audit: `npm audit`
- [ ] Update dependencies: `npm update`

## Common Security Issues - How We're Protected

| Vulnerability | Protection | Implementation |
|--------------|------------|----------------|
| SQL Injection | Prisma ORM | Automatic parameterization |
| XSS | React escaping + CSP | Automatic in JSX + headers |
| CSRF | Origin validation | Middleware checks |
| Brute Force | Rate limiting | 5 attempts per 15min |
| Clickjacking | X-Frame-Options | DENY header |
| MIME Sniffing | X-Content-Type | nosniff header |
| Session Hijacking | HttpOnly + Secure | Cookie flags |
| Weak Passwords | Validation + bcrypt | Zod schema + hashing |
| MITM | HTTPS + HSTS | Production headers |
| Timing Attacks | Constant-time compare | secureCompare() function |

## Security Resources

**Official Docs**:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance)

**Tools**:
- [SecurityHeaders.com](https://securityheaders.com) - Test your headers
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Test HTTPS configuration
- [Mozilla Observatory](https://observatory.mozilla.org/) - Comprehensive security scan

## Emergency Response

**If you suspect a security breach**:
1. Immediately rotate all secrets (database, API keys, session secrets)
2. Review access logs for suspicious activity
3. Force logout all users (delete all sessions from database)
4. Apply emergency rate limits (reduce to 1-2 requests per minute)
5. Enable maintenance mode if needed
6. Contact security professionals if customer data may be compromised

**Emergency rate limit** (in `/middleware.ts`):
```typescript
const RATE_LIMITS = {
  auth: { maxRequests: 1, windowMs: 60 * 1000 },  // 1 per minute
  api: { maxRequests: 10, windowMs: 60 * 1000 },  // 10 per minute
  admin: { maxRequests: 5, windowMs: 60 * 1000 }, // 5 per minute
}
```

---

**Last Updated**: 2024
**Security Level**: Production-Ready
**Next Review**: Quarterly security audit recommended
