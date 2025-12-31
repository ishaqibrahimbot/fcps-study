import { redirect, useNavigation, useSearchParams } from "react-router";
import { Link } from "react-router";
import type { Route } from "./+types/login";
import { AuthForm, InputField } from "~/components/AuthForm";
import {
  getSession,
  authenticateUser,
  createSessionCookie,
} from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  // If already logged in, redirect to dashboard
  const session = await getSession(request);
  if (session?.userId) {
    return redirect("/dashboard");
  }

  // Google OAuth is not currently implemented for React Router
  // To enable it, you would need to implement a custom OAuth flow
  const showGoogleButton = false;

  return { showGoogleButton };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const result = await authenticateUser(email, password);

  if ("error" in result) {
    return { error: result.error };
  }

  // Set the session cookie and redirect
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": createSessionCookie(result.token),
    },
  });
}

export default function LoginPage({
  actionData,
  loaderData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const registered = searchParams.get("registered");
  const verified = searchParams.get("verified");
  const reset = searchParams.get("reset");

  const isSubmitting = navigation.state === "submitting";

  let successMessage: string | null = null;
  if (registered) {
    successMessage =
      "Account created! Please check your email to verify your account.";
  } else if (verified) {
    successMessage = "Email verified! You can now log in.";
  } else if (reset) {
    successMessage =
      "Password reset! You can now log in with your new password.";
  }

  const showGoogle = loaderData?.showGoogleButton ?? false;

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to your account to continue"
      error={actionData?.error}
      success={successMessage}
      submitLabel="Sign in"
      isSubmitting={isSubmitting}
      showGoogleButton={showGoogle}
      googleRedirectTo={redirectTo}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            to={`/signup${redirectTo !== "/" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-primary-500 hover:text-primary-600 font-medium"
          >
            Sign up
          </Link>
        </>
      }
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
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
        autoComplete="current-password"
      />
      <div className="flex items-center justify-end">
        <Link
          to="/forgot-password"
          className="text-sm text-primary-500 hover:text-primary-600"
        >
          Forgot password?
        </Link>
      </div>
    </AuthForm>
  );
}
