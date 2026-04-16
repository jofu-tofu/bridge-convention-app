/**
 * Entitlements — resolves what the current user can access based on subscription tier.
 *
 * Free tier: learn all conventions, practice core SAYC base-system bundles.
 * Paid tier: practice all bundles, full configuration.
 * Expired / not logged in: same as free.
 */

import { SubscriptionTier } from "../service";
import type { AuthUser } from "../service";

/** Bundles free-tier users can practice without paying. Mirrors the Rust FREE_BUNDLE_IDS allowlist. */
const FREE_PRACTICE_BUNDLES: ReadonlySet<string> = new Set([
  "nt-bundle",
  "nt-stayman",
  "nt-transfers",
  "strong-2c-bundle",
  "weak-twos-bundle",
  "blackwood-bundle",
]);

function effectiveTier(user: AuthUser | null): SubscriptionTier {
  if (!user?.subscription_tier) return SubscriptionTier.Free;
  if (user.subscription_tier === SubscriptionTier.Expired) return SubscriptionTier.Free;
  return user.subscription_tier;
}

export function canPractice(user: AuthUser | null, bundleId: string): boolean {
  const tier = effectiveTier(user);
  if (tier === SubscriptionTier.Paid) return true;
  return FREE_PRACTICE_BUNDLES.has(bundleId);
}

export function isPaid(user: AuthUser | null): boolean {
  return effectiveTier(user) === SubscriptionTier.Paid;
}
