import { useNavigation } from "react-router";
import { Link } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/forgot-password";
import { AuthForm, InputField } from "~/components/AuthForm";
import { db } from "~/db";
import { users, passwordResetTokens } from "~/db/schema";
import { sendPasswordResetEmail, generateToken } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  // Check if user exists
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Always show success message to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  // Check if user uses OAuth only
  if (!user.passwordHash) {
    return { success: true };
  }

  // Delete any existing reset tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  // Create new reset token
  const token = generateToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expires,
  });

  // Send reset email
  await sendPasswordResetEmail(email, token);

  return { success: true };
}

export default function ForgotPasswordPage({
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-success-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Check your email
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            If an account exists with that email, we&apos;ve sent you a link to
            reset your password. The link will expire in 1 hour.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-primary-500 hover:text-primary-600 font-medium"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
      error={actionData?.error}
      submitLabel="Send reset link"
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
      <InputField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
    </AuthForm>
  );
}
