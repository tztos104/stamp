// app/routes/api/events/reviews.ts

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { Prisma } from "@prisma/client";

// --- 각 작업(intent)에 대한 Zod 스키마 정의 ---
const createSchema = z.object({
  eventId: z.string().min(1),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().optional(),
});

const updateSchema = z.object({
  reviewId: z.coerce.number(),
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().optional(),
});

const deleteSchema = z.object({
  reviewId: z.coerce.number(),
});


export const action = async ({ request }: ActionFunctionArgs) => {
  // --- 1. 공통: 로그인 여부 확인 ---
  const { user } = await getSession(request);
  if (!user) {
    return json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    // --- 🚀 리뷰 생성 ---
    case "CREATE": {
      const result = createSchema.safeParse(Object.fromEntries(formData));
      if (!result.success) {
        return json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
      }
      
      const { eventId, rating, comment } = result.data;

      // 이벤트 참가 여부 확인
      if (user.role !== "ADMIN") {
        const participation = await db.stampEntry.findFirst({
          where: { userId: user.id, eventId: eventId },
        });
        if (!participation) {
          return json({ error: "참가한 이벤트에만 리뷰를 작성할 수 있습니다." }, { status: 403 });
        }
      }

      try {
        const newReview = await db.review.create({
          data: { rating, comment, eventId, userId: user.id },
        });
        return json({ success: true, review: newReview });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return json({ error: "이미 리뷰를 작성했습니다." }, { status: 409 });
        }
        return json({ error: "리뷰 생성 중 오류 발생" }, { status: 500 });
      }
    }

    // --- ✏️ 리뷰 수정 ---
    case "UPDATE": {
      const result = updateSchema.safeParse(Object.fromEntries(formData));
      if (!result.success) {
        return json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
      }

      const { reviewId, rating, comment } = result.data;
      
      try {
        const updatedReview = await db.review.update({
          // 중요: 본인 리뷰만 수정 가능하도록 userId 조건 추가
          where: { id: reviewId, userId: user.id },
          data: { rating, comment },
        });
        return json({ success: true, review: updatedReview });
      } catch (error) {
        return json({ error: "리뷰를 찾을 수 없거나 수정할 권한이 없습니다." }, { status: 404 });
      }
    }

    // --- 🗑️ 리뷰 삭제 ---
    case "DELETE": {
      const result = deleteSchema.safeParse(Object.fromEntries(formData));
      if (!result.success) {
        return json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
      }

      const { reviewId } = result.data;
      
      try {
        
       const reviewToDelete = await db.review.findUnique({
          where: { id: reviewId },
          select: { userId: true },
        });

        if (!reviewToDelete) {
          return json({ error: "리뷰를 찾을 수 없습니다." }, { status: 404 });
        }

        // 2. 요청한 사람이 관리자(ADMIN)이거나 리뷰 작성자 본인일 경우에만 삭제를 허용합니다.
        if (user.role === "ADMIN" || user.id === reviewToDelete.userId) {
          await db.review.delete({
            where: { id: reviewId },
          });
          return json({ success: true });
        } else {
          // 둘 다 해당하지 않으면 권한 없음 에러를 반환합니다.
          return json({ error: "리뷰를 삭제할 권한이 없습니다." }, { status: 403 });
        }
      } catch (error) {
        return json({ error: "리뷰 삭제 중 오류가 발생했습니다." }, { status: 500 });
      }
    }

    default: {
      return json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
  }
};