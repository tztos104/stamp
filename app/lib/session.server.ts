// app/lib/session.server.ts
import { createCookieSessionStorage } from "@remix-run/node";


const COOKIE_SECRET1 = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET1) {
  throw new Error("COOKIE_SECRET is not set");
}
// 세션을 저장할 쿠키를 설정합니다.
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__flash_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [COOKIE_SECRET1.trim()], // 🤫 실제 프로덕션에서는 .env 파일로 비밀 키를 관리해야 합니다.
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession: getFlashSession, commitSession, destroySession } = sessionStorage;