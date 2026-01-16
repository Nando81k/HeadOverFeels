-- CreateEnum
CREATE TYPE "BackInStockStatus" AS ENUM ('PENDING', 'NOTIFIED', 'PURCHASED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POINTS_EARNED', 'POINTS_EXPIRING', 'TIER_UPGRADE', 'TIER_DOWNGRADE', 'ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_REFUNDED', 'REWARD_AVAILABLE', 'REWARD_REMINDER', 'PROMO_NEW', 'DROP_REMINDER', 'DROP_LIVE', 'BIRTHDAY_BONUS', 'REFERRAL_BONUS', 'REVIEW_REQUEST', 'BACK_IN_STOCK', 'WISHLIST_SALE', 'GENERAL');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PointsTransactionType" AS ENUM ('PURCHASE', 'ACCOUNT_CREATION', 'FIRST_PURCHASE', 'REVIEW', 'SOCIAL_FOLLOW', 'SOCIAL_SHARE', 'UGC_UPLOAD', 'BIRTHDAY', 'REFERRAL_GIVE', 'REFERRAL_RECEIVE', 'ADMIN_ADJUSTMENT', 'TIER_BONUS', 'REDEMPTION', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('DISCOUNT', 'FREE_SHIPPING', 'EARLY_ACCESS', 'EXCLUSIVE_PRODUCT', 'CHARITY_DONATION', 'DIGITAL_CONTENT', 'PHYSICAL_PERK');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'USED', 'EXPIRED', 'CANCELLED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('SIMILAR', 'FREQUENTLY_BOUGHT_TOGETHER', 'COMPLEMENTARY', 'ALSO_VIEWED', 'TRENDING', 'PERSONALIZED', 'BEST_SELLERS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'VIEW', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'REFUND', 'RESTOCK', 'ASSIGN', 'APPROVE', 'REJECT', 'BULK_UPDATE');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('ORDER', 'PRODUCT', 'INVENTORY', 'CUSTOMER', 'SUPPORT_TICKET', 'REFUND', 'PROMOTION', 'DROP', 'COLLECTION', 'SETTINGS', 'AUTHENTICATION', 'LOYALTY', 'FINANCIAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('REFUND', 'RETURN', 'EXCHANGE', 'ORDER_ISSUE', 'PRODUCT_QUESTION', 'SHIPPING_ISSUE', 'PAYMENT_ISSUE', 'GENERAL');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AvatarSlot" AS ENUM ('HAIR', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY', 'HEADWEAR', 'OUTERWEAR');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('RECORDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "TaxPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "TaxRecordStatus" AS ENUM ('DRAFT', 'CALCULATED', 'FILED', 'PAID');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BOGO', 'BUY_X_GET_Y');

-- CreateEnum
CREATE TYPE "PopupTemplate" AS ENUM ('MODAL', 'BANNER', 'SLIDE_IN', 'FULL_SCREEN', 'EMAIL_CAPTURE');

-- CreateEnum
CREATE TYPE "PopupPosition" AS ENUM ('TOP', 'BOTTOM', 'CENTER', 'BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT');

-- CreateEnum
CREATE TYPE "PopupTrigger" AS ENUM ('DELAY', 'SCROLL', 'EXIT_INTENT', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "PopupFrequency" AS ENUM ('ONCE_PER_SESSION', 'ONCE_PER_DAY', 'ONCE_EVER', 'ALWAYS');

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('ACTIVE', 'DEPLETED', 'EXPIRED', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "GiftCardTransactionType" AS ENUM ('INITIAL_LOAD', 'REDEMPTION', 'REFUND', 'ADJUSTMENT', 'EXPIRATION');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "category" "AuditCategory" NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "targetLabel" TEXT,
    "description" TEXT NOT NULL,
    "changes" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "categoryId" TEXT,
    "images" TEXT NOT NULL,
    "materials" TEXT,
    "careGuide" TEXT,
    "isLimitedEdition" BOOLEAN NOT NULL DEFAULT false,
    "releaseDate" TIMESTAMP(3),
    "dropEndDate" TIMESTAMP(3),
    "maxQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isFeaturedNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costPrice" DOUBLE PRECISION,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_products" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "colorHex" TEXT,
    "images" TEXT,
    "price" DOUBLE PRECISION,
    "inventory" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "costPrice" DOUBLE PRECISION,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "birthday" TIMESTAMP(3),
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "lastOrderDate" TIMESTAMP(3),
    "avgOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loyaltyTierId" TEXT,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "annualSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tierStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "annualPointsEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "metadata" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "inAppPointsEarned" BOOLEAN NOT NULL DEFAULT true,
    "inAppTierUpdates" BOOLEAN NOT NULL DEFAULT true,
    "inAppOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "inAppPromotions" BOOLEAN NOT NULL DEFAULT true,
    "inAppDropAlerts" BOOLEAN NOT NULL DEFAULT true,
    "inAppRewardReminders" BOOLEAN NOT NULL DEFAULT true,
    "emailPointsEarned" BOOLEAN NOT NULL DEFAULT false,
    "emailTierUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailPromotions" BOOLEAN NOT NULL DEFAULT true,
    "emailDropAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailRewardReminders" BOOLEAN NOT NULL DEFAULT true,
    "emailPointsExpiring" BOOLEAN NOT NULL DEFAULT true,
    "emailBirthdayBonus" BOOLEAN NOT NULL DEFAULT true,
    "smsOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "smsDropAlerts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "sourceDetails" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeReason" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatars" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "configuration" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL DEFAULT '#FFE0BD',
    "bodyType" TEXT NOT NULL DEFAULT 'default',
    "gender" TEXT NOT NULL DEFAULT 'male',
    "faceFeatures" TEXT NOT NULL DEFAULT '{"eyeShape":"round","noseShape":"medium","mouthShape":"smile","eyebrowShape":"normal"}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slot" "AvatarSlot" NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "productId" TEXT,
    "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatar_items" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "avatarItemId" TEXT NOT NULL,
    "unlockedVia" TEXT,
    "orderId" TEXT,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_avatar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "type" "AddressType" NOT NULL DEFAULT 'SHIPPING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shipping" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "shippingAddressId" TEXT NOT NULL,
    "billingAddressId" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "shippingMethod" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "carrier" TEXT,
    "shippedAt" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "couponCode" TEXT,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redemptionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeRefundId" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "productName" TEXT NOT NULL,
    "productImage" TEXT,
    "variantDetails" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abandoned_carts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "items" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "recoveryEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "recoveryEmailSentAt" TIMESTAMP(3),
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recoveredAt" TIMESTAMP(3),
    "recoveryOrderId" TEXT,
    "abandonedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "discountCode" TEXT,
    "discountAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drop_notifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drop_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_reservations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT NOT NULL,
    "images" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "moderatedBy" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminReply" TEXT,
    "adminReplyBy" TEXT,
    "adminReplyAt" TIMESTAMP(3),
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "source" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_recommendations" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "back_in_stock_notifications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "email" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "BackInStockStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "back_in_stock_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "programName" TEXT NOT NULL DEFAULT 'Loyalty Rewards',
    "pointsPerDollar" INTEGER NOT NULL DEFAULT 1,
    "pointsRoundingMode" TEXT NOT NULL DEFAULT 'round',
    "minimumOrderForPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referralPointsReferrer" INTEGER NOT NULL DEFAULT 100,
    "referralPointsReferred" INTEGER NOT NULL DEFAULT 50,
    "referralEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewPointsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reviewPointsAmount" INTEGER NOT NULL DEFAULT 25,
    "reviewWithPhotoBonus" INTEGER NOT NULL DEFAULT 25,
    "birthdayRewardsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "birthdayRewardType" TEXT NOT NULL DEFAULT 'points',
    "birthdayRewardValue" INTEGER NOT NULL DEFAULT 100,
    "birthdayRewardExpireDays" INTEGER NOT NULL DEFAULT 30,
    "pointsExpireEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pointsExpireMonths" INTEGER NOT NULL DEFAULT 12,
    "tierEvaluationPeriod" TEXT NOT NULL DEFAULT 'annual',
    "tierDowngradeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "showPointsInCart" BOOLEAN NOT NULL DEFAULT true,
    "showPointsInCheckout" BOOLEAN NOT NULL DEFAULT true,
    "showTierProgress" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goals" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "dailyTarget" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "weeklyTarget" DOUBLE PRECISION NOT NULL DEFAULT 3500,
    "monthlyTarget" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "quarterlyTarget" DOUBLE PRECISION NOT NULL DEFAULT 45000,
    "yearlyTarget" DOUBLE PRECISION NOT NULL DEFAULT 180000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_goal_history" (
    "id" TEXT NOT NULL,
    "salesGoalsId" TEXT NOT NULL DEFAULT 'default',
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "achieved" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "metGoal" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_goal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "minAnnualSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isInviteOnly" BOOLEAN NOT NULL DEFAULT false,
    "pointMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "earlyDropAccess" BOOLEAN NOT NULL DEFAULT false,
    "perks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "minAnnualPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" "PointsTransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "reviewId" TEXT,
    "redemptionId" TEXT,
    "referralId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_multiplier_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "tierIds" TEXT,
    "categoryIds" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalBonusPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "ordersAffected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_multiplier_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "rewardType" "RewardType" NOT NULL,
    "value" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptionsPerCustomer" INTEGER,
    "totalAvailable" INTEGER,
    "totalRedeemed" INTEGER NOT NULL DEFAULT 0,
    "minTierRequired" TEXT,
    "metadata" TEXT,
    "image" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "couponCode" TEXT,
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "type" "SupportTicketType" NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "customerId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "refundAmount" DOUBLE PRECISION,
    "refundReason" TEXT,
    "returnRequested" BOOLEAN NOT NULL DEFAULT false,
    "returnApproved" BOOLEAN,
    "returnLabel" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_chat_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "customerId" TEXT,
    "adminId" TEXT,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'WAITING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "waitTime" INTEGER,
    "duration" INTEGER,
    "preChatContext" TEXT,
    "issueCategory" TEXT,
    "issueSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_availability" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "maxChats" INTEGER NOT NULL DEFAULT 3,
    "activeChats" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "customerId" TEXT,
    "adminId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolResults" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_pending_actions" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionPayload" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "result" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "isTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "taxCategory" TEXT,
    "paymentMethod" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringFrequency" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'RECORDED',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorEmail" TEXT,
    "vendorAddress" TEXT,
    "description" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "criticalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_records" (
    "id" TEXT NOT NULL,
    "period" "TaxPeriod" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    "grossRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesTaxCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductibleExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedTaxLiability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "status" "TaxRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "documentUrls" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_snapshots" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodType" TEXT NOT NULL DEFAULT 'daily',
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCOGS" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesTaxCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inventoryValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOnHand" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromotionType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DOUBLE PRECISION NOT NULL,
    "code" TEXT,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "minimumPurchase" DOUBLE PRECISION,
    "maxUsesTotal" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "productIds" TEXT,
    "collectionIds" TEXT,
    "customerEmails" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "maxDiscountPercent" DOUBLE PRECISION,
    "excludeFromLoyalty" BOOLEAN NOT NULL DEFAULT false,
    "totalDiscountGiven" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_popups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" "PopupTemplate" NOT NULL DEFAULT 'MODAL',
    "position" "PopupPosition" NOT NULL DEFAULT 'CENTER',
    "content" TEXT NOT NULL,
    "triggerType" "PopupTrigger" NOT NULL DEFAULT 'DELAY',
    "triggerValue" INTEGER NOT NULL DEFAULT 3,
    "showOnPages" TEXT NOT NULL DEFAULT 'all',
    "showToNewVisitors" BOOLEAN NOT NULL DEFAULT true,
    "showToReturning" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "PopupFrequency" NOT NULL DEFAULT 'ONCE_PER_SESSION',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "promotionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_popups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popup_variants" (
    "id" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "popup_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "popup_analytics" (
    "id" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "variantId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "dismissals" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "popup_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialBalance" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "GiftCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "purchasedById" TEXT,
    "purchaseOrderId" TEXT,
    "recipientEmail" TEXT,
    "recipientName" TEXT,
    "senderName" TEXT,
    "personalMessage" TEXT,
    "redeemedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "type" "GiftCardTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "description" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_gift_cards" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "amountApplied" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_category_idx" ON "admin_audit_logs"("category");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "collections_name_key" ON "collections"("name");

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "collection_products_collectionId_productId_key" ON "collection_products"("collectionId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customer_notifications_customerId_isRead_idx" ON "customer_notifications"("customerId", "isRead");

-- CreateIndex
CREATE INDEX "customer_notifications_customerId_createdAt_idx" ON "customer_notifications"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_notifications_type_idx" ON "customer_notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_customerId_key" ON "notification_preferences"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_isActive_idx" ON "newsletter_subscribers"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "customer_notes_customerId_idx" ON "customer_notes"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatars_customerId_key" ON "user_avatars"("customerId");

-- CreateIndex
CREATE INDEX "avatar_items_productId_idx" ON "avatar_items"("productId");

-- CreateIndex
CREATE INDEX "user_avatar_items_customerId_idx" ON "user_avatar_items"("customerId");

-- CreateIndex
CREATE INDEX "user_avatar_items_avatarItemId_idx" ON "user_avatar_items"("avatarItemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_avatar_items_customerId_avatarItemId_key" ON "user_avatar_items"("customerId", "avatarItemId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_customerId_productId_productVariantId_key" ON "cart_items"("customerId", "productId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "abandoned_carts_recoveryOrderId_key" ON "abandoned_carts"("recoveryOrderId");

-- CreateIndex
CREATE INDEX "abandoned_carts_customerId_idx" ON "abandoned_carts"("customerId");

-- CreateIndex
CREATE INDEX "abandoned_carts_customerEmail_idx" ON "abandoned_carts"("customerEmail");

-- CreateIndex
CREATE INDEX "abandoned_carts_abandonedAt_idx" ON "abandoned_carts"("abandonedAt");

-- CreateIndex
CREATE INDEX "wishlist_items_customerId_idx" ON "wishlist_items"("customerId");

-- CreateIndex
CREATE INDEX "wishlist_items_sessionId_idx" ON "wishlist_items"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customerId_productId_productVariantId_key" ON "wishlist_items"("customerId", "productId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_sessionId_productId_productVariantId_key" ON "wishlist_items"("sessionId", "productId", "productVariantId");

-- CreateIndex
CREATE INDEX "drop_notifications_productId_notified_idx" ON "drop_notifications"("productId", "notified");

-- CreateIndex
CREATE UNIQUE INDEX "drop_notifications_email_productId_key" ON "drop_notifications"("email", "productId");

-- CreateIndex
CREATE INDEX "cart_reservations_productVariantId_isActive_expiresAt_idx" ON "cart_reservations"("productVariantId", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "cart_reservations_sessionId_idx" ON "cart_reservations"("sessionId");

-- CreateIndex
CREATE INDEX "reviews_productId_status_idx" ON "reviews"("productId", "status");

-- CreateIndex
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");

-- CreateIndex
CREATE INDEX "product_views_productId_idx" ON "product_views"("productId");

-- CreateIndex
CREATE INDEX "product_views_customerId_idx" ON "product_views"("customerId");

-- CreateIndex
CREATE INDEX "product_views_sessionId_idx" ON "product_views"("sessionId");

-- CreateIndex
CREATE INDEX "product_views_viewedAt_idx" ON "product_views"("viewedAt");

-- CreateIndex
CREATE INDEX "product_recommendations_sourceProductId_type_idx" ON "product_recommendations"("sourceProductId", "type");

-- CreateIndex
CREATE INDEX "product_recommendations_score_idx" ON "product_recommendations"("score");

-- CreateIndex
CREATE UNIQUE INDEX "product_recommendations_sourceProductId_targetProductId_typ_key" ON "product_recommendations"("sourceProductId", "targetProductId", "type");

-- CreateIndex
CREATE INDEX "back_in_stock_notifications_status_idx" ON "back_in_stock_notifications"("status");

-- CreateIndex
CREATE INDEX "back_in_stock_notifications_productId_status_idx" ON "back_in_stock_notifications"("productId", "status");

-- CreateIndex
CREATE INDEX "back_in_stock_notifications_variantId_status_idx" ON "back_in_stock_notifications"("variantId", "status");

-- CreateIndex
CREATE INDEX "back_in_stock_notifications_customerId_idx" ON "back_in_stock_notifications"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "back_in_stock_notifications_productId_variantId_email_key" ON "back_in_stock_notifications"("productId", "variantId", "email");

-- CreateIndex
CREATE INDEX "sales_goal_history_period_periodStart_idx" ON "sales_goal_history"("period", "periodStart");

-- CreateIndex
CREATE INDEX "sales_goal_history_salesGoalsId_idx" ON "sales_goal_history"("salesGoalsId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_name_key" ON "loyalty_tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_tiers_slug_key" ON "loyalty_tiers"("slug");

-- CreateIndex
CREATE INDEX "points_transactions_customerId_idx" ON "points_transactions"("customerId");

-- CreateIndex
CREATE INDEX "points_transactions_orderId_idx" ON "points_transactions"("orderId");

-- CreateIndex
CREATE INDEX "points_transactions_type_idx" ON "points_transactions"("type");

-- CreateIndex
CREATE INDEX "points_multiplier_events_startDate_endDate_idx" ON "points_multiplier_events"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "points_multiplier_events_isActive_idx" ON "points_multiplier_events"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "rewards_slug_key" ON "rewards"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_couponCode_key" ON "reward_redemptions"("couponCode");

-- CreateIndex
CREATE UNIQUE INDEX "reward_redemptions_idempotencyKey_key" ON "reward_redemptions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "reward_redemptions_customerId_idx" ON "reward_redemptions"("customerId");

-- CreateIndex
CREATE INDEX "reward_redemptions_rewardId_idx" ON "reward_redemptions"("rewardId");

-- CreateIndex
CREATE INDEX "reward_redemptions_couponCode_idx" ON "reward_redemptions"("couponCode");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_customerId_key" ON "referral_codes"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_customerId_idx" ON "support_tickets"("customerId");

-- CreateIndex
CREATE INDEX "support_tickets_orderId_idx" ON "support_tickets"("orderId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_type_idx" ON "support_tickets"("type");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_idx" ON "support_messages"("ticketId");

-- CreateIndex
CREATE INDEX "support_messages_createdAt_idx" ON "support_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "live_chat_sessions_sessionId_key" ON "live_chat_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "live_chat_sessions_ticketId_key" ON "live_chat_sessions"("ticketId");

-- CreateIndex
CREATE INDEX "live_chat_sessions_status_idx" ON "live_chat_sessions"("status");

-- CreateIndex
CREATE INDEX "live_chat_sessions_adminId_idx" ON "live_chat_sessions"("adminId");

-- CreateIndex
CREATE INDEX "live_chat_sessions_requestedAt_idx" ON "live_chat_sessions"("requestedAt");

-- CreateIndex
CREATE INDEX "live_chat_messages_sessionId_idx" ON "live_chat_messages"("sessionId");

-- CreateIndex
CREATE INDEX "live_chat_messages_createdAt_idx" ON "live_chat_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_availability_adminId_key" ON "admin_availability"("adminId");

-- CreateIndex
CREATE INDEX "ai_conversations_customerId_idx" ON "ai_conversations"("customerId");

-- CreateIndex
CREATE INDEX "ai_conversations_adminId_idx" ON "ai_conversations"("adminId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_pending_actions_conversationId_idx" ON "ai_pending_actions"("conversationId");

-- CreateIndex
CREATE INDEX "ai_pending_actions_status_idx" ON "ai_pending_actions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_slug_key" ON "expense_categories"("slug");

-- CreateIndex
CREATE INDEX "expenses_categoryId_idx" ON "expenses"("categoryId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "budgets_categoryId_idx" ON "budgets"("categoryId");

-- CreateIndex
CREATE INDEX "budgets_period_idx" ON "budgets"("period");

-- CreateIndex
CREATE INDEX "tax_records_year_idx" ON "tax_records"("year");

-- CreateIndex
CREATE INDEX "tax_records_status_idx" ON "tax_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_records_period_year_quarter_month_key" ON "tax_records"("period", "year", "quarter", "month");

-- CreateIndex
CREATE INDEX "financial_snapshots_date_idx" ON "financial_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_snapshots_date_periodType_key" ON "financial_snapshots"("date", "periodType");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_code_idx" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotions_isActive_startDate_endDate_idx" ON "promotions"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_popups_isActive_startDate_endDate_idx" ON "marketing_popups"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "marketing_popups_promotionId_idx" ON "marketing_popups"("promotionId");

-- CreateIndex
CREATE INDEX "popup_variants_popupId_idx" ON "popup_variants"("popupId");

-- CreateIndex
CREATE INDEX "popup_analytics_popupId_date_idx" ON "popup_analytics"("popupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "popup_analytics_popupId_variantId_date_key" ON "popup_analytics"("popupId", "variantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_cards_code_idx" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_cards_status_idx" ON "gift_cards"("status");

-- CreateIndex
CREATE INDEX "gift_cards_purchasedById_idx" ON "gift_cards"("purchasedById");

-- CreateIndex
CREATE INDEX "gift_cards_redeemedById_idx" ON "gift_cards"("redeemedById");

-- CreateIndex
CREATE INDEX "gift_card_transactions_giftCardId_idx" ON "gift_card_transactions"("giftCardId");

-- CreateIndex
CREATE INDEX "gift_card_transactions_orderId_idx" ON "gift_card_transactions"("orderId");

-- CreateIndex
CREATE INDEX "order_gift_cards_orderId_idx" ON "order_gift_cards"("orderId");

-- CreateIndex
CREATE INDEX "order_gift_cards_giftCardId_idx" ON "order_gift_cards"("giftCardId");

-- CreateIndex
CREATE UNIQUE INDEX "order_gift_cards_orderId_giftCardId_key" ON "order_gift_cards"("orderId", "giftCardId");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_loyaltyTierId_fkey" FOREIGN KEY ("loyaltyTierId") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_items" ADD CONSTRAINT "avatar_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatar_items" ADD CONSTRAINT "user_avatar_items_avatarItemId_fkey" FOREIGN KEY ("avatarItemId") REFERENCES "avatar_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatar_items" ADD CONSTRAINT "user_avatar_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_recoveryOrderId_fkey" FOREIGN KEY ("recoveryOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drop_notifications" ADD CONSTRAINT "drop_notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_reservations" ADD CONSTRAINT "cart_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_reservations" ADD CONSTRAINT "cart_reservations_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_recommendations" ADD CONSTRAINT "product_recommendations_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "back_in_stock_notifications" ADD CONSTRAINT "back_in_stock_notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "back_in_stock_notifications" ADD CONSTRAINT "back_in_stock_notifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "back_in_stock_notifications" ADD CONSTRAINT "back_in_stock_notifications_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_goal_history" ADD CONSTRAINT "sales_goal_history_salesGoalsId_fkey" FOREIGN KEY ("salesGoalsId") REFERENCES "sales_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "reward_redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_sessions" ADD CONSTRAINT "live_chat_sessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_sessions" ADD CONSTRAINT "live_chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_sessions" ADD CONSTRAINT "live_chat_sessions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_chat_messages" ADD CONSTRAINT "live_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_availability" ADD CONSTRAINT "admin_availability_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_popups" ADD CONSTRAINT "marketing_popups_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "popup_variants" ADD CONSTRAINT "popup_variants_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "marketing_popups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "popup_analytics" ADD CONSTRAINT "popup_analytics_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "marketing_popups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "popup_analytics" ADD CONSTRAINT "popup_analytics_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "popup_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_gift_cards" ADD CONSTRAINT "order_gift_cards_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_gift_cards" ADD CONSTRAINT "order_gift_cards_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
