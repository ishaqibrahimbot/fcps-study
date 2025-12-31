import type { User, Paper } from "~/db/schema";

/**
 * Check if a user can access a specific paper based on their subscription status
 * and the paper's access tier.
 *
 * Access rules:
 * - Subscribed users can access all papers (free and premium)
 * - Free users can only access papers marked as "free"
 */
export function canAccessPaper(
  user: { subscriptionStatus: "free" | "subscribed" },
  paper: { accessTier: "free" | "premium" }
): boolean {
  // Subscribed users have access to everything
  if (user.subscriptionStatus === "subscribed") {
    return true;
  }

  // Free users can only access free papers
  return paper.accessTier === "free";
}

/**
 * Filter papers to only include those the user can access
 */
export function filterAccessiblePapers<
  T extends { accessTier: "free" | "premium" },
>(user: { subscriptionStatus: "free" | "subscribed" }, papers: T[]): T[] {
  if (user.subscriptionStatus === "subscribed") {
    return papers;
  }
  return papers.filter((paper) => paper.accessTier === "free");
}

/**
 * Get a display label for the subscription status
 */
export function getSubscriptionLabel(status: "free" | "subscribed"): string {
  return status === "subscribed" ? "Premium" : "Free";
}

/**
 * Check if a paper is premium (locked for free users)
 */
export function isPremiumPaper(paper: {
  accessTier: "free" | "premium";
}): boolean {
  return paper.accessTier === "premium";
}
