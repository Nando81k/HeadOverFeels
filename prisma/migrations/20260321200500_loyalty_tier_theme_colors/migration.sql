ALTER TABLE "loyalty_tiers"
ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#64748B',
ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#475569';

UPDATE "loyalty_tiers"
SET
  "primaryColor" = CASE
    WHEN LOWER("slug") = 'newcomer' THEN '#94A3B8'
    WHEN LOWER("slug") = 'friend' THEN '#2563EB'
    WHEN LOWER("slug") = 'bestie' THEN '#EC4899'
    WHEN LOWER("slug") = 'soulmate' THEN '#8B5CF6'
    WHEN LOWER("slug") = 'head' THEN '#94A3B8'
    WHEN LOWER("slug") = 'heart' THEN '#EC4899'
    WHEN LOWER("slug") = 'mind' THEN '#2563EB'
    ELSE "primaryColor"
  END,
  "secondaryColor" = CASE
    WHEN LOWER("slug") = 'newcomer' THEN '#475569'
    WHEN LOWER("slug") = 'friend' THEN '#3730A3'
    WHEN LOWER("slug") = 'bestie' THEN '#BE185D'
    WHEN LOWER("slug") = 'soulmate' THEN '#6D28D9'
    WHEN LOWER("slug") = 'head' THEN '#475569'
    WHEN LOWER("slug") = 'heart' THEN '#BE185D'
    WHEN LOWER("slug") = 'mind' THEN '#3730A3'
    ELSE "secondaryColor"
  END;
