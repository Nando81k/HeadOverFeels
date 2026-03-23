-- Add QUEUED status for newsletter campaign dispatch queueing
ALTER TYPE "NewsletterCampaignStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
