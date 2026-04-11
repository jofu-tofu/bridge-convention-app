/**
 * Entitlements — resolves what the current user can access based on subscription tier.
 *
 * Free tier: learn all conventions, practice one free bundle.
 * Premium tier: practice all bundles, full configuration.
 * Expired / not logged in: same as free.
 */

import { SubscriptionTier } from "../service";
import type { AuthUser } from "../service";

/** The one bundle free-tier users can practice without paying. */
const FREE_PRACTICE_BUNDLE = "nt-bundle";

function effectiveTier(user: AuthUser | null): SubscriptionTier {
  if (!user?.subscription) return SubscriptionTier.Free;
  if (user.subscription === SubscriptionTier.Expired) return SubscriptionTier.Free;
  return user.subscription;
}

export function canPractice(user: AuthUser | null, bundleId: string): boolean {
  const tier = effectiveTier(user);
  if (tier === SubscriptionTier.Premium) return true;
  return bundleId === FREE_PRACTICE_BUNDLE;
}

export function isPremium(user: AuthUser | null): boolean {
  return effectiveTier(user) === SubscriptionTier.Premium;
}
