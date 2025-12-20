// app/lib/cookies.server.ts
import { createCookie } from "@remix-run/node";

// "my-posts"라는 이름으로 쿠키를 만듭니다.
// 여기에 내가 쓴 글의 ID들이 배열([1, 5, 10])로 저장됩니다.
export const myPostsCookie = createCookie("my-posts", {
    maxAge: 60 * 60 * 24 * 365, // 1년 동안 유지
    httpOnly: true, // 보안 강화 (자바스크립트 접근 불가)
    path: "/",      // 사이트 전체에서 유효
    sameSite: "lax",
});