import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("paper/:paperId", "routes/paper.tsx"),
  route("test/:sessionId", "routes/test.tsx"),
  route("learn/:sessionId", "routes/learn.tsx"),
  route("review/:sessionId", "routes/review.tsx"),
  route("admin/upload", "routes/admin.upload.tsx"),
] satisfies RouteConfig;
