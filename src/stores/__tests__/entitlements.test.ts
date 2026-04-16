import { describe, expect, it } from "vitest";
import { SubscriptionTier, type AuthUser } from "../../service";
import { canPractice, isPaid } from "../entitlements";

function makeUser(subscription_tier: SubscriptionTier): AuthUser {
  return {
    id: "user-1",
    display_name: "Test User",
    email: "test@example.com",
    avatar_url: null,
    created_at: "2026-04-12T00:00:00.000Z",
    updated_at: "2026-04-12T00:00:00.000Z",
    subscription_tier,
    subscription_current_period_end: null,
  };
}

describe("entitlements", () => {
  it("allows anonymous users to practice only free bundles", () => {
    expect(canPractice(null, "nt-bundle")).toBe(true);
    expect(canPractice(null, "jacoby-transfers-bundle")).toBe(true);
    expect(canPractice(null, "bergen-bundle")).toBe(false);
    expect(isPaid(null)).toBe(false);
  });

  it("allows free users to practice only free bundles", () => {
    const user = makeUser(SubscriptionTier.Free);

    expect(canPractice(user, "nt-bundle")).toBe(true);
    expect(canPractice(user, "jacoby-transfers-bundle")).toBe(true);
    expect(canPractice(user, "bergen-bundle")).toBe(false);
    expect(isPaid(user)).toBe(false);
  });

  it("allows paid users to practice every bundle", () => {
    const user = makeUser(SubscriptionTier.Paid);

    expect(canPractice(user, "nt-bundle")).toBe(true);
    expect(canPractice(user, "jacoby-transfers-bundle")).toBe(true);
    expect(isPaid(user)).toBe(true);
  });

  it("treats expired users like free users", () => {
    const user = makeUser(SubscriptionTier.Expired);

    expect(canPractice(user, "nt-bundle")).toBe(true);
    expect(canPractice(user, "jacoby-transfers-bundle")).toBe(true);
    expect(canPractice(user, "bergen-bundle")).toBe(false);
    expect(isPaid(user)).toBe(false);
  });

  it("honors legacy single-module NT bundle ids", () => {
    expect(canPractice(null, "nt-stayman")).toBe(true);
    expect(canPractice(null, "nt-transfers")).toBe(true);
  });
});
