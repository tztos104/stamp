// app/routes/api.coupons.tsx

import { type ActionFunctionArgs } from "react-router"; // 👈 react-router에서 import
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { customAlphabet } from 'nanoid';

const STAMPS_PER_CARD = 10;

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 12);
const generateCouponCode = () => {
  const code = nanoid();
  return `STAMP-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  // --- 1. 쿠폰 발급 ---
  if (intent === "issueCoupon") {
    const { user } = await getSession(request);
    if (!user) {
      // 오류는 Response 객체를 throw하여 상태 코드를 명확히 전달
      throw new Response("로그인이 필요합니다.", { status: 401 });
    }

    const stampCard = await db.stampCard.findFirst({
      where: { userId: user.id, isRedeemed: false },
      include: { _count: { select: { entries: true } } },
    });

    if (!stampCard) {
      throw new Response("유효한 스탬프 카드를 찾을 수 없습니다.", { status: 404 });
    }

    if (stampCard._count.entries < STAMPS_PER_CARD) {
      throw new Response(`스탬프 ${STAMPS_PER_CARD}개를 모두 모아야 쿠폰을 받을 수 있습니다.`, { status: 400 });
    }

    try {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const newCoupon = await db.$transaction(async (prisma) => {
        await prisma.stampCard.update({
          where: { id: stampCard.id },
          data: { isRedeemed: true },
        });
        const coupon = await prisma.coupon.create({
          data: {
            code: generateCouponCode(),
            description: `${new Date().getFullYear()}년 스탬프 이벤트 보상`,
            expiresAt,
            stampCardId: stampCard.id,
          },
        });
        return coupon;
      });

      // 성공 시, 순수 객체 반환
      return { success: true, coupon: newCoupon };

    } catch (error) {
      console.error("쿠폰 발급 중 오류 발생:", error);
      throw new Response("쿠폰을 발급하는 중 문제가 발생했습니다.", { status: 500 });
    }
  }

  // --- 2. 쿠폰 사용 여부 토글 ---
  if (intent === "toggleCouponStatus") {
    // TODO: 관리자 권한 확인
    
    const couponId = formData.get("couponId");
    if (typeof couponId !== "string" || !couponId) {
      throw new Response("유효하지 않은 쿠폰 ID입니다.", { status: 400 });
    }

    try {
      const coupon = await db.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) {
        throw new Response("쿠폰을 찾을 수 없습니다.", { status: 404 });
      }

      const updatedCoupon = await db.coupon.update({
        where: { id: couponId },
        data: { isUsed: !coupon.isUsed },
      });

      await db.stampCard.update({
        where: { id: updatedCoupon.stampCardId },
        data: { isRedeemed: updatedCoupon.isUsed },
      });

      // 성공 시, 순수 객체 반환
      return { success: true, coupon: updatedCoupon };

    } catch (error) {
      console.error("쿠폰 상태 업데이트 중 오류 발생:", error);
      throw new Response("쿠폰 상태를 업데이트할 수 없습니다.", { status: 500 });
    }
  }

  // 일치하는 intent가 없는 경우
  throw new Response("알 수 없는 요청입니다.", { status: 400 });
};