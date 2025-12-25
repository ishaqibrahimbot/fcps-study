import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("paper/:paperId", "routes/paper.tsx"),
  route("paper/:paperId/fix", "routes/fix-questions.tsx"),
  route("test/:sessionId", "routes/test.tsx"),
  route("learn/:sessionId", "routes/learn.tsx"),
  route("review/:sessionId", "routes/review.tsx"),
  route("api/generate-explanation", "routes/api.generate-explanation.tsx"),
] satisfies RouteConfig;
