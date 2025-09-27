
import {
	type LoaderFunctionArgs,
	useFetcher,
	useLoaderData,
	useRevalidator,
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
import { json } from '@remix-run/node';


export const loader = async ({ request }: LoaderFunctionArgs) => {
	const categories = await db.eventCategory.findMany();
	return json({ categories });
};

// --- 참가자와 전체 폼에 대한 Zod 스키마를 강화합니다. ---
const participantSchema = z.object({
  type: z.enum(['user', 'temp-phone', 'temp-code']),
  id: z.string(),
  name: z.string(),
  detail: z.string(),
  maxUses: z.number().nullable().optional(),
  expiryOption: z.enum(['event_end', 'one_day', 'three_days', 'custom']).optional(),
  customExpiryDate: z.string().nullable().optional(),
});
// Zod 스키마 업데이트
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
    // 참가자 데이터가 비어있거나 잘못된 형식일 경우를 대비한 방어 코드
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

    // 1. 유효성 검사 실패 시, 에러 메시지와 함께 400 상태 코드를 반환합니다.
    if (!result.success) {
      const flashSession = await getFlashSession(request.headers.get("Cookie"));
    const error = result.error.flatten();
    // 가장 첫 번째 에러 메시지를 토스트로 보여줍니다.
    const firstErrorMessage = Object.values(error.fieldErrors).flat()[0] || error.formErrors[0] || '입력값이 올바르지 않습니다.';
    flashSession.flash("toast", { type: "error", message: firstErrorMessage });
    
    // 👇 json() 헬퍼 대신 new Response() 사용
    return json({ error: firstErrorMessage }, {
        status: 400,
        headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }
  
    
    // 유효성 검사를 통과한 안전한 데이터를 사용합니다.
    const { name, description, categoryId, isAllDay, startDate, endDate } = result.data;

    // 2. 이미지 파일 및 참가자 데이터는 별도로 처리합니다.
    const imageFiles = formData.getAll("images") as File[];
    


	try {
    const imageUrls = await uploadImages(imageFiles);
		// 3. 데이터베이스에 모든 정보를 한 번에 저장 (트랜잭션)
		await db.$transaction(async prisma => {
			// 3-1. 이벤트 생성
			const newEvent = await prisma.event.create({
				data: {
					name,
					description,
					images: {
            create: imageUrls.map(url => ({ url })),
          }, // imageUrl이 null일 수 있음
					isAllDay,
					startDate,
					endDate,
					 categoryId: Number(categoryId),
				},
			});
       const eventEndDate = newEvent.endDate;
			// 3-2. 참가자 처리 (기존 회원은 찾고, 신규 회원은 임시 회원으로 생성)
			 for (const p of participants) {
        
        
        let puserId: string;

        if (p.type === 'user') {
          puserId = p.id;
        } else if (p.type === 'temp-phone') {
          let user = await prisma.user.findUnique({ where: { phoneNumber: p.id } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                name: p.name,
                phoneNumber: p.id,
                status: "TEMPORARY",
              },
            });
          }
          puserId = user.id;
        } else { // 'temp-code'
          let expiresAt = new Date(eventEndDate);
          if (p.expiryOption === 'one_day') {
            expiresAt.setDate(expiresAt.getDate() + 1);
          } else if (p.expiryOption === 'three_days') {
            expiresAt.setDate(expiresAt.getDate() + 3);
          } else if (p.expiryOption === 'custom' && p.customExpiryDate) {
            expiresAt = new Date(p.customExpiryDate); // 이미 ISO String이므로 Date 객체로 변환
          }
          await prisma.claimableStamp.create({
            data: {
              claimCode: p.id,
              eventId: newEvent.id,
              expiresAt: expiresAt,       // 👈 계산된 유효기간 적용
              maxUses: p.maxUses,
              // maxUses는 스키마의 @default(1)에 따라 자동으로 1이 됨
            }
          });
          continue;// 스탬프 직접 발급 대신 임시 코드만 생성하고 넘어감
        }

				 // 1. 사용자의 진행 중인 스탬프 카드를 찾습니다.
        const userActiveCards = await prisma.stampCard.findMany({
              where: { userId: puserId, isRedeemed: false },
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
              const newCard = await prisma.stampCard.create({ data: { userId: puserId } });
              targetCardId = newCard.id;
            }

            // 4. 결정된 카드 ID로 스탬프를 적립합니다.
            await prisma.stampEntry.create({
              data: { userId: puserId, eventId: newEvent.id, stampCardId: targetCardId }
            });
            // 🚨 스탬프 카드 로직 수정 끝 🚨
        } // for 루프 끝

          });
    
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
    
    return json({ error: '이벤트 등록 중 오류가 발생했습니다.' }, {
        status: 500,
        headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }
};


export default function CreateEventPage() {
  const { categories } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  // 이제 UI는 EventForm 컴포넌트가 모두 처리합니다.
  return (
    <EventForm 
      fetcher={fetcher}
      categories={categories}
    />
  );
}