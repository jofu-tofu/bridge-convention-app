export type BillingPlan = "monthly" | "annual";

export interface DataPortBilling {
  startCheckout(plan: BillingPlan): Promise<{ url: string }>;
  openBillingPortal(): Promise<{ url: string }>;
  fetchConventionDefinition(bundleId: string): Promise<unknown>;
}

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class SubscriptionRequiredError extends Error {
  constructor(message = "Subscription required") {
    super(message);
    this.name = "SubscriptionRequiredError";
  }
}
