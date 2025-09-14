import {
  type RouteConfig,
  layout,
  index,
  route
} from "@react-router/dev/routes";

export default [
  // "routes/_layout.tsx" 파일을 전체 앱의 기본 레이아웃으로 사용합니다.
  layout("routes/_layout.tsx", [
    
    // 이 레이아웃 안에서 보여줄 첫 페이지로 "routes/_layout._index.tsx" 파일을 지정합니다.
    index("routes/_layout._index.tsx"),

     route("signup", "routes/signup.tsx"),
      //route("login", "routes/login.tsx"),
    // 추후 이 레이아웃을 사용하는 다른 페이지가 생기면 여기에 추가하면 됩니다.
    // 예: route("my-page", "routes/my-page.tsx"),
  ]),
] satisfies RouteConfig;