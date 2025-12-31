import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Landing page (public)
  index("routes/landing.tsx"),

  // Dashboard (authenticated)
  route("dashboard", "routes/dashboard.tsx"),

  // Auth routes
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),
  route("logout", "routes/logout.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("verify-email", "routes/verify-email.tsx"),

  // App routes
  route("paper/:paperId", "routes/paper.tsx"),
  route("paper/:paperId/fix", "routes/fix-questions.tsx"),
  route("test/:sessionId", "routes/test.tsx"),
  route("learn/:sessionId", "routes/learn.tsx"),
  route("review/:sessionId", "routes/review.tsx"),

  // API routes
  route("api/generate-explanation", "routes/api.generate-explanation.tsx"),
] satisfies RouteConfig;
