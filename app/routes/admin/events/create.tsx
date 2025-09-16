import { useEffect, useState } from 'react';
import { type LoaderFunctionArgs, json } from '@remix-run/node';
import {
	redirect,
	useFetcher,
	useLoaderData,
	useRevalidator,
	type ActionFunctionArgs,
} from 'react-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { db } from '~/lib/db.server';
import { Button } from '~/components/ui/button';
import {	Card,	CardContent,	CardDescription,	CardHeader,	CardTitle,} from '~/components/ui/card';
import {	Form,	FormControl,	FormDescription,	FormField,	FormItem,	FormLabel,	FormMessage,} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {	Select,	SelectContent,	SelectItem,	SelectTrigger,	SelectValue,} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { uploadImages } from "~/lib/upload.server";
import { commitSession, getFlashSession } from '~/lib/session.server';
import { toast } from 'sonner';
import { CategoryDialog } from './categoryDialog';
import { UploadCloud } from 'lucide-react';
import { ParticipantManager, type Participant } from './participantManager';

type LoaderData = {
	categories: { id: number; name: string }[];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const categories = await db.eventCategory.findMany();
	return json({ categories });
};

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
	
});



export const action = async ({ request }: ActionFunctionArgs) => {
	const formData = await request.formData();

	// 1. 이미지 파일 처리
	const imageFiles = formData.getAll("images") as File[];
  const imageUrls = await uploadImages(imageFiles);


	// 2. 텍스트 데이터 처리
	const name = formData.get('name') as string;
	const description = formData.get('description') as string;
	const categoryId = Number(formData.get('categoryId'));
	const isAllDay = formData.get('isAllDay') === 'true';
	const startDate = new Date(formData.get('startDate') as string);
	const endDate = new Date(formData.get('endDate') as string);

 const participantsJSON = formData.get("participants") as string;
 const participants: Participant[] = JSON.parse(participantsJSON);


	try {
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
					categoryId,
				},
			});

			// 3-2. 참가자 처리 (기존 회원은 찾고, 신규 회원은 임시 회원으로 생성)
			 for (const p of participants) {
        let userId: string;

        if (p.type === 'user') {
          userId = p.id;
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
          userId = user.id;
        } else { // 'temp-code'
          await prisma.claimableStamp.create({
              data: {
                  claimCode: p.id,
                  eventId: newEvent.id,
                  expiresAt: newEvent.endDate, // 이벤트 종료일까지 유효
              }
          });
          continue; // 스탬프 직접 발급 대신 임시 코드만 생성하고 넘어감
        }

				// 1. 사용자의 '진행 중인' (사용 완료되지 않은) 스탬프 카드를 찾습니다.
				let stampCard = await prisma.stampCard.findFirst({
					where: {
						userId: userId,
						isRedeemed: false,
					},
				});

				// 2. 진행 중인 카드가 없으면, 그 사용자를 위해 새로 만듭니다.
				if (!stampCard) {
            stampCard = await prisma.stampCard.create({ data: { userId } });
        }
        await prisma.stampEntry.create({
            data: { userId, eventId: newEvent.id, stampCardId: stampCard.id }
        });
      }

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
    console.log("이거에러?")
		console.error(error);
		return json(
			{ error: '이벤트 등록 중 오류가 발생했습니다.' },
			{ status: 500 },
		);
	}
};

export default function CreateEventPage() {
	const { categories } = useLoaderData<LoaderData>();
	const fetcher = useFetcher();
	const categoryFetcher = useFetcher();
	const revalidator = useRevalidator();
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [isCategoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); 
  const MAX_IMAGES = 10;
	const form = useForm<EventFormValues>({
		resolver: zodResolver(eventFormSchema),

		defaultValues: {
			name: '',
			description: '',
			categoryId: '',
			isAllDay: true,
			startDate: new Date(),
			endDate: new Date(),
			
			imageUrl: undefined,
		},
	});
type EventFormValues = Omit<z.infer<typeof eventFormSchema>, "participants">;
	useEffect(() => {
		if (categoryFetcher.state === 'idle' && categoryFetcher.data?.success) {
			setCategoryDialogOpen(false); // 다이얼로그 닫기
			revalidator.revalidate(); // loader를 다시 실행해서 카테고리 목록 새로고침
			toast.success('새로운 카테고리가 추가되었습니다!');
		}
	}, [categoryFetcher.state, categoryFetcher.data, revalidator]);
	// isAllDay 값의 변경을 감지
	const isAllDay = form.watch('isAllDay');

	const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      if (files.length + imagePreviews.length > MAX_IMAGES) {
        toast.error(`사진은 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
        return;
      }
      
      const newPreviews: string[] = [];
      // form에 파일 목록을 설정 (FileList는 직접 수정이 어려우므로 DataTransfer를 사용)
      const dataTransfer = new DataTransfer();
      // 기존 파일들 추가 (생략)
      
      Array.from(files).forEach(file => {
        newPreviews.push(URL.createObjectURL(file));
        dataTransfer.items.add(file);
      });

      setImagePreviews(prev => [...prev, ...newPreviews]);
      form.setValue("imageUrl", dataTransfer.files); // FileList를 form에 저장
    }
  };

	function onSubmit(data: EventFormValues) {
		const formData = new FormData();
		formData.append('name', data.name);
		if (data.description) formData.append('description', data.description);
		formData.append('categoryId', data.categoryId);
		formData.append('isAllDay', String(data.isAllDay));
		// toISOString()을 사용하여 시간 정보까지 정확하게 전달
		formData.append('startDate', data.startDate.toISOString());
		formData.append('endDate', data.endDate.toISOString());
		formData.append("participants", JSON.stringify(participants));

		// 이미지 파일이 선택된 경우에만 추가
	 const imageFiles = data.imageUrl as FileList | undefined;
    if (imageFiles) {
        Array.from(imageFiles).forEach(file => {
            formData.append("images", file); 
        })
    }

		fetcher.submit(formData, {
			method: 'post',
			encType: 'multipart/form-data',
		});
	}

	return (
		// ✨ [수정] 모바일 화면처럼 보이도록 최대 너비와 중앙 정렬, 패딩을 추가합니다.
		<div className="w-full max-w-md mx-auto p-4 sm:p-0">
			<Card>
				<CardHeader>
					<CardTitle>새 이벤트 등록</CardTitle>
					<CardDescription>
						새로운 이벤트를 만들고 참가자를 등록합니다.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="space-y-8"
						>
							{/* --- 폼 필드들 --- */}
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>이벤트 이름</FormLabel>
										<FormControl>
											<Input
												placeholder="예: 10월 스탬프 이벤트"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							 <FormField
              control={form.control}
              name="imageUrl"
              render={() => (
                <FormItem>
                  <FormLabel>대표 이미지 (최대 {MAX_IMAGES}장)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      {/* 이미지 미리보기 렌더링 */}
                      <div className="flex gap-2 flex-wrap">
                        {imagePreviews.map((src, index) => (
                          <div key={index} className="w-24 h-24 border rounded-lg">
                            <img src={src} alt={`미리보기 ${index + 1}`} className="w-full h-full object-cover rounded-lg"/>
                          </div>
                        ))}
                        {imagePreviews.length < MAX_IMAGES && (
                           <Label htmlFor="picture" className="w-24 h-24 border-dashed border-2 rounded-lg flex flex-col items-center justify-center bg-muted/40 cursor-pointer hover:bg-muted">
                            <UploadCloud className="h-8 w-8 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">사진 추가</span>
                          </Label>
                        )}
                      </div>
                      <Input
                        id="picture"
                        type="file"
                        accept="image/*"
                        multiple // 👈 여러 파일 선택 가능
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

							<FormField
								control={form.control}
								name="categoryId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>카테고리</FormLabel>
										<div className="flex gap-2">
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="카테고리를 선택하세요" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{categories &&
														categories.map(category => (
															<SelectItem
																key={category.id}
																value={String(category.id)}
															>
																{category.name}
															</SelectItem>
														))}
												</SelectContent>
											</Select>

											{/* 👇 기존 Dialog 코드를 새 컴포넌트로 교체 */}
											<CategoryDialog categories={categories} />
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="isAllDay"
								render={({ field }) => (
									<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
										<div className="space-y-0.5">
											<FormLabel className="text-base">하루 종일</FormLabel>
											<FormDescription>
												체크하면 날짜만, 체크 해제하면 시간까지
												선택합니다.
											</FormDescription>
										</div>
										<FormControl>
											<Switch
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>

							{/* --- ✨ [수정] 날짜 선택기를 항상 세로로 쌓이도록 flex-col을 사용합니다. --- */}
							<div className="flex flex-col gap-4">
								{/* --- 시작 날짜 --- */}
								<FormField
									control={form.control}
									name="startDate"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												시작 {isAllDay ? '날짜' : '날짜 및 시간'}
											</FormLabel>
											<FormControl>
												{/* 👇 Controller로 MUI 컴포넌트를 감싸줍니다. */}
												<Controller
													control={form.control}
													name="startDate"
													render={({ field: { onChange, value } }) => (
														<DateTimePicker
															value={value || null}
															onChange={onChange}
															ampm={true} // 24시간 표기
															label={
																isAllDay
																	? '날짜 선택'
																	: '날짜 및 시간 선택'
															}
															views={
																isAllDay
																	? ['year', 'month', 'day']
																	: [
																			'year','month','day',	'hours', 'minutes',
																	  ]
															}
															slotProps={{
																textField: {
																	fullWidth: true,
																	variant: 'outlined',
																	size: 'small',
																},
															}}
														/>
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								{/* --- 종료 날짜 --- */}
								<FormField
									control={form.control}
									name="endDate"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												종료 {isAllDay ? '날짜' : '날짜 및 시간'}
											</FormLabel>
											<FormControl>
												<Controller
													control={form.control}
													name="endDate"
													render={({ field: { onChange, value } }) => (
														<DateTimePicker
															value={value || null}
															onChange={onChange}
															ampm={false}
															label={
																isAllDay
																	? '날짜 선택'
																	: '날짜 및 시간 선택'
															}
															views={
																isAllDay
																	? ['year', 'month', 'day']
																	: [
																			'year','month',	'day','hours',	'minutes',
																	  ]
															}
															slotProps={{
																textField: {
																	fullWidth: true,
																	variant: 'outlined',
																	size: 'small',
																},
															}}
														/>
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>이벤트 설명</FormLabel>
										<FormControl>
											<Textarea
												placeholder="이벤트에 대한 설명을 입력하세요."
												className="resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormItem>
              <FormLabel>참가자</FormLabel>
              <ParticipantManager  participants={participants} setParticipants={setParticipants} />
              {participants.length === 0 && <p className="text-sm text-destructive">참가자를 한 명 이상 등록해주세요.</p>}
            </FormItem>

							<Button type="submit" className="w-full">
								이벤트 등록하기
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}