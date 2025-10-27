# Product Reviews & Ratings System - Complete Implementation

## Overview

The Product Reviews & Ratings System is a comprehensive customer feedback solution that allows customers to rate and review products, with admin moderation capabilities. This system enhances trust, provides social proof, and helps customers make informed purchasing decisions.

### Key Features

- ⭐ **5-Star Rating System** - Intuitive star-based ratings with hover effects
- ✅ **Verified Purchase Badges** - Automatically marks reviews from confirmed buyers
- 📊 **Rating Statistics** - Average ratings with distribution visualization
- 🔍 **Review Filtering** - Sort by newest, oldest, highest rated, most helpful
- 👨‍💼 **Admin Moderation** - Approve, reject, flag, or delete reviews
- 💬 **Rich Review Content** - Titles, comments, customer info, optional images
- 🎨 **Responsive Design** - Beautiful UI that works on all devices
- 🚀 **Real-time Updates** - Reviews refresh immediately after actions

## Architecture

### Database Schema

```prisma
model Review {
  id        String   @id @default(cuid())
  
  // Product reference
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  // Customer reference (optional for guest reviews)
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  
  // Order reference (for verified purchases)
  orderId    String?
  order      Order?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  
  // Review content
  rating     Int      // 1-5 stars
  title      String?
  comment    String
  images     String?  // JSON array of image URLs
  
  // Customer info (for guest reviews)
  customerName  String
  customerEmail String
  
  // Status
  status        ReviewStatus @default(PENDING)
  isVerified    Boolean      @default(false) // Verified purchase
  
  // Moderation
  moderatedBy   String?      // Admin user ID
  moderatedAt   DateTime?
  rejectionReason String?
  
  // Helpful votes
  helpfulCount     Int @default(0)
  notHelpfulCount  Int @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([productId, status])
  @@index([customerId])
  @@map("reviews")
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
  FLAGGED
}
```

### Key Design Decisions

1. **Pending by Default**: All reviews start as `PENDING` to prevent spam and maintain quality
2. **Verified Purchases**: Automatically detected by checking if customer has ordered the product
3. **Guest Reviews**: Supported with manual name/email fields (no account required)
4. **Soft Moderation**: Reviews can be approved, rejected, or flagged without deletion
5. **Helpful Votes**: Track review helpfulness (UI implemented, backend TODO)

## API Reference

### POST /api/reviews

Submit a new review for a product.

**Request Body**:
```json
{
  "productId": "clxxx...",
  "rating": 5,
  "title": "Amazing quality!", // optional
  "comment": "This hoodie is incredible. The fit is perfect...",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerId": "clxxx...", // optional, for logged-in users
  "orderId": "clxxx...", // optional, for order-specific reviews
  "images": ["url1", "url2"] // optional
}
```

**Response** (201):
```json
{
  "data": {
    "id": "clxxx...",
    "productId": "clxxx...",
    "rating": 5,
    "title": "Amazing quality!",
    "comment": "This hoodie is incredible...",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "isVerified": true,
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Review submitted successfully. It will be published after moderation."
}
```

**Validation**:
- `rating` must be 1-5
- `comment` is required
- `customerName` and `customerEmail` are required
- Verified purchase checked if `orderId` or `customerId` provided

### GET /api/products/[id]/reviews

Get approved reviews for a specific product (customer-facing).

**Query Parameters**:
- `page` (default: 1) - Page number
- `limit` (default: 10) - Results per page
- `sortBy` (default: 'newest') - Options: newest, oldest, highest, lowest, helpful
- `verified` (optional) - Set to 'true' to filter verified purchases only

**Response** (200):
```json
{
  "data": [
    {
      "id": "clxxx...",
      "rating": 5,
      "title": "Amazing quality!",
      "comment": "This hoodie is incredible...",
      "images": "[\"url1\", \"url2\"]",
      "customerName": "John Doe",
      "isVerified": true,
      "helpfulCount": 12,
      "notHelpfulCount": 1,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "stats": {
    "averageRating": 4.5,
    "totalReviews": 28,
    "distribution": {
      "5": 18,
      "4": 6,
      "3": 2,
      "2": 1,
      "1": 1
    }
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalCount": 28,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### GET /api/reviews

List all reviews (admin only, includes all statuses).

**Query Parameters**:
- `page` (default: 1) - Page number
- `limit` (default: 20) - Results per page
- `status` (optional) - Filter by: PENDING, APPROVED, REJECTED, FLAGGED
- `productId` (optional) - Filter by specific product
- `sortBy` (default: 'newest') - Options: newest, oldest, highest, lowest

**Response** (200):
```json
{
  "data": [...],
  "pagination": {...}
}
```

### PATCH /api/reviews/[id]

Update a review (admin moderation).

**Request Body**:
```json
{
  "status": "APPROVED", // PENDING, APPROVED, REJECTED, FLAGGED
  "rejectionReason": "Inappropriate content", // optional, for REJECTED
  "moderatedBy": "admin_user_id" // optional
}
```

**Response** (200):
```json
{
  "data": {...},
  "message": "Review updated successfully"
}
```

### DELETE /api/reviews/[id]

Permanently delete a review (admin only).

**Response** (200):
```json
{
  "message": "Review deleted successfully"
}
```

## Component Reference

### ReviewForm

Customer-facing form for submitting reviews.

**Props**:
```typescript
interface ReviewFormProps {
  productId: string        // Required: Product to review
  productName: string      // Required: For UX messaging
  customerId?: string      // Optional: Logged-in user ID
  orderId?: string         // Optional: Order ID for verification
  onSuccess?: () => void   // Optional: Callback after submission
}
```

**Usage**:
```tsx
import ReviewForm from '@/components/products/ReviewForm'

<ReviewForm 
  productId={product.id}
  productName={product.name}
  onSuccess={() => loadReviews(product.id)}
/>
```

**Features**:
- Interactive 5-star rating selector with hover effects
- Optional title field (100 chars max)
- Comment textarea with character counter (1000 chars max)
- Name and email inputs with validation
- Success/error messaging
- Loading states during submission

### ReviewList & ReviewCard

Display approved reviews with filtering and pagination.

**Props**:
```typescript
interface ReviewListProps {
  productId: string                    // Required
  initialReviews?: Review[]            // Optional: SSR data
  initialStats?: {                     // Optional: SSR stats
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  }
}
```

**Usage**:
```tsx
import { ReviewList } from '@/components/products/ReviewList'

<ReviewList 
  productId={product.id}
  initialReviews={reviews}
  initialStats={stats}
/>
```

**Features**:
- Star rating visualization
- Verified purchase badges
- Read more/less for long comments
- Review images (if provided)
- Helpful votes UI (thumbs up/down)
- Sort dropdown: newest, oldest, highest, lowest, most helpful
- Verified purchases filter checkbox
- Load more pagination

### ProductRating

Overall product rating summary with statistics.

**Props**:
```typescript
interface ProductRatingProps {
  stats: {
    averageRating: number
    totalReviews: number
    distribution: Record<number, number>
  }
}
```

**Usage**:
```tsx
import ProductRating from '@/components/products/ProductRating'

{reviewStats && (
  <ProductRating stats={reviewStats} />
)}
```

**Features**:
- Large average rating display (e.g., "4.5 out of 5")
- Half-star visualization
- Total review count
- Rating distribution bars with percentages
- Responsive grid layout

## Admin Guide

### Accessing Review Moderation

1. Go to `/admin` dashboard
2. Click "Moderate Reviews" or "Pending Reviews"
3. Or navigate directly to `/admin/reviews`

### Review Statuses

- **PENDING** - Newly submitted, awaiting moderation (default)
- **APPROVED** - Visible to customers on product pages
- **REJECTED** - Hidden from customers, marked as inappropriate
- **FLAGGED** - Needs attention, review manually

### Moderation Actions

**Approve**: Makes review visible on product page
```
Status: PENDING → APPROVED
```

**Reject**: Hides review with optional reason
```
Status: PENDING → REJECTED
Prompt for rejection reason (e.g., "Spam", "Inappropriate language")
```

**Flag**: Marks for manual review
```
Status: * → FLAGGED
Use for reviews that need further investigation
```

**Unapprove**: Removes from public view
```
Status: APPROVED → PENDING
```

**Delete**: Permanently removes review
```
Confirmation required: "Are you sure?"
Cannot be undone
```

### Filtering Reviews

- **All Reviews**: Shows all statuses
- **Pending**: Only reviews awaiting moderation
- **Approved**: Only public reviews
- **Rejected**: Only rejected reviews
- **Flagged**: Only flagged reviews

### Best Practices

1. **Review Pending Daily**: Check pending reviews at least once per day
2. **Provide Reasons**: Always add rejection reasons for transparency
3. **Flag, Don't Delete**: Use flagging for questionable reviews instead of deletion
4. **Verified Matters**: Prioritize verified purchase reviews
5. **Response Time**: Aim to moderate within 24 hours

## Integration Examples

### Product Detail Page

```tsx
// /app/products/[slug]/page.tsx
import ProductRating from '@/components/products/ProductRating'
import { ReviewList } from '@/components/products/ReviewList'
import ReviewForm from '@/components/products/ReviewForm'

export default function ProductPage() {
  const [reviewStats, setReviewStats] = useState(null)
  const [reviews, setReviews] = useState([])
  
  const loadReviews = async (productId: string) => {
    const response = await fetch(`/api/products/${productId}/reviews?page=1&limit=10`)
    const data = await response.json()
    setReviewStats(data.stats)
    setReviews(data.data)
  }
  
  return (
    <div>
      {/* Product details... */}
      
      {/* Reviews Section */}
      {product && (
        <div className="mt-16 space-y-8">
          {reviewStats && <ProductRating stats={reviewStats} />}
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-6">Customer Reviews</h3>
            <ReviewList 
              productId={product.id}
              initialReviews={reviews}
              initialStats={reviewStats}
            />
          </div>
          
          <ReviewForm 
            productId={product.id}
            productName={product.name}
            onSuccess={() => loadReviews(product.id)}
          />
        </div>
      )}
    </div>
  )
}
```

### Admin Dashboard Integration

```tsx
// /app/admin/page.tsx
<Link href="/admin/reviews">
  <button>Moderate Reviews</button>
</Link>

<Link href="/admin/reviews?status=PENDING">
  <button>Pending Reviews ({pendingCount})</button>
</Link>
```

## Testing Guide

### 1. Submit a Review

```bash
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "YOUR_PRODUCT_ID",
    "rating": 5,
    "title": "Test Review",
    "comment": "This is a test review for the product.",
    "customerName": "Test User",
    "customerEmail": "test@example.com"
  }'
```

### 2. Fetch Product Reviews

```bash
curl "http://localhost:3000/api/products/YOUR_PRODUCT_ID/reviews?page=1&limit=10"
```

### 3. Moderate a Review

```bash
curl -X PATCH http://localhost:3000/api/reviews/REVIEW_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "moderatedBy": "admin"
  }'
```

### 4. Delete a Review

```bash
curl -X DELETE http://localhost:3000/api/reviews/REVIEW_ID
```

### Manual Testing Checklist

- [ ] Submit review with all required fields
- [ ] Submit review without rating (should fail)
- [ ] Submit review without comment (should fail)
- [ ] Submit review without name/email (should fail)
- [ ] View reviews on product page (only APPROVED shown)
- [ ] Sort reviews by newest/oldest/highest/lowest
- [ ] Filter by verified purchases only
- [ ] Load more reviews (pagination)
- [ ] Admin: Approve pending review
- [ ] Admin: Reject review with reason
- [ ] Admin: Flag review
- [ ] Admin: Delete review
- [ ] Admin: Filter by status
- [ ] Verify purchase badge appears for order-linked reviews

## Customization

### Change Review Character Limits

```tsx
// /components/products/ReviewForm.tsx
<input
  maxLength={100} // Change title limit
/>

<textarea
  maxLength={1000} // Change comment limit
/>
```

### Add Auto-Approval

To skip moderation for verified purchases:

```ts
// /app/api/reviews/route.ts (POST handler)
const review = await prisma.review.create({
  data: {
    // ...
    status: isVerified ? 'APPROVED' : 'PENDING' // Auto-approve verified
  }
})
```

### Customize Rating Descriptions

```tsx
// /components/products/ReviewForm.tsx
{rating === 1 && 'Poor'}           // Change labels
{rating === 2 && 'Fair'}
{rating === 3 && 'Good'}
{rating === 4 && 'Very Good'}
{rating === 5 && 'Excellent'}
```

### Add Email Notifications

Notify customers when reviews are approved/rejected:

```ts
// /app/api/reviews/[id]/route.ts (PATCH handler)
import { sendReviewStatusEmail } from '@/lib/email/resend'

if (status === 'APPROVED') {
  await sendReviewStatusEmail(existingReview.customerEmail, {
    status: 'approved',
    reviewId: id
  })
}
```

### Enable Image Uploads

1. Add file upload to ReviewForm
2. Upload to Cloudinary via `/api/upload`
3. Store URLs in `images` JSON field

```tsx
// ReviewForm.tsx
const handleImageUpload = async (files: FileList) => {
  const formData = new FormData()
  Array.from(files).forEach(file => formData.append('files', file))
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
  
  const { urls } = await response.json()
  setImages(urls)
}
```

## Future Enhancements

### Priority 1 (Recommended)

- **Helpful Votes Backend**: Implement voting API to track helpful/not helpful
- **Review Replies**: Allow admins to respond to reviews publicly
- **Photo Reviews**: Add image upload support with preview
- **Review Rewards**: Give points/discounts for verified reviews
- **Spam Detection**: Integrate Akismet or similar for auto-flagging

### Priority 2 (Nice to Have)

- **Review Sorting by Helpful**: Backend support for sorting by votes
- **Review Pagination Improvement**: Infinite scroll instead of "Load More"
- **Email Notifications**: Notify customers when reviews are moderated
- **Review Analytics**: Dashboard with review trends and insights
- **Multi-language Reviews**: Support multiple languages with translation

### Priority 3 (Advanced)

- **Video Reviews**: Allow video uploads
- **Q&A Section**: Customer questions about products
- **Review Verification**: Send verification emails before publishing
- **AI Moderation**: Auto-flag inappropriate content using AI
- **Review Syndication**: Share reviews to social media

## Troubleshooting

### Reviews Not Showing on Product Page

**Issue**: Reviews don't appear after submission

**Solutions**:
1. Check review status: `SELECT * FROM reviews WHERE productId = 'xxx'`
2. Ensure status is `APPROVED` (only approved reviews show)
3. Verify API endpoint returns data: `/api/products/[id]/reviews`
4. Check browser console for fetch errors

### Review Stats Not Calculating

**Issue**: Average rating shows 0 or NaN

**Solutions**:
1. Ensure at least one APPROVED review exists
2. Check `stats.totalReviews > 0` before displaying
3. Verify `groupBy` query returns data
4. Check for division by zero in calculations

### Admin Actions Not Working

**Issue**: Approve/Reject buttons don't update status

**Solutions**:
1. Check network tab for 400/500 errors
2. Verify review ID is correct
3. Ensure `moderatedBy` field is set
4. Check Prisma client is regenerated after schema changes

### Prisma Client Errors

**Issue**: `Property 'review' does not exist on type 'PrismaClient'`

**Solutions**:
```bash
npx prisma generate  # Regenerate client
npx prisma migrate dev  # Apply migrations
```

## Support & Maintenance

### Database Maintenance

```sql
-- Count reviews by status
SELECT status, COUNT(*) FROM reviews GROUP BY status;

-- Find oldest pending reviews
SELECT * FROM reviews 
WHERE status = 'PENDING' 
ORDER BY createdAt ASC 
LIMIT 10;

-- Average rating per product
SELECT productId, AVG(rating) as avgRating, COUNT(*) as total
FROM reviews 
WHERE status = 'APPROVED'
GROUP BY productId;
```

### Performance Optimization

1. **Indexing**: Already indexed on `[productId, status]` and `[customerId]`
2. **Pagination**: Always use `limit` to prevent large queries
3. **Caching**: Consider caching review stats for popular products
4. **Lazy Loading**: Load reviews only when scrolling to section

---

## Summary

The Product Reviews & Ratings System is fully functional with:

✅ **Complete Database Schema** - Review model with all relationships
✅ **5 API Endpoints** - Submit, list, fetch by product, moderate, delete
✅ **3 React Components** - ReviewForm, ReviewList, ProductRating
✅ **Admin Interface** - Full moderation dashboard at `/admin/reviews`
✅ **Product Page Integration** - Reviews display on all product pages
✅ **Comprehensive Documentation** - This guide with examples and troubleshooting

The system is production-ready for Phase 5 completion. All reviews require moderation by default, verified purchases are auto-detected, and the UI is fully responsive with professional styling.
