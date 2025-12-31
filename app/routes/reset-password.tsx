import { redirect, useNavigation, useSearchParams } from "react-router";
import { Link } from "react-router";
import { eq, and, gt } from "drizzle-orm";
import type { Route } from "./+types/reset-password";
import { AuthForm, InputField } from "~/components/AuthForm";
import { hashPassword } from "~/lib/auth.server";
import { db } from "~/db";
import { users, passwordResetTokens } from "~/db/schema";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { error: "Missing reset token" };
  }

  // Check if token is valid
  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expires, new Date())
    ),
  });

  if (!resetToken) {
    return { error: "Invalid or expired reset link" };
  }

  return { token };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!token) {
    return { error: "Missing reset token" };
  }

  if (!password || !confirmPassword) {
    return { error: "Both password fields are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Find and validate token
  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expires, new Date())
    ),
  });

  if (!resetToken) {
    return { error: "Invalid or expired reset link" };
  }

  // Update password
  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, resetToken.userId));

  // Delete the used token
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.id, resetToken.id));

  return redirect("/login?reset=true");
}

export default function ResetPasswordPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const isSubmitting = navigation.state === "submitting";

  // Show error if token is invalid from loader
  if (loaderData?.error) {
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
            {loaderData.error}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      title="Reset your password"
      subtitle="Enter your new password below"
      error={actionData?.error}
      submitLabel="Reset password"
      isSubmitting={isSubmitting}
      footer={
        <>
          Remember your password?{" "}
          <Link
            to="/login"
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Sign in
          </Link>
        </>
      }
    >
      <input type="hidden" name="token" value={token} />
      <InputField
        label="New password"
        name="password"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <InputField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
