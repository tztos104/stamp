// app/routes/claim.tsx

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router"; // 👈 react-router에서 LoaderFunctionArgs도 import
import { db } from "~/lib/db.server";
import { getSession as getAuthSession } from "~/lib/auth.server"; // 기존 인증 세션
import { getFlashSession, commitSession } from "~/lib/session.server"; // 👈 플래시 세션 임포트
import { sendAlimtalk, AlimtalkType } from "~/lib/alimtalk.server";
// --- Loader 함수 ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const claimCode = url.searchParams.get("code");
  const flashSession = await getFlashSession(request.headers.get("Cookie"));

  if (!claimCode) {
    flashSession.flash("toast", { message: "유효한 스탬프 코드가 필요합니다.", type: "error" });
    return redirect("/card", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }

  const { user, session: authSession } = await getAuthSession(request); // 인증 세션 가져오기

  // 1. 로그인 상태인 경우: 바로 스탬프 적립을 시도합니다.
  if (user) {
    const formData = new FormData();
    formData.append("claimCode", claimCode);

    // loader에서 action을 호출하는 방법
    // React Router의 action 함수를 직접 호출하되,
    // request 객체를 생성하여 action에 필요한 데이터를 전달합니다.
  const response = await action({
      request: new Request(request.url, {
        method: 'POST',
        body: formData,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
      params: {},
      context: {}, // 👈 이 부분을 추가하여 context 필드를 제공합니다.
    });

    // action이 redirect를 반환하면 그걸 그대로 반환
    if (response instanceof Response) {
      return response;
    }
    // action이 순수 객체를 반환한 경우 (오류 상황)
    flashSession.flash("toast", { message: "스탬프 적립 처리 중 오류가 발생했습니다.", type: "error" });
    return redirect("/card", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });

  } else {
    // 2. 로그인 상태가 아닌 경우: 회원가입 페이지로 리다이렉트
    // claimCode를 함께 넘겨주어 회원가입 후 자동 적립되도록 합니다.
    flashSession.flash("toast", { message: "스탬프를 받으려면 회원가입 또는 로그인이 필요합니다.", type: "info" });
    return redirect(`/signup?claimCode=${claimCode}`, {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }
};


// --- Action 함수 (스탬프 적립 처리) ---
export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, session: authSession } = await getAuthSession(request); // 인증 세션
  const flashSession = await getFlashSession(request.headers.get("Cookie")); // 플래시 세션

  const formData = await request.formData();
  const claimCode = formData.get("claimCode");

  if (!claimCode || typeof claimCode !== "string") {
    flashSession.flash("toast", { message: "유효한 스탬프 코드가 필요합니다.", type: "error" });
    return redirect("/card", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }

  // 이 action은 로그인된 사용자만 접근 가능합니다. (로그아웃 사용자는 loader에서 이미 signup으로 redirect)
  if (!user) {
    flashSession.flash("toast", { message: "스탬프 적립을 위해 로그인이 필요합니다.", type: "error" });
    return redirect("/login", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }

  try {
    const result = await db.$transaction(async (prisma: { claimableStamp: { findUnique: (arg0: { where: { claimCode: string; }; include: { event: boolean; redemptions: { where: { userId: string; }; }; }; }) => any; update: (arg0: { where: { id: any; }; data: { currentUses: { increment: number; }; redemptions: { create: { userId: string; }; }; }; }) => any; }; stampCard: { findFirst: (arg0: { where: { userId: string; isRedeemed: boolean; }; include: { _count: { select: { entries: boolean; }; }; }; }) => any; create: (arg0: { data: { userId: string; }; include: { _count: { select: { entries: boolean; }; }; }; }) => any; }; stampEntry: { findFirst: (arg0: { where: { stampCardId: any; eventId: any; }; }) => any; create: (arg0: { data: { userId: string; eventId: any; stampCardId: any; }; }) => any; }; }) => {
      const claimableStamp = await prisma.claimableStamp.findUnique({
        where: { claimCode },
        include: { event: true, redemptions: { where: { userId: user.id } } }, // 사용자가 이 코드를 사용했는지 확인
      });

      if (!claimableStamp) {
        throw new Error("존재하지 않는 스탬프 코드입니다.");
      }
      if (new Date() > claimableStamp.expiresAt) {
        throw new Error("만료된 스탬프 코드입니다.");
      }
   
      if (claimableStamp.redemptions.length > 0) {
        throw new Error("이미 사용한 스탬프 코드입니다.");
      }
      if (claimableStamp.maxUses !== null && claimableStamp.currentUses >= claimableStamp.maxUses) {
        throw new Error("이 스탬프 코드는 모두 사용되었습니다.");
      }

      let activeStampCard = await prisma.stampCard.findFirst({
        where: { userId: user.id, isRedeemed: false },
        include: { _count: { select: { entries: true } } },
      });

      if (!activeStampCard) {
        activeStampCard = await prisma.stampCard.create({
          data: { userId: user.id },
          include: { _count: { select: { entries: true } } },
        });
      }

      const existingStampEntry = await prisma.stampEntry.findFirst({
        where: {
          stampCardId: activeStampCard.id,
          eventId: claimableStamp.eventId,
        },
      });

      if (existingStampEntry) {
        throw new Error("이 이벤트의 스탬프는 이미 적립되었습니다.");
      }

      await prisma.stampEntry.create({
        data: {
          userId: user.id,
          eventId: claimableStamp.eventId,
          stampCardId: activeStampCard.id,
        },
      });

      await prisma.claimableStamp.update({
        where: { id: claimableStamp.id },
        data: {
          currentUses: { increment: 1 },
          redemptions: {
            create: { userId: user.id }
          }
        },
      });

      const currentStampCount = activeStampCard._count.entries + 1;
      await sendAlimtalk(
        AlimtalkType.STAMP_ACQUIRED,
        user.phoneNumber, // `user` 객체에 phoneNumber가 포함되어 있어야 합니다.
        {
          '고객명': user.name,
          '활동명': claimableStamp.event.name,
          '현재개수': String(currentStampCount),
          '남은스템프개수': String(10 - currentStampCount),
          'link': `${process.env.APP_URL}/card`
        }
      );
      return activeStampCard.id;
    });

    flashSession.flash("toast", { message: "스탬프가 성공적으로 적립되었습니다!", type: "success" });
    return redirect("/card", {
      headers: {
        "Set-Cookie": await commitSession(flashSession),
      },
    });

  } catch (error: any) { // error 타입을 any로 변경하여 error.message 접근
    console.error("스탬프 적립 중 오류 발생:", error);
    flashSession.flash("toast", { message: error.message || "스탬프 적립 중 알 수 없는 오류가 발생했습니다.", type: "error" });
    return redirect("/card", {
      headers: {
        "Set-Cookie": await commitSession(flashSession),
      },
    });
  }
};

// UI는 렌더링되지 않으므로 null 반환
export default function ClaimPage() {
  return null;
}