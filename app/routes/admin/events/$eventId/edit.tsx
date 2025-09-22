// app/routes/admin/events/$eventId.edit.tsx

import { json,} from "@remix-run/node";
import { useLoaderData, useFetcher, type LoaderFunctionArgs, type ActionFunctionArgs, redirect  } from "react-router";
import { db } from "~/lib/db.server";
import { EventForm } from "../../../../components/eventform"; // 👈 재사용 폼 컴포넌트
import { getFlashSession, commitSession } from "~/lib/session.server";
import { uploadImages } from "~/lib/upload.server";
import type { Participant } from "../../../../components/participantManager";
import * as z from 'zod';

// loader: URL의 eventId를 사용해 수정할 이벤트의 데이터를 불러옵니다.
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const eventId = params.eventId;
  if (!eventId) {
    throw new Response("Event not found", { status: 404 });
  }

  const [event, categories] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      include: { images: true, participants: { include: { user: true } },
    claimableStamps:true },
    }),
    db.eventCategory.findMany(),

  ]);

  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }

 // ✨ 기존 참가자 데이터를 Participant 타입으로 변환하는 로직
  const defaultParticipants: Participant[] = [];

  // 1. 기존 스탬프 엔트리 (확정된 회원/임시 전화번호)
  event.participants.forEach(p => {
    if (p.user) { 
      defaultParticipants.push({
        type: p.user.status === 'TEMPORARY' ? 'temp-phone' : 'user',
        id: p.user.status === 'TEMPORARY' ? p.user.phoneNumber : p.user.id,
        name: p.user.name,
        detail: p.user.phoneNumber || p.user.id,
      });
    }
  });

  // 2. 기존 ClaimableStamp (임시 코드)
  event.claimableStamps.forEach(cs => {
    // 만료일 옵션을 역으로 추정하는 로직 (UI 표시용)
    let expiryOption: Participant['expiryOption'] = 'event_end';
    if (cs.expiresAt) {
      const eventEndDate = new Date(event.endDate);
      const expiresAtDate = new Date(cs.expiresAt);
      const diffTime = expiresAtDate.getTime() - eventEndDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) expiryOption = 'one_day';
      else if (diffDays === 3) expiryOption = 'three_days';
      else if (diffDays !== 0) expiryOption = 'custom';
    }

    defaultParticipants.push({
      type: 'temp-code',
      id: cs.claimCode,
      name: '임시 스탬프 코드',
      detail: `최대 ${cs.maxUses === null ? '무제한' : `${cs.maxUses}회`} 사용`,
      maxUses: cs.maxUses,
      expiryOption: expiryOption,
      customExpiryDate: expiryOption === 'custom' ? cs.expiresAt.toISOString() : null,
    });
  });

  // EventForm에 전달할 defaultValues 객체
  const defaultValues = {
    ...event,
    categoryId: event.categoryId.toString(),
    participants: defaultParticipants, // ✨ 변환된 참가자 목록 추가
  };

  return { event: defaultValues, categories };
};

 const eventFormSchema = z.object({
    name: z.string().min(2, '이벤트 이름은 2글자 이상이어야 합니다.'),
    description: z.string().optional(),
    isAllDay: z.boolean(),
    categoryId: z.string().min(1, '카테고리를 선택해주세요.'),
    startDate: z.date().refine(date => date, {
        message: '시작 날짜를 선택해주세요.',
    }),
    endDate: z.date().refine(date => date, {
        message: '종료 날짜를 선택해주세요.',
    }),
});
// action: 폼 제출 시, 데이터를 받아 이벤트를 '수정'합니다.
export const action = async ({ request, params }: ActionFunctionArgs) => {
     const eventId = params.eventId!;
    if (!eventId) {
        return json({ error: "이벤트 ID가 없습니다." }, { status: 400 });
    }

    const formData = await request.formData();
    
    const result = eventFormSchema.safeParse({
        ...Object.fromEntries(formData),
        isAllDay: formData.get('isAllDay') === 'true',
        startDate: new Date(formData.get('startDate') as string),
        endDate: new Date(formData.get('endDate') as string),
    });

    // 1. 유효성 검사 실패 시, 에러 메시지를 반환합니다.
    if (!result.success) {
        const formErrors = result.error.flatten().fieldErrors;
        return json({ error: '입력값이 올바르지 않습니다.', formErrors }, { status: 400 });
    }

    // 유효성 검사를 통과한 안전한 데이터를 사용합니다.
    const { name, description, categoryId, isAllDay, startDate, endDate } = result.data;

    // 2. 이미지 및 참가자 데이터는 별도로 처리합니다.
    const newImageFiles = formData.getAll("newImages") as File[];
    const newImageUrls = await uploadImages(newImageFiles);
    const participants: Participant[] = JSON.parse(formData.get("participants") as string);
    const existingImageIds: number[] = JSON.parse(formData.get("existingImageIds") as string || '[]');

    try {
        await db.$transaction(async (prisma) => {
            await prisma.event.update({
                where: { id: eventId },
                data: {
                    name, // ✅ 안전하게 타입이 보장된 데이터를 사용합니다.
                    description,
                    isAllDay,
                    startDate,
                    endDate,
                    categoryId: Number(categoryId),
                },
            });
            // --- 2. 이미지 정보 업데이트 ---
            // 2-1. 삭제된 기존 이미지들 제거
            await prisma.eventImage.deleteMany({
                where: {
                    eventId: eventId,
                    id: { notIn: existingImageIds },
                },
            });
            // 2-2. 새로 추가된 이미지들 생성
            if (newImageUrls.length > 0) {
                await prisma.eventImage.createMany({
                    data: newImageUrls.map(url => ({ url, eventId })),
                });
            }

            const existingStampEntries = await prisma.stampEntry.findMany({
                where: { eventId },
                select: { userId: true } // userId만 있으면 충분
            });
            const existingClaimableStamps = await prisma.claimableStamp.findMany({
                where: { eventId },
                select: { claimCode: true } // claimCode만 있으면 충분
            });

           const existingUserIdsInEvent = new Set(existingStampEntries.map(e => e.userId));
            const existingClaimCodesInEvent = new Set(existingClaimableStamps.map(c => c.claimCode));
            // 3-2. 새로 제출된 참가자 목록 처리
            const currentParticipantUserIds = new Set<string>(); // 현재 폼에 있는 (임시 코드 제외) 유저 ID들
            const currentParticipantClaimCodes = new Set<string>();

            for (const p of participants) {
                 if (p.type === 'temp-code') {
                    currentParticipantClaimCodes.add(p.id); // 현재 폼에 있는 임시 코드 ID 기록

                    // 임시 코드: 기존에 없으면 새로 생성, 있으면 업데이트
                    let expiresAt = new Date(endDate);
                    if (p.expiryOption === 'one_day') {
                        expiresAt.setDate(expiresAt.getDate() + 1);
                    } else if (p.expiryOption === 'three_days') {
                        expiresAt.setDate(expiresAt.getDate() + 3);
                    } else if (p.expiryOption === 'custom' && p.customExpiryDate) {
                        expiresAt = new Date(p.customExpiryDate);
                    }

                    if (!existingClaimCodesInEvent.has(p.id)) {
                        await prisma.claimableStamp.create({
                            data: {
                                claimCode: p.id,
                                eventId: eventId,
                                expiresAt: expiresAt,
                                maxUses: p.maxUses,
                            }
                        });
                    } else {
                        await prisma.claimableStamp.update({
                            where: { claimCode: p.id, eventId: eventId },
                            data: {
                                expiresAt: expiresAt,
                                maxUses: p.maxUses,
                            }
                        });
                    }
                    // 임시 코드는 스탬프 적립 로직을 타지 않으므로 다음 참가자로 넘어감
                    continue;
                }

                 // 일반 사용자 또는 임시 전화번호 사용자 처리
                let currentParticipantUserId: string;
                if (p.type === 'user') {
                    currentParticipantUserId = p.id;
                } else { // 'temp-phone'
                    let user = await prisma.user.findUnique({ where: { phoneNumber: p.id } });
                    if (!user) {
                        user = await prisma.user.create({
                            data: { name: p.name, phoneNumber: p.id, status: "TEMPORARY" },
                        });
                    }
                    currentParticipantUserId = user.id;
                }

                currentParticipantUserIds.add(currentParticipantUserId); // 현재 폼에 있는 유저 ID 기록

                // 기존에 이 이벤트로 스탬프를 받지 않은 사용자만 새로 추가
                if (!existingUserIdsInEvent.has(currentParticipantUserId)) {
                    // 🚨 스탬프 카드 로직 수정 시작 🚨
                    // 1. 해당 사용자의 모든 진행 중인 스탬프 카드를 가져옵니다.
                    const userActiveCards = await prisma.stampCard.findMany({
                        where: { userId: currentParticipantUserId, isRedeemed: false },
                        include: { entries: true }, // entries를 포함하여 스탬프 개수를 직접 확인
                        orderBy: { createdAt: 'asc' }, // 가장 먼저 생성된 카드부터 확인
                    });

                    let targetCardId: number | undefined;

                    // 2. 진행 중인 카드 중에서 스탬프가 10개 미만인 카드를 찾습니다.
                    for (const card of userActiveCards) {
                        if (card.entries.length < 10) {
                            targetCardId = card.id;
                            break; // 찾으면 루프 종료
                        }
                    }

                    // 3. 스탬프를 적립할 카드가 없다면 (모두 꽉 찼거나 아예 없다면) 새 카드를 만듭니다.
                    if (!targetCardId) {
                        const newCard = await prisma.stampCard.create({ data: { userId: currentParticipantUserId } });
                        targetCardId = newCard.id;
                    }

                    // 4. 결정된 카드 ID로 스탬프를 적립합니다.
                    await prisma.stampEntry.create({
                        data: { userId: currentParticipantUserId, eventId: eventId, stampCardId: targetCardId }
                    });
                    // 🚨 스탬프 카드 로직 수정 끝 🚨
                }
            }

            // 3-3. 폼에서 삭제된 참가자 (StampEntry) 처리
            // 기존 참가자 중 현재 폼에 없는 사용자를 찾습니다.
            const usersToRemove = existingStampEntries.filter(
                (entry) => !currentParticipantUserIds.has(entry.userId)
            );
            if (usersToRemove.length > 0) {
                await prisma.stampEntry.deleteMany({
                    where: {
                        eventId: eventId,
                        userId: { in: usersToRemove.map(u => u.userId) },
                    },
                });
            }

            // 3-4. 폼에서 삭제된 임시 코드 (ClaimableStamp) 처리
            // 기존 임시 코드 중 현재 폼에 없는 코드를 찾습니다.
            const codesToRemove = existingClaimableStamps.filter(
                (entry) => !currentParticipantClaimCodes.has(entry.claimCode)
            );
            if (codesToRemove.length > 0) {
                await prisma.claimableStamp.deleteMany({
                    where: {
                        eventId: eventId,
                        claimCode: { in: codesToRemove.map(c => c.claimCode) },
                    },
                });
            }
        });

        const flashSession = await getFlashSession(request.headers.get("Cookie"));
        flashSession.flash("toast", {
            type: "success",
            message: "이벤트가 성공적으로 수정되었습니다.",
        });

        return redirect(`/admin/events`, {
            headers: [["Set-Cookie", await commitSession(flashSession)]],
        });
    } catch (error) {
        console.error("이벤트 수정 실패:", error);
        return json({ error: "이벤트 수정 중 오류가 발생했습니다." }, { status: 500 });
    }
};

export default function EditEventPage() {
  const { event, categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <EventForm 
      fetcher={fetcher}
      categories={categories}
      defaultValues={event} // 👈 loader가 불러온 기존 데이터를 폼에 채워줍니다.
    />
  );
}