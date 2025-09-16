

import { type ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { getSessionWithPermission } from "~/lib/auth.server";
import { Prisma } from "@prisma/client";
import { commitSession, getFlashSession } from "~/lib/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // 관리자 페이지 기능이므로 'ADMIN' 권한으로 확인하는 것이 안전합니다.
  await getSessionWithPermission(request, "USER");

  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const eventId = formData.get("eventId") as string;
  const force = formData.get("force") === "true";

  if (!eventId) {
    return json({ error: "이벤트 ID가 필요합니다." }, { status: 400 });
  }

  try {
    if (force) {
      // --- 강제 삭제 로직 ---
      await db.$transaction(async (prisma) => {
        await prisma.eventImage.deleteMany({ where: { eventId } });
        await prisma.stampEntry.deleteMany({ where: { eventId } });
        await prisma.claimableStamp.deleteMany({ where: { eventId } });
        await prisma.event.delete({ where: { id: eventId } });
      });
    } else {
      // --- 일반 (안전) 삭제 로직 ---
      await db.event.delete({ where: { id: eventId } });
    }
    
    // 성공 시, 성공 메시지를 담아 리디렉션
    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    flashSession.flash("toast", {
      type: "success",
      message: "이벤트가 성공적으로 삭제되었습니다.",
    });
    return redirect("/admin/events", {
        headers: [["Set-Cookie", await commitSession(flashSession)]]
    });

  }  catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      // 👇 실패 시, json 데이터를 반환하여 UI가 처리하도록 합니다.
      return json({ error: "참가 기록이 있는 이벤트는 삭제할 수 없습니다. 강제 삭제를 원하시면 체크박스를 선택하세요." }, { status: 409 });
    }

    return json({ error: "이벤트 삭제에 실패했습니다." }, { status: 500 });
  }
};