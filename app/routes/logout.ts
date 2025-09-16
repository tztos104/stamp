// app/routes/logout.ts (GET 방식 추가)

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { lucia, getSession } from "~/lib/auth.server";
import {  getFlashSession, commitSession } from "~/lib/session.server";

// 로그아웃 로직을 별도의 함수로 만듭니다.
async function performLogout(request: Request) {
  const { session } = await getSession(request);

  if (session) {
    await lucia.invalidateSession(session.id);
  }

  const sessionCookie = lucia.createBlankSessionCookie();
  
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  flashSession.flash("toast", {
    type: "success",
    message: "성공적으로 로그아웃되었습니다.",
  });

  return redirect("/login", {
    headers: [
      ["Set-Cookie", sessionCookie.serialize()],
      ["Set-Cookie", await commitSession(flashSession)],
    ],
  });
}

// GET 요청을 처리하는 loader 함수
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return performLogout(request);
};

// POST 요청을 처리하는 action 함수
export const action = async ({ request }: ActionFunctionArgs) => {
  return performLogout(request);
};