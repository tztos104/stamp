

import { type ActionFunctionArgs, redirect } from "react-router";
import { db } from "~/lib/db.server";
import { getSessionWithPermission } from "~/lib/auth.server";
import { Prisma } from "@prisma/client";
import { commitSession, getFlashSession } from "~/lib/session.server";
import { deleteImages } from "~/lib/upload.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // 관리자 페이지 기능이므로 'ADMIN' 권한으로 확인하는 것이 안전합니다.
  await getSessionWithPermission(request, "ADMIN");

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await request.formData();
  const eventId = formData.get("eventId") as string;
  const force = formData.get("force") === "true";

  if (!eventId) {
    throw new Response("이벤트 ID가 필요합니다.", { status: 404 });
  }

  try {
    const eventToDelete = await db.event.findUnique({
      where: { id: eventId },
      include: { images: true } // EventImage 테이블의 이미지들
    });
    const urlsToDelete: string[] = [];
    if (eventToDelete) {
      // 1) 대표 이미지 (Event.imageUrl)
      if (eventToDelete.imageUrl) urlsToDelete.push(eventToDelete.imageUrl);
      // 2) 갤러리 이미지들 (EventImage.url)
      eventToDelete.images.forEach(img => urlsToDelete.push(img.url));
    }
    if (force) {
      // --- 강제 삭제 로직 ---
      await db.$transaction(async (prisma) => {
        await prisma.review.deleteMany({ where: { eventId } });
        await prisma.eventImage.deleteMany({ where: { eventId } });
        await prisma.stampEntry.deleteMany({ where: { eventId } });
        await prisma.claimableStamp.deleteMany({ where: { eventId } });
        await prisma.event.delete({ where: { id: eventId } });
      });
    } else {
      // --- 일반 (안전) 삭제 로직 ---
      await db.event.delete({ where: { id: eventId } });
    }
    if (urlsToDelete.length > 0) {
      await deleteImages(urlsToDelete);
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

  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      // 👇 실패 시, json 데이터를 반환하여 UI가 처리하도록 합니다.
      throw new Response("참가 기록이 있는 이벤트는 삭제할 수 없습니다. 강제 삭제를 원하시면 체크박스를 선택하세요.", {
        status: 409
      });
    }

    throw new Response("이벤트 삭제에 실패했습니다.", {
      status: 500
    });
  }
};