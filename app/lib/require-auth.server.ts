import { redirect } from "react-router";
import { eq } from "drizzle-orm";
import { getSession } from "./auth.server";
import { db } from "~/db";
import { users } from "~/db/schema";

export type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  subscriptionStatus: "free" | "subscribed";
};

/**
 * Require authentication for a route.
 * Returns the authenticated user with subscription status or redirects to login.
 */
export async function requireAuth(
  request: Request
): Promise<AuthenticatedUser> {
  const session = await getSession(request);

  if (!session?.userId || !session?.email) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  // Fetch subscription status from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      subscriptionStatus: true,
    },
  });

  return {
    id: session.userId,
    name: session.name ?? null,
    email: session.email,
    image: session.image ?? null,
    subscriptionStatus: user?.subscriptionStatus ?? "free",
  };
}

/**
 * Get the current user if authenticated, or null if not.
 * Does not redirect - useful for pages that work both authenticated and not.
 */
export async function getOptionalUser(
  request: Request
): Promise<AuthenticatedUser | null> {
  const session = await getSession(request);

  if (!session?.userId || !session?.email) {
    return null;
  }

  // Fetch subscription status from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      subscriptionStatus: true,
    },
  });

  return {
    id: session.userId,
    name: session.name ?? null,
    email: session.email,
    image: session.image ?? null,
    subscriptionStatus: user?.subscriptionStatus ?? "free",
  };
}
