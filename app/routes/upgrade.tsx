import { redirect, useNavigation, useActionData } from "react-router";
import { Link } from "react-router";
import type { Route } from "./+types/upgrade";
import { requireAuth } from "~/lib/require-auth.server";
import { sendUpgradeInstructionsEmail } from "~/lib/email.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);

  // If already subscribed, redirect to dashboard
  if (user.subscriptionStatus === "subscribed") {
    return redirect("/dashboard");
  }

  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);

  if (user.subscriptionStatus === "subscribed") {
    return redirect("/dashboard");
  }

  const result = await sendUpgradeInstructionsEmail(user.email, user.name);

  if (result.success) {
    return { success: true };
  } else {
    return { success: false, error: result.error };
  }
}

export function meta() {
  return [
    { title: "Upgrade to Premium - FCPS Study" },
    { name: "description", content: "Unlock all papers and features" },
  ];
}

export default function UpgradePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/25">
            <svg
              className="w-10 h-10 text-white"
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
            Check Your Email! 📬
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            We've sent payment instructions to{" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {loaderData.user.email}
            </span>
            . Follow the steps in the email to complete your upgrade.
          </p>
          <div className="space-y-3">
            <Link
              to="/dashboard"
              className="block w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl transition-colors"
            >
              Back to Dashboard
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Didn't receive the email? Check your spam folder or{" "}
              <button
                onClick={() => window.location.reload()}
                className="text-primary-500 hover:text-primary-600 font-medium"
              >
                try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-6">
            <span className="text-2xl">👑</span>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Premium Upgrade
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Unlock All Papers
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Get unlimited access to our complete library of FCPS preparation
            papers with detailed explanations.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {[
            {
              icon: "📚",
              title: "All Question Papers",
              description: "Access every paper in our library",
            },
            {
              icon: "🤖",
              title: "AI Explanations",
              description: "Detailed explanations for every question",
            },
            {
              icon: "♾️",
              title: "Unlimited Practice",
              description: "No limits on attempts or reviews",
            },
            {
              icon: "🆕",
              title: "Future Updates",
              description: "Get new papers as they're added",
            },
          ].map((benefit, index) => (
            <div
              key={index}
              className="flex items-start gap-4 bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700/50"
            >
              <span className="text-3xl">{benefit.icon}</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {benefit.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Cards */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
          {/* Yearly Plan */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Valid until
              </p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                31st July 2026
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  PKR 3,000
                </span>
              </div>
            </div>
          </div>

          {/* Lifetime Plan */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 rounded-2xl p-6 border-2 border-amber-400 dark:border-amber-600 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold rounded-full">
              BEST VALUE
            </div>
            <div className="text-center">
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-1">
                One-time payment
              </p>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-3">
                Lifetime Access
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  PKR 5,000
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                Never pay again!
              </p>
            </div>
          </div>
        </div>

        {/* CTA Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8 border border-slate-200 dark:border-slate-700 max-w-lg mx-auto">
          {actionData?.error && (
            <div className="mb-6 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl text-sm text-error-700 dark:text-error-300">
              Failed to send email. Please try again.
            </div>
          )}

          <form method="post">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending Instructions...
                </>
              ) : (
                <>
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Payment Instructions
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
            You'll receive an email with bank details and instructions
          </p>
        </div>
      </main>
    </div>
  );
}
