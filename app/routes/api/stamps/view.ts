// app/routes/api/stamps.view.ts

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { getSessionWithPermission } from "~/lib/auth.server"; // '~/services/auth.server' 였을 경우 경로 수정
import { db } from "~/lib/db.server"; // '~/services/db.server' 였을 경우 경로 수정

// 클라이언트로부터 받을 데이터의 형식을 정의합니다.
const schema = z.object({
  stampEntryId: z.number(),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  // 1. 현재 로그인한 사용자가 누구인지 확인합니다.
  const session = await getSessionWithPermission(request, "USER");
  const user = session.user;
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const result = schema.safeParse({
    stampEntryId: Number(formData.get("stampEntryId")),
  });

  // 2. 요청받은 데이터가 올바른지 확인합니다.
  if (!result.success) {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  const { stampEntryId } = result.data;

  try {
    // 3. 데이터베이스에서 해당 스탬프를 업데이트합니다.
    //    중요: 반드시 본인 소유의 스탬프인지를 함께 확인합니다! (보안)
    const updatedStamp = await db.stampEntry.update({
      where: {
        id: stampEntryId,
        userId: user.id // 👈 다른 사람의 스탬프를 열어볼 수 없도록 막는 핵심 코드!
      },
      data: {
        isViewed: true,
      },
    });

    return json({ success: true, stamp: updatedStamp });
  } catch (error) {
    console.error("Failed to update stamp view status:", error);
    // update에 실패하면 (해당 id가 없거나, userId가 맞지 않으면) 에러가 발생합니다.
    return json({ error: "Stamp not found or permission denied" }, { status: 404 });
  }
};