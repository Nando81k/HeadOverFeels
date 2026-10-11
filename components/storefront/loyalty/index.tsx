/**
 * Care Points hub parts (Phase 4, Task 6). The route renders `LoyaltyHub`;
 * the rest is exported for tests and for the account overview card.
 */
export { CopyButton, type CopyButtonProps } from './CopyButton'
export { EarnGrid, EARN_RULES, type EarnGridProps } from './EarnGrid'
export {
  formatDate,
  formatDollars,
  formatMultiplier,
  formatPoints,
  formatSignedPoints,
  LOYALTY_ANCHORS,
  LOYALTY_SIGN_IN_HREF,
  type LoyaltyAnchor,
} from './format'
export { LedgerTable, type LedgerAction, type LedgerTableProps } from './LedgerTable'
export { LoyaltyHub, regateRewards, type LoyaltyHubProps } from './LoyaltyHub'
export {
  AccountsUnavailableNote,
  ACCOUNTS_UNAVAILABLE_COPY,
  LoyaltyGate,
  LoyaltySignedOutHero,
  SIGNED_OUT_HEADLINE,
  type LoyaltyGateProps,
  type LoyaltySignedOutHeroProps,
} from './LoyaltySignedOut'
export { PointsHero, heroCopy, type PointsHeroProps } from './PointsHero'
export { RedeemDialog, type RedeemAction, type RedeemDialogProps, type RedeemOutcome } from './RedeemDialog'
export { ReferralCard, shareLinks, type ReferralCardProps } from './ReferralCard'
export { RewardCard, lockedLabel, type RewardCardMode, type RewardCardProps } from './RewardCard'
export { RewardGrid, RedeemedBanner, type RedeemedCode, type RewardGridProps } from './RewardGrid'
export { TierProgress, type TierProgressProps } from './TierProgress'
export { TierTable, type TierRowView, type TierTableProps } from './TierTable'
