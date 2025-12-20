import {
  type LoaderFunctionArgs,
  useFetcher,
  useLoaderData,
  type ActionFunctionArgs,
  redirect,
} from 'react-router';
import * as z from 'zod';
import { db } from '~/lib/db.server';
import { uploadImages } from "~/lib/upload.server";
import { commitSession, getFlashSession } from '~/lib/session.server';
import { EventForm } from "~/components/eventform";
import type { Participant } from '~/components/participantManager';
import dayjs from 'dayjs';
// 🚨 [수정됨] json 임포트 제거. new Response를 사용합니다.
import { sendAlimtalk, AlimtalkType } from '~/lib/alimtalk.server';
import { UserStatus } from "@prisma/client";


// 💡 성능/확장성을 위해 상수는 한 곳에 정의합니다.
const STAMPS_PER_CARD = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const categories = await db.eventCategory.findMany();
  return { categories };
};

// --- 참가자와 전체 폼에 대한 Zod 스키마는 멘티님 코드와 동일하게 유지합니다. ---
const participantSchema = z.object({
  type: z.enum(['user', 'temp-phone', 'temp-code']),
  id: z.string(),
  name: z.string(),
  detail: z.string(),
  maxUses: z.number().nullable().optional(),
  expiryOption: z.enum(['event_end', 'one_day', 'three_days', 'custom']).optional(),
  customExpiryDate: z.string().nullable().optional(),
});
const eventFormSchema = z.object({
  name: z.string().min(2, '이벤트 이름은 2글자 이상이어야 합니다.'),
  description: z.string().optional(),
  imageUrl: z.any().optional(), // 파일 업로드는 클라이언트에서 처리 후 URL로 변환
  isAllDay: z.boolean(),
  categoryId: z.string().min(1, '카테고리를 선택해주세요.'),
  startDate: z.date().refine(date => date, {
    message: '시작 날짜를 선택해주세요.',
  }),
  endDate: z.date().refine(date => date, {
    message: '종료 날짜를 선택해주세요.',
  }),
  participants: z.array(participantSchema).min(1, '참가자를 한 명 이상 등록해주세요.'),
}).refine(data => data.endDate >= data.startDate, {
  message: "종료일은 시작일보다 빠를 수 없습니다.",
  path: ["endDate"],
});


export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const participantsJSON = formData.get("participants") as string;
  const participants: Participant[] = participantsJSON ? JSON.parse(participantsJSON) : [];

  const result = eventFormSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    isAllDay: formData.get('isAllDay') === 'true',
    categoryId: formData.get('categoryId'),
    startDate: dayjs(formData.get('startDate') as string).toDate(),
    endDate: dayjs(formData.get('endDate') as string).toDate(),
    participants: participants
  });

  // 1. 유효성 검사 실패 시, 에러 메시지 반환
  if (!result.success) {
    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    const error = result.error.flatten();
    const firstErrorMessage = Object.values(error.fieldErrors).flat()[0] || error.formErrors[0] || '입력값이 올바르지 않습니다.';
    flashSession.flash("toast", { type: "error", message: firstErrorMessage });

    // 🚨 [수정] json 대신 new Response 사용
    return new Response(JSON.stringify({ error: firstErrorMessage }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await commitSession(flashSession)
      },
    });
  }

  const { name, description, categoryId, isAllDay, startDate, endDate } = result.data;
  const imageFiles = formData.getAll("images") as File[];
  const eventEndDate = endDate;


  try {
    const imageUrls = await uploadImages(imageFiles);

    // 알림톡 발송을 위한 데이터 수집용 임시 배열 (트랜잭션 바깥에서 사용)
    const alimtalkData: { name: string, phoneNumber: string, currentCount: number }[] = [];
    let newEventName = name; // 트랜잭션 내부에서 사용하기 위해 이름 확보

    // --- 2. 참가자 분류 및 사용자 ID 확보 (Bulk 처리를 위한 사전 작업) ---
    const userParticipants = participants.filter(p => p.type === 'user');
    const tempPhoneParticipants = participants.filter(p => p.type === 'temp-phone');
    const tempCodeParticipants = participants.filter(p => p.type === 'temp-code');

    // 1차: 기존 회원 ID 목록
    let userIdsToStamp = userParticipants.map(p => p.id);

    // 2차: 임시 전화번호 사용자 처리 (N+1 방지 대신, DB 쿼리를 트랜잭션 전으로 분리)
    for (const p of tempPhoneParticipants) {
      let user = await db.user.findUnique({ where: { phoneNumber: p.id } });
      if (!user) {
        // 💡 PII 보호: 로그에 민감 정보를 남기지 않습니다.
        user = await db.user.create({
          data: {
            name: p.name,
            phoneNumber: p.id,
            status: UserStatus.TEMPORARY,
          },
        });
      }
      // 임시 ID (전화번호) 대신 DB ID로 대체합니다.
      userIdsToStamp.push(user.id);
    }


    // --- 3. 데이터베이스에 모든 정보를 한 번에 저장 (트랜잭션 시작) ---
    await db.$transaction(async prisma => {

      // 3-1. 이벤트 생성
      const newEvent = await prisma.event.create({
        data: {
          name, description, isAllDay, startDate, endDate,
          images: { create: imageUrls.map(url => ({ url })), },
          categoryId: Number(categoryId),
        },
        select: { id: true, endDate: true, name: true },
      });
      const eventId = newEvent.id;

      // 3-2. 임시 코드 생성 (Bulk Insert)
      if (tempCodeParticipants.length > 0) {
        const claimableStampsData = tempCodeParticipants.map(p => {
          let expiresAt = new Date(eventEndDate);
          if (p.expiryOption === 'one_day') { expiresAt.setDate(expiresAt.getDate() + 1); }
          else if (p.expiryOption === 'three_days') { expiresAt.setDate(expiresAt.getDate() + 3); }
          else if (p.expiryOption === 'custom' && p.customExpiryDate) { expiresAt = new Date(p.customExpiryDate); }

          return {
            claimCode: p.id,
            eventId: eventId,
            expiresAt: expiresAt,
            maxUses: p.maxUses,
          };
        });
        await prisma.claimableStamp.createMany({ data: claimableStampsData });
      }


      // --- 3-3. 스탬프 카드 및 엔트리 Bulk 처리 (N+1 쿼리 해결 핵심) ---
      if (userIdsToStamp.length > 0) {

        // 1. 해당 유저들의 현재 활성 카드 목록과 엔트리 수를 한번에 조회 (DB 쿼리 1회)
        const userActiveCards = await prisma.stampCard.findMany({
          where: { userId: { in: userIdsToStamp }, isRedeemed: false },
          // 필요한 필드만 select 합니다.
          select: {
            id: true,
            userId: true,
            entries: {
              // 🚨 N+1 방지: 현재 이벤트 ID를 제외한 스탬프 개수를 셉니다.
              where: { eventId: { not: eventId } },
              select: { id: true }
            }
          },
          orderBy: { createdAt: 'asc' },
        });

        // 2. 알림톡 데이터에 필요한 사용자 정보도 한 번에 조회 (DB 쿼리 1회)
        const userRecords = await prisma.user.findMany({
          where: { id: { in: userIdsToStamp } },
          select: { id: true, name: true, phoneNumber: true }
        });
        const userMap = new Map(userRecords.map(u => [u.id, u]));


        const userCardsMap = new Map<string, { id: number, entryCount: number }[]>();
        for (const card of userActiveCards) {
          if (!userCardsMap.has(card.userId)) {
            userCardsMap.set(card.userId, []);
          }
          // entries 배열의 길이로 현재 스탬프 개수를 얻습니다.
          userCardsMap.get(card.userId)!.push({ id: card.id, entryCount: card.entries.length });
        }

        const stampEntriesToCreate: { userId: string; eventId: string; stampCardId: number; }[] = [];
        const newCardsToCreate: { userId: string }[] = [];

        // 3. 메모리 내에서 카드 할당 및 알림톡 데이터 수집
        for (const userId of userIdsToStamp) {
          const cards = userCardsMap.get(userId) || [];
          let targetCardId: number | undefined;
          let currentStampCount = 0;

          const incompleteCard = cards.find(card => card.entryCount < STAMPS_PER_CARD);

          if (incompleteCard) {
            targetCardId = incompleteCard.id;
            currentStampCount = incompleteCard.entryCount;
          } else {
            // 새 카드가 필요
            newCardsToCreate.push({ userId });
            currentStampCount = 0;
          }

          // 스탬프를 받게 되는 경우 (기존 카드에 찍거나 새 카드를 생성하는 경우 모두)
          if (targetCardId || newCardsToCreate.some(c => c.userId === userId)) {
            if (targetCardId) {
              stampEntriesToCreate.push({ userId, eventId, stampCardId: targetCardId });
            }

            const userRecord = userMap.get(userId);
            if (userRecord && userRecord.phoneNumber) {
              // 알림톡 데이터 수집 (트랜잭션 밖으로 전달하기 위함)
              alimtalkData.push({
                name: userRecord.name,
                phoneNumber: userRecord.phoneNumber,
                currentCount: currentStampCount + 1, // 스탬프 적립 후 개수
              });
            }
          }
        }

        // 4. 필요한 경우 새 카드 생성 (Bulk - DB 쿼리 N회)
        if (newCardsToCreate.length > 0) {
          // 단건 생성으로 처리하며, 생성된 카드의 ID를 다시 확보하여 Bulk Insert에 사용합니다.
          const createdCards = await Promise.all(
            newCardsToCreate.map(cardData => prisma.stampCard.create({ data: cardData }))
          );

          // 새 카드에 찍을 스탬프 엔트리 생성 대기열에 추가
          for (const newCard of createdCards) {
            stampEntriesToCreate.push({ userId: newCard.userId, eventId, stampCardId: newCard.id });
          }
        }

        // 5. 스탬프 엔트리 Bulk 삽입 (DB 쿼리 1회)
        if (stampEntriesToCreate.length > 0) {
          await prisma.stampEntry.createMany({ data: stampEntriesToCreate });
        }
      }
    }); // --- 트랜잭션 종료 (DB Commit) ---


    // 🚨 [핵심 수정] 알림톡 비동기 발송 (성능/안정성 확보)
    // DB 트랜잭션이 완료된 후에만 외부 API를 호출하여 DB 락을 방지합니다.
    for (const data of alimtalkData) {
      // await를 제거하고 Promise를 생성만 하여, 비동기적으로 실행합니다.
      sendAlimtalk(
        AlimtalkType.STAMP_ACQUIRED,
        data.phoneNumber,
        {
          '고객명': data.name,
          '활동명': name, // 이벤트 이름 (newEvent.name) 사용
          '현재개수': String(data.currentCount),
          '남은스탬프개수': String(STAMPS_PER_CARD - data.currentCount),
          'link': `${process.env.APP_URL}/card`
        }
      ).catch(err => {
        // 알림톡 실패는 이벤트 등록 실패로 간주하지 않습니다. 로그만 기록합니다.
        // 💡 보안: 로그에 민감 정보(전화번호)는 노출하지 않습니다.
        console.error(`[Alimtalk Error] Failed to send to ${data.name.slice(0, 1)}**(${data.phoneNumber.slice(-4)})`);
      });
    }


    // 4. 리다이렉션 처리
    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    flashSession.flash("toast", {
      type: "success",
      message: "이벤트가 성공적으로 등록되었습니다.",
    });

    return redirect("/admin/events", {
      headers: [
        ["Set-Cookie", await commitSession(flashSession)],
      ],

    });
  } catch (error) {
    console.error("이벤트 등록 실패:", error);
    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    flashSession.flash("toast", { type: "error", message: '이벤트 등록 중 오류가 발생했습니다.' });

    // 🚨 [수정] json 대신 new Response 사용
    return new Response(JSON.stringify({ error: '이벤트 등록 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": await commitSession(flashSession)
      },
    });
  }
};


export default function CreateEventPage() {
  const { categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <EventForm
      fetcher={fetcher}
      categories={categories}
    />
  );
}