import {
  type RouteConfig,
  layout,
  index,
  prefix,
  route
} from "@react-router/dev/routes";

export default [
  // "routes/_layout.tsx" 파일을 전체 앱의 기본 레이아웃으로 사용합니다.
  layout("routes/_layout.tsx", [

    // 이 레이아웃 안에서 보여줄 첫 페이지로 "routes/_layout._index.tsx" 파일을 지정합니다.
    index("routes/_layout._index.tsx"),

    route("signup", "routes/signup.tsx"),
    route("login", "routes/login.tsx"),
    route("logout", "routes/logout.ts"),
    route("card", "routes/card/index.tsx"),
    route("events", "routes/events/index.tsx"),
    route("events/:id", "routes/events/$id.tsx"),
    route("claim", "routes/claim.tsx"),
    route("mypage", "routes/mypage.tsx"),

    // 추후 이 레이아웃을 사용하는 다른 페이지가 생기면 여기에 추가하면 됩니다.
    // 예: route("my-page", "routes/my-page.tsx"),s
    ...prefix("forgot-password", [
      index("routes/forgot-password/index.tsx"),
      route("verify", "routes/forgot-password/verify.tsx"),
      route("reset", "routes/forgot-password/reset.tsx"),
    ]),

  ]),
  route("admin", "routes/admin/_layout.tsx", [
    index("routes/admin/index.tsx"),

    // 👇 route(...)를 prefix(...)로 변경합니다.
    ...prefix("events", [
      index("routes/admin/events/index.tsx"),
      route("create", "routes/admin/events/create.tsx"),
      route(":eventId/edit", "routes/admin/events/$eventId/edit.tsx"),
      route(":eventId", "routes/admin/events/$eventId/index.tsx"),

    ]),
    ...prefix("coupons", [
      index("routes/admin/coupons/index.tsx"),

    ]),
    ...prefix("users", [
      index("routes/admin/users/index.tsx"),
      route(":userId", "routes/admin/users/$userId.tsx"),

    ]),
  ]),
  ...prefix("game", [
    route("play", "routes/game/play.tsx"),
    route("host", "routes/game/host.tsx"),
  ]),
  route("api/categories", "routes/api/categories.ts"),
  route("api/users/search", "routes/api/users/search.ts"),
  route("api/users/check", "routes/api/users/check.ts"),
  route("api/events/delete", "routes/api/events/delete.ts"),
  route("api/events/reviews", "routes/api/events/reviews.ts"),
  route("api/events/:id", "routes/api/events/$id.ts"),
  route("api/stamps/view", "routes/api/stamps/view.ts"),
  route("api/coupons/issue", "routes/api/coupons/issue.ts"),
  route("api/available-dates", "routes/api/available-dates.ts"),
  route("shared-dates", "routes/shared-dates.tsx"),
] satisfies RouteConfig;