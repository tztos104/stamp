
import { type ActionFunctionArgs, redirect } from "react-router";
import { lucia, getSession } from "~/lib/auth.server";
import { getFlashSession , commitSession } from "~/lib/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // 현재 로그인된 세션을 가져옵니다.
  const { session } = await getSession(request);

  if (session) {
    // 세션이 존재하면, 해당 세션을 무효화합니다.
    await lucia.invalidateSession(session.id);
  }

  // 브라우저의 쿠키를 삭제하기 위해 빈 세션 쿠키를 생성합니다.
  const sessionCookie = lucia.createBlankSessionCookie();
  
  // 로그아웃 성공 메시지를 토스트로 띄우기 위해 플래시 세션을 사용합니다.
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  flashSession.flash("toast", {
    type: "success",
    message: "성공적으로 로그아웃되었습니다.",
  });

  // 로그인 페이지로 리디렉션하면서, 쿠키 삭제 및 토스트 메시지 설정을 함께 보냅니다.
  return redirect("/", {
    headers: [
      ["Set-Cookie", sessionCookie.serialize()],
      ["Set-Cookie", await commitSession(flashSession)],
    ],
  });
};