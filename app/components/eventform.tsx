// app/components/EventForm.tsx

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { CategoryDialog } from "~/components/categoryDialog"; // 경로 확인 필요
import { ParticipantManager, type Participant } from "./participantManager"; // 경로 확인 필요

// Zod 스키마
const eventFormSchema = z.object({
    name: z.string().min(2, '이벤트 이름은 2글자 이상이어야 합니다.'),
    description: z.string().optional(),
    newImages: z.any().optional(),// 파일 업로드는 클라이언트에서 처리 후 URL로 변환
    isAllDay: z.boolean(),
    categoryId: z.string().min(1, '카테고리를 선택해주세요.'),
    startDate: z.date().refine(date => date, {
        message: '시작 날짜를 선택해주세요.',
    }),
     endDate: z.date(),
}).refine(data => data.endDate >= data.startDate, {
    message: "종료일은 시작일보다 빠를 수 없습니다.",
    path: ["endDate"],
});
type EventFormValues = z.infer<typeof eventFormSchema>;
type EventImage = { id: number; url: string; eventId: string };
// 폼의 props 타입을 정의합니다.
type EventFormProps = {
    fetcher: any;
    categories: { id: number; name: string }[];
    defaultValues?: any; // 수정 시 사용할 기존 이벤트 데이터
}

export function EventForm({ fetcher, categories, defaultValues }: EventFormProps) {
    const isEditing = !!defaultValues; // defaultValues가 있으면 수정 모드
    
    const [existingImages, setExistingImages] = useState<EventImage[]>([]);
    const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const MAX_IMAGES = 10;

    const form = useForm<EventFormValues>({
        resolver: zodResolver(eventFormSchema),
        defaultValues: isEditing ? {
            ...defaultValues,
            startDate: new Date(defaultValues.startDate),
            endDate: new Date(defaultValues.endDate),
            categoryId: String(defaultValues.categoryId),
        } : {
            name: '',
            description: '',
            categoryId: '',
            isAllDay: true,
            startDate: new Date(),
            endDate: new Date(),
        },
    });

    // 수정 모드일 때, 이미지와 참가자 목록의 초기 상태를 설정합니다.
useEffect(() => {
        if (isEditing && defaultValues?.participants) {
            setParticipants(defaultValues.participants);
        }
    }, [isEditing, defaultValues]);

    const isAllDay = form.watch("isAllDay");

    const handleNewImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        const totalImages = existingImages.length + newImageFiles.length + files.length;
        if (totalImages > MAX_IMAGES) {
            toast.error(`사진은 최대 ${MAX_IMAGES}장까지 업로드할 수 있습니다.`);
            return;
        }

        const previews = files.map(file => URL.createObjectURL(file));
        setNewImageFiles(prev => [...prev, ...files]);
        setNewImagePreviews(prev => [...prev, ...previews]);
    };
     const handleDeleteExistingImage = (idToDelete: number) => {
        setExistingImages(prev => prev.filter(img => img.id !== idToDelete));
    };

    const handleDeleteNewImage = (indexToDelete: number) => {
        setNewImageFiles(prev => prev.filter((_, i) => i !== indexToDelete));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== indexToDelete));
    };

    function onSubmit(data: EventFormValues) {
        if (participants.length === 0) {
            toast.error("참가자를 한 명 이상 등록해주세요.");
            return;
        }

        const formData = new FormData();
        formData.append('name', data.name);
        if (data.description) formData.append('description', data.description);
        formData.append('categoryId', data.categoryId);
        formData.append('isAllDay', String(data.isAllDay));
        formData.append('startDate', data.startDate.toISOString());
        formData.append('endDate', data.endDate.toISOString());
        formData.append("participants", JSON.stringify(participants));

         if (isEditing) {
            // "기존 이미지 중 살아남은 것들의 ID 목록"을 전송
            const existingImageIds = existingImages.map(img => img.id);
            formData.append('existingImageIds', JSON.stringify(existingImageIds));

            // "새로 추가된 파일 목록"을 'newImages' key로 전송
            newImageFiles.forEach(file => {
                formData.append('newImages', file);
            });
        } else {
            // (신규 등록) 'images' key로 모든 파일을 전송
             newImageFiles.forEach(file => {
                formData.append('images', file);
            });
        }

        fetcher.submit(formData, {
            method: 'post',
            encType: 'multipart/form-data',
        });
    }
 const totalImageCount = existingImages.length + newImageFiles.length;
    return (
        <div className="w-full max-w-2xl mx-auto p-4 sm:p-0">
            <Card>
                <CardHeader>
                    <CardTitle>{isEditing ? "이벤트 수정" : "새 이벤트 등록"}</CardTitle>
                    <CardDescription>
                        {isEditing ? "이벤트 정보를 수정합니다." : "새로운 이벤트를 만들고 참가자를 등록합니다."}
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
            name="newImages"
            render={() => (
                <FormItem>
                    <FormLabel>대표 이미지 (최대 {MAX_IMAGES}장)</FormLabel>
                    <FormControl>
                        <div className="flex items-center gap-4">
                            <div className="flex gap-2 flex-wrap">
                                {/* 기존 이미지 렌더링 */}
                                {existingImages.map((image) => (
                                    <div key={image.id} className="w-24 h-24 border rounded-lg relative group">
                                        <img src={image.url} alt={`기존 이미지 ${image.id}`} className="w-full h-full object-cover rounded-lg"/>
                                        <button type="button" onClick={() => handleDeleteExistingImage(image.id)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                {/* 새로운 이미지 미리보기 렌더링 */}
                                {newImagePreviews.map((src, index) => (
                                    <div key={src} className="w-24 h-24 border rounded-lg relative group">
                                        <img src={src} alt={`미리보기 ${index + 1}`} className="w-full h-full object-cover rounded-lg"/>
                                         <button type="button" onClick={() => handleDeleteNewImage(index)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                {/* 사진 추가 버튼 */}
                                {totalImageCount < MAX_IMAGES && (
                                    <Label htmlFor="picture" className="w-24 h-24 border-dashed border-2 rounded-lg flex flex-col items-center justify-center bg-muted/40 cursor-pointer hover:bg-muted">
                                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground mt-1">사진 추가</span>
                                    </Label>
                                )}
                            </div>
                            <Input id="picture" type="file" accept="image/*" multiple onChange={handleNewImageChange} className="hidden" />
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
                                                    {categories && categories.map(category => (
                                                        <SelectItem key={category.id} value={String(category.id)}>
                                                            {category.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                                            <FormDescription>체크하면 날짜만, 체크 해제하면 시간까지 선택합니다.</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={() => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>시작 {isAllDay ? '날짜' : '날짜 및 시간'}</FormLabel>
                                            <FormControl>
                                                <Controller
                                                    control={form.control}
                                                    name="startDate"
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
                                <FormField
                                    control={form.control}
                                    name="endDate"
                                    render={() => (
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
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>이벤트 설명</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="이벤트에 대한 설명을 입력하세요." className="resize-none" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormItem>
                                <FormLabel>참가자</FormLabel>
                                <ParticipantManager participants={participants} setParticipants={setParticipants} />
                                {/* Zod 스키마에서 participants를 제거했으므로, FormMessage 대신 수동으로 에러 메시지를 표시할 수 있습니다. */}
                            </FormItem>

                            <Button type="submit" className="w-full" disabled={fetcher.state !== 'idle'}>
                                {fetcher.state !== 'idle' ? (isEditing ? '수정 중...' : '등록 중...') : (isEditing ? '이벤트 수정하기' : '이벤트 등록하기')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}