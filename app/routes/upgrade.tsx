import { redirect, useNavigation, useActionData } from "react-router";
import { Link } from "react-router";
import type { Route } from "./+types/upgrade";
import { requireAuth } from "~/lib/require-auth.server";
import { sendUpgradeInstructionsEmail } from "~/lib/email.server";

const CREDIT_PACKAGES = [
  { id: "starter", name: "Starter", credits: 10, price: 1000 },
  { id: "value", name: "Value", credits: 20, price: 1800, popular: true },
  { id: "pro", name: "Pro", credits: 30, price: 2500 },
  { id: "lifetime", name: "Lifetime", credits: null, price: 5000, best: true },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);

  // If already lifetime, redirect to dashboard
  if (user.subscriptionStatus === "lifetime") {
    return redirect("/dashboard");
  }

  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);

  if (user.subscriptionStatus === "lifetime") {
    return redirect("/dashboard");
  }

  const formData = await request.formData();
  const packageId = formData.get("package") as string;

  const selectedPackage = CREDIT_PACKAGES.find((p) => p.id === packageId);

  const result = await sendUpgradeInstructionsEmail(
    user.email,
    user.name,
    selectedPackage?.name || "Unknown"
  );

  if (result.success) {
    return { success: true, packageName: selectedPackage?.name };
  } else {
    return { success: false, error: result.error };
  }
}

export function meta() {
  return [
    { title: "Get Credits - FCPS Study" },
    { name: "description", content: "Get credits to unlock papers" },
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/25">
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
            We've sent payment instructions for{" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {actionData.packageName}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-900 dark:text-white">
              {loaderData.user.email}
            </span>
            . Follow the steps in the email to complete your purchase.
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg border border-primary-200 dark:border-primary-700/50">
              <span className="text-lg">🎟️</span>
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                {loaderData.user.credits}
              </span>
              <span className="text-xs text-primary-600 dark:text-primary-400">
                credits
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Early Bird Banner */}
        <div className="mb-8 p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white text-center">
          <p className="text-lg sm:text-xl font-bold mb-1">
            🎁 Early Bird Offer!
          </p>
          <p className="text-emerald-100">
            First 10 users to purchase get{" "}
            <span className="font-bold underline">FREE lifetime access</span>!
          </p>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
            <span className="text-2xl">🎟️</span>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              Get Credits
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Unlock More Papers
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Each credit unlocks one paper permanently. Choose a package that fits your study needs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {CREDIT_PACKAGES.map((pkg) => (
            <form key={pkg.id} method="post" className="flex">
              <input type="hidden" name="package" value={pkg.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 text-left rounded-2xl p-6 border-2 transition-all duration-200 hover:shadow-lg disabled:opacity-50 ${
                  pkg.best
                    ? "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 border-amber-400 dark:border-amber-600 hover:border-amber-500"
                    : pkg.popular
                    ? "bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border-primary-400 dark:border-primary-600 hover:border-primary-500"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-600"
                }`}
              >
                {(pkg.best || pkg.popular) && (
                  <div
                    className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full mb-3 ${
                      pkg.best
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                        : "bg-primary-500 text-white"
                    }`}
                  >
                    {pkg.best ? "BEST VALUE" : "POPULAR"}
                  </div>
                )}
                <h3
                  className={`text-lg font-bold mb-1 ${
                    pkg.best
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {pkg.name}
                </h3>
                <div className="mb-3">
                  {pkg.credits ? (
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-3xl font-bold ${
                          pkg.best
                            ? "text-amber-900 dark:text-amber-100"
                            : pkg.popular
                            ? "text-primary-700 dark:text-primary-300"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {pkg.credits}
                      </span>
                      <span
                        className={`text-sm ${
                          pkg.best
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        credits
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`text-lg font-semibold ${
                        pkg.best
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      All Papers
                    </div>
                  )}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    pkg.best
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  PKR {pkg.price.toLocaleString()}
                </div>
                {pkg.credits && (
                  <p
                    className={`text-xs mt-2 ${
                      pkg.best
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    PKR {Math.round(pkg.price / pkg.credits)} per credit
                  </p>
                )}
                {pkg.best && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 font-medium">
                    ✨ Never pay again!
                  </p>
                )}
              </button>
            </form>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 text-center">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Choose a Package
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select the credit package that fits your needs
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Complete Payment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Follow the bank transfer instructions sent to your email
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Start Studying
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Credits are added within 24 hours. Unlock any papers you want!
              </p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: "🔓",
              title: "Permanent Unlock",
              description: "Once unlocked, papers stay accessible forever",
            },
            {
              icon: "🎯",
              title: "Choose What You Need",
              description: "Unlock only the papers relevant to your exam",
            },
            {
              icon: "🤖",
              title: "AI Explanations",
              description: "Detailed explanations for every question",
            },
            {
              icon: "🆕",
              title: "New Papers Added",
              description: "More SK & AA papers coming regularly",
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

        {actionData?.error && (
          <div className="mt-8 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl text-sm text-error-700 dark:text-error-300 text-center">
            Failed to send email. Please try again.
          </div>
        )}
      </main>
    </div>
  );
}
