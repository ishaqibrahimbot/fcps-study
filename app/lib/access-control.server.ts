/**
 * Access control for the credits-based paper unlock system.
 *
 * Access rules:
 * - Lifetime users can access all papers
 * - Free users can only access papers they've unlocked with credits
 */

/**
 * Check if a user can access a specific paper
 */
export function canAccessPaper(
  user: { subscriptionStatus: "free" | "lifetime" },
  paper: { id: number },
  unlockedPaperIds: Set<number> | number[]
): boolean {
  // Lifetime users have access to everything
  if (user.subscriptionStatus === "lifetime") {
    return true;
  }

  // Free users can only access papers they've unlocked
  const unlockedSet =
    unlockedPaperIds instanceof Set
      ? unlockedPaperIds
      : new Set(unlockedPaperIds);
  return unlockedSet.has(paper.id);
}

/**
 * Filter papers to only include those the user can access
 */
export function filterAccessiblePapers<T extends { id: number }>(
  user: { subscriptionStatus: "free" | "lifetime" },
  papers: T[],
  unlockedPaperIds: Set<number> | number[]
): T[] {
  if (user.subscriptionStatus === "lifetime") {
    return papers;
  }
  const unlockedSet =
    unlockedPaperIds instanceof Set
      ? unlockedPaperIds
      : new Set(unlockedPaperIds);
  return papers.filter((paper) => unlockedSet.has(paper.id));
}

/**
 * Get a display label for the subscription status
 */
export function getSubscriptionLabel(status: "free" | "lifetime"): string {
  return status === "lifetime" ? "Lifetime" : "Free";
}

/**
 * Check if a paper is locked for a user
 */
export function isPaperLocked(
  user: { subscriptionStatus: "free" | "lifetime" },
  paper: { id: number },
  unlockedPaperIds: Set<number> | number[]
): boolean {
  return !canAccessPaper(user, paper, unlockedPaperIds);
}
