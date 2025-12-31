import { Link, redirect } from "react-router";
import type { Route } from "./+types/landing";
import { getOptionalUser } from "~/lib/require-auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  // If logged in, redirect to dashboard
  const user = await getOptionalUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return null;
}

export function meta() {
  return [
    { title: "FCPS Study - Master Your FCPS Part I Exam" },
    {
      name: "description",
      content:
        "Practice FCPS Part I with curated MCQs, detailed explanations, and smart learning modes. Start with a free paper today.",
    },
  ];
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                FCPS Study
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-xl shadow-lg shadow-primary-500/25 transition-all"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/30 rounded-full mb-8">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              Start with a free paper — no credit card required
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white leading-tight mb-6">
            Master Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-primary-700">
              FCPS Part I
            </span>{" "}
            Exam
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10">
            Practice with curated MCQs from top resources, get AI-powered
            explanations, and track your progress with smart learning modes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-2xl shadow-xl shadow-primary-500/25 transition-all flex items-center justify-center gap-2"
            >
              Start Free Trial
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
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              I have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Free Trial Banner */}
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-r from-primary-500 to-primary-700 rounded-3xl p-8 sm:p-12">
            <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  🎁 Free Paper Included
                </h3>
                <p className="text-primary-100 text-lg">
                  Every new account gets access to a complete practice paper
                  with detailed explanations — absolutely free.
                </p>
              </div>
              <Link
                to="/signup"
                className="shrink-0 px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
              >
                Claim Your Free Paper
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              A modern platform that combines proven study techniques with
              AI-powered tools to help you prepare effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">📚</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Curated Question Banks
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                High-yield MCQs extracted from trusted FCPS preparation books
                and past papers, organized by topic.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">🤖</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                AI-Powered Explanations
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Every question comes with detailed explanations. Don&apos;t just
                memorize — understand the concepts.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">🎯</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Test & Learning Modes
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Practice in timed test mode or learn at your pace with instant
                feedback. Both modes track your progress.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">📊</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Progress Tracking
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                See your scores, track attempts, and identify areas that need
                more attention. Know exactly where you stand.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/30 dark:to-rose-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">📱</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Mobile Friendly
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Study anywhere, anytime. Our responsive design works perfectly
                on your phone, tablet, or desktop.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 transition-all">
              <div className="w-full h-40 bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-900/30 dark:to-cyan-800/20 rounded-xl mb-6 flex items-center justify-center">
                <div className="text-6xl">🔄</div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Review Mistakes
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                After each test, review all questions with correct answers and
                explanations. Learn from every mistake.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Get Started in 3 Simple Steps
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Create your free account",
                description:
                  "Sign up in seconds with your email. No credit card required.",
              },
              {
                step: "2",
                title: "Access your free paper",
                description:
                  "Instantly get access to a complete practice paper with all questions and explanations.",
              },
              {
                step: "3",
                title: "Start practicing",
                description:
                  "Choose Test Mode for timed exams or Learning Mode to study at your own pace.",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-6 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700"
              >
                <div className="shrink-0 w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary-500/25">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-6">
            Ready to Ace Your FCPS?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
            Start preparing smarter, not harder. Your free paper is waiting.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-10 py-5 text-lg font-semibold text-white bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-2xl shadow-xl shadow-primary-500/25 transition-all"
          >
            Start Your Free Trial
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No credit card required • Free paper included • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">
                FCPS Study
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} FCPS Study. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

