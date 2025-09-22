// app/routes/api/events.$id.tsx

import { type LoaderFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const eventId = params.id;

  if (!eventId) {
    throw new Response("Event ID is missing", { status: 400 });
  }

  const rawEvent = await db.event.findUnique({
    where: { id: eventId },
    include: {
      images: { take: 1 },
      category: { select: { name: true } },
      reviews: { select: { rating: true } }, // 👇 리뷰 평점 계산을 위해 rating만 가져옵니다.
      _count: {
        select: { participants: true, claimableStamps: true }
      }
    },
    // select는 include와 함께 사용할 수 없으므로 제거하고 필요한 필드를 모두 포함시킵니다.
  });

  if (!rawEvent) {
    throw new Response("Event Not Found", { status: 404 });
  }
  
  // 👇 가져온 이벤트 데이터에 리뷰 평균과 개수를 계산하여 추가합니다.
  const reviewCount = rawEvent.reviews.length;
  const averageRating = reviewCount > 0
    ? rawEvent.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;

  // 필요한 데이터만 event 객체로 묶어서 반환합니다.
  const event = {
    id: rawEvent.id,
    name: rawEvent.name,
    description: rawEvent.description,
    startDate: rawEvent.startDate,
    endDate: rawEvent.endDate,
    images: rawEvent.images,
    category: rawEvent.category,
    _count: rawEvent._count,
    reviewCount, // 계산된 리뷰 개수
    averageRating, // 계산된 평균 별점
  };

  return { event };
};