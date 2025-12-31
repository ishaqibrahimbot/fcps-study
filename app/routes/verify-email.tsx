import { redirect } from "react-router";
import { Link } from "react-router";
import { eq, and, gt } from "drizzle-orm";
import type { Route } from "./+types/verify-email";
import { db } from "~/db";
import { users, verificationTokens } from "~/db/schema";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return { error: "Missing verification parameters" };
  }

  // Find the token
  const verificationToken = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.identifier, email),
      eq(verificationTokens.token, token),
      gt(verificationTokens.expires, new Date())
    ),
  });

  if (!verificationToken) {
    return { error: "Invalid or expired verification link" };
  }

  // Mark email as verified
  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email));

  // Delete the token
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, token)
      )
    );

  return redirect("/login?verified=true");
}

export default function VerifyEmailPage({ loaderData }: Route.ComponentProps) {
  // This component only renders if there's an error
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-error-100 dark:bg-error-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-error-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Verification Failed
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          {loaderData?.error ||
            "This verification link is invalid or has expired."}
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
}
