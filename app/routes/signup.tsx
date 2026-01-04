import { redirect, useNavigation, useSearchParams } from "react-router";
import { Link } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/signup";
import { AuthForm, InputField } from "~/components/AuthForm";
import { hashPassword, getSession, createSessionToken, createSessionCookie } from "~/lib/auth.server";
import { db } from "~/db";
import { users, verificationTokens } from "~/db/schema";
import { sendVerificationEmail, generateToken } from "~/lib/email.server";

export async function loader({ request }: Route.LoaderArgs) {
  // If already logged in, redirect to dashboard
  const session = await getSession(request);
  if (session?.userId) {
    return redirect("/dashboard");
  }

  // Google OAuth is not currently implemented for React Router
  const showGoogleButton = false;

  return { showGoogleButton };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validation
  if (!name || !email || !password || !confirmPassword) {
    return { error: "All fields are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { error: "An account with this email already exists" };
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await db.insert(users).values({
    id: userId,
    name,
    email,
    passwordHash,
  });

  // Create verification token
  const token = generateToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(verificationTokens).values({
    identifier: email,
    token,
    expires,
  });

  // Send verification email
  const emailResult = await sendVerificationEmail(email, token);

  if (!emailResult.success) {
    console.error("Failed to send verification email:", emailResult.error);
    // Don't fail signup if email fails, user can request a new one
  }

  // Automatically log the user in by creating a session
  const sessionToken = await createSessionToken({
    userId,
    email,
    name,
    image: null,
  });

  // Redirect to dashboard with session cookie
  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": createSessionCookie(sessionToken),
    },
  });
}

export default function SignupPage({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const isSubmitting = navigation.state === "submitting";

  const showGoogle = loaderData?.showGoogleButton ?? false;

  return (
    <AuthForm
      title="Create an account"
      subtitle="Start your FCPS preparation journey"
      error={actionData?.error}
      submitLabel="Create account"
      isSubmitting={isSubmitting}
      showGoogleButton={showGoogle}
      googleRedirectTo={redirectTo}
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={`/login${redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Sign in
          </Link>
        </>
      }
    >
      <InputField
        label="Full name"
        name="name"
        placeholder="Dr. John Doe"
        required
        autoComplete="name"
      />
      <InputField
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <InputField
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
      <InputField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        required
        autoComplete="new-password"
      />
    </AuthForm>
  );
}
