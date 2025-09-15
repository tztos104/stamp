
import { useEffect, useState } from "react";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { redirect, useFetcher, useLoaderData, useRevalidator, type ActionFunctionArgs } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar as CalendarIcon, UploadCloud } from "lucide-react";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";

import { cn } from "~/lib/utils";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { uploadImage } from "~/lib/upload.server";
import { commitSession, getFlashSession } from "~/lib/session.server";
import { toast } from "sonner";
import { CategoryDialog } from "./categoryDialog";
import { format, getHours, getMinutes, setHours, setMinutes } from "date-fns";

type LoaderData = {
  categories: { id: number; name: string }[];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const categories = await db.eventCategory.findMany();
  return json({ categories });
};

// Zod 스키마 업데이트
const eventFormSchema = z.object({
  name: z.string().min(2, "이벤트 이름은 2글자 이상이어야 합니다."),
  description: z.string().optional(),
  imageUrl: z.any().optional(), // 파일 업로드는 클라이언트에서 처리 후 URL로 변환
  isAllDay: z.boolean(),
  categoryId:  z.string().min(1, "카테고리를 선택해주세요."),
  startDate: z.date().refine(date => date, {
    message: "시작 날짜를 선택해주세요.",
  }),
  endDate: z.date().refine(date => date, {
    message: "종료 날짜를 선택해주세요.",
  }),
  participants: z.string().min(1, "참가자 전화번호를 한 명 이상 입력해주세요."),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  // 1. 이미지 파일 처리
  const imageFile = formData.get("imageUrl") as File;
  const imageUrl = await uploadImage(imageFile);

  // 2. 텍스트 데이터 처리
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const categoryId = Number(formData.get("categoryId"));
  const isAllDay = formData.get("isAllDay") === 'true';
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const participants = (formData.get("participants") as string)
    .split("\n")
    .map(phone => phone.trim().replace(/-/g, ""))
    .filter(phone => phone.length > 0);
  
  try {
    // 3. 데이터베이스에 모든 정보를 한 번에 저장 (트랜잭션)
    await db.$transaction(async (prisma) => {
      // 3-1. 이벤트 생성
      const newEvent = await prisma.event.create({
        data: {
          name,
          description,
          imageUrl,
          isAllDay,
          startDate,
          endDate,
          categoryId,
        },
      });

      // 3-2. 참가자 처리 (기존 회원은 찾고, 신규 회원은 임시 회원으로 생성)
      for (const phone of participants) {
        let user = await prisma.user.findUnique({ where: { phoneNumber: phone } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              name: `임시회원-${phone.slice(-4)}`,
              phoneNumber: phone,
              status: "TEMPORARY",
            },
          });
        }
        
        // 3-3. 스탬프 발급 (StampEntry 생성)
        // (실제로는 사용자의 StampCard를 찾아 연결해야 하지만, 우선 단순화)
        // 이 부분은 나중에 스탬프 카드 로직을 만들 때 정교화해야 합니다.
        console.log(`'${user.name}'님에게 '${newEvent.name}' 이벤트 스탬프 발급 필요`);
      }
    });

    const flashSession = await getFlashSession(request.headers.get("Cookie"));
    flashSession.flash("toast", {
      type: "success",
      message: "이벤트가 성공적으로 등록되었습니다.",
    });

    return redirect("/admin", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  } catch (error) {
    console.error(error);
    return json({ error: "이벤트 등록 중 오류가 발생했습니다." }, { status: 500 });
  }
};

export default function CreateEventPage() {
  const { categories } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const categoryFetcher = useFetcher();
  const revalidator = useRevalidator();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCategoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      isAllDay: true,
      startDate: new(Date),
      endDate:new(Date),
      participants: "",
      imageUrl: undefined,
    },
  });

  useEffect(() => {
    if (categoryFetcher.state === 'idle' && categoryFetcher.data?.success) {
      setCategoryDialogOpen(false); // 다이얼로그 닫기
      revalidator.revalidate();     // loader를 다시 실행해서 카테고리 목록 새로고침
      toast.success("새로운 카테고리가 추가되었습니다!");
    }
  }, [categoryFetcher.state, categoryFetcher.data, revalidator]);
  // isAllDay 값의 변경을 감지
  const isAllDay = form.watch("isAllDay");

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setImagePreview(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };
    // 시간 선택을 처리하는 함수
  const handleTimeChange = (date: Date | undefined, time: string, field: 'startDate' | 'endDate') => {
    if (!date) return;
    const [hours, minutes] = time.split(':').map(Number);
    let newDate = setHours(date, hours);
    newDate = setMinutes(newDate, minutes);
    form.setValue(field, newDate, { shouldValidate: true });
  };
  
  // 시간/분 옵션을 생성하는 헬퍼
  const timeOptions = (interval: number, max: number) => {
    return Array.from({ length: max / interval }, (_, i) => {
        const value = String(i * interval).padStart(2, '0');
        return <SelectItem key={value} value={value}>{value}</SelectItem>;
    });
  };
   function onSubmit(data: EventFormValues) {
        const formData = new FormData();
        formData.append("name", data.name);
        if (data.description) formData.append("description", data.description);
        formData.append("categoryId", data.categoryId);
        formData.append("isAllDay", String(data.isAllDay));
        formData.append("startDate", data.startDate.toDateString());
        formData.append("endDate", data.endDate.toDateString());
        formData.append("participants", data.participants);
        
        // 이미지 파일이 선택된 경우에만 추가
        const imageFile = data.imageUrl?.[0];
        if (imageFile) {
            formData.append("imageUrl", imageFile);
        }
        
        fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
    }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 이벤트 등록</CardTitle>
        <CardDescription>
          새로운 이벤트를 만들고 참가자를 등록합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* --- 폼 필드들 --- */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이벤트 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 10월 스탬프 이벤트" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>대표 이미지</FormLabel>
                  <FormControl>
                     <div className="flex items-center gap-4">
                      <div className="w-32 h-32 border-dashed border-2 rounded-lg flex items-center justify-center bg-muted/40">
                        {imagePreview ? (
                          <img src={imagePreview} alt="이미지 미리보기" className="w-full h-full object-cover rounded-lg"/>
                        ) : (
                          <UploadCloud className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                       <Input id="picture" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                       <Button asChild variant="outline">
                         <Label htmlFor="picture">이미지 선택</Label>
                       </Button>
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
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="카테고리를 선택하세요" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories && categories.map((category) => (
                                                    <SelectItem key={category.id} value={String(category.id)}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* 👇 기존 Dialog 코드를 새 컴포넌트로 교체 */}
                                         <CategoryDialog         categories={categories}           />

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
                                체크하면 날짜만, 체크 해제하면 시간까지 선택합니다.
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

             {/* --- 새로운 날짜 및 시간 선택 UI --- */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* --- 시작 날짜 --- */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>시작 {isAllDay ? '날짜' : '날짜 및 시간'}</FormLabel>
                    <FormControl>
                      {/* 👇 Controller로 MUI 컴포넌트를 감싸줍니다. */}
                      <Controller
                        control={form.control}
                        name="startDate"
                        render={({ field: { onChange, value } }) => (
                          <DateTimePicker
                            value={value || null}
                            onChange={onChange}
                            ampm={false} // 24시간 표기
                            label={isAllDay ? "날짜 선택" : "날짜 및 시간 선택"}
                            views={isAllDay ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hours', 'minutes']}
                            slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
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
                    <FormLabel>종료 {isAllDay ? '날짜' : '날짜 및 시간'}</FormLabel>
                    <FormControl>
                      <Controller
                        control={form.control}
                        name="endDate"
                        render={({ field: { onChange, value } }) => (
                           <DateTimePicker
                            value={value || null}
                            onChange={onChange}
                            ampm={false}
                            label={isAllDay ? "날짜 선택" : "날짜 및 시간 선택"}
                            views={isAllDay ? ['year', 'month', 'day'] : ['year', 'month', 'day', 'hours', 'minutes']}
                            slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
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
             
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이벤트 설명</FormLabel>
                  <FormControl>
                    <Textarea placeholder="이벤트에 대한 설명을 입력하세요." className="resize-none" {...field}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
             
              name="participants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>참가자 전화번호</FormLabel>
                  <FormControl>
                    <Textarea placeholder="전화번호를 한 줄에 하나씩 입력해주세요. (예: 01012345678)" {...field} />
                  </FormControl>
                  <FormDescription>
                    각 전화번호는 줄바꿈으로 구분합니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">이벤트 등록하기</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}