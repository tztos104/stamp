// app/routes/events._index.tsx
import { useLoaderData, type LoaderFunctionArgs, redirect, Link, Form, useSearchParams } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Search, Calendar, Star } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { getSession } from "~/lib/auth.server";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

// 👇 MUI Date Picker 및 dayjs 관련 import (DatePicker로 다시 변경)
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // 👈 DatePicker로 다시 변경
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ko'; // 👈 dayjs 한국어 로케일 import

const EVENTS_PER_PAGE = 9;

// --- Loader 함수 (변경 없음, 이전과 동일) ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return redirect("/login?redirectTo=/events");
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const categoryId = url.searchParams.get("categoryId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const myEvents = url.searchParams.get("myEvents") === "on";
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const where: Prisma.EventWhereInput = {
    AND: [
      q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {},
      categoryId && categoryId !== 'all' ? { categoryId: Number(categoryId) } : {},
      myEvents ? { participants: { some: { userId: user.id } } } : {},
      startDate ? { endDate: { gte: new Date(startDate) } } : {},
      endDate ? { startDate: { lte: new Date(endDate) } } : {},
    ],
  };

  const [rawEvents, totalEvents, categories] = await db.$transaction([
    db.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * EVENTS_PER_PAGE,
      take: EVENTS_PER_PAGE,
      include: {
        category: { select: { name: true } },
        images: { select: { url: true }, take: 1 },
        reviews: { select: { rating: true } },
      },
    }),
    db.event.count({ where }),
    db.eventCategory.findMany(),
  ]);

 const events = rawEvents.map(event => {
    const reviewCount = event.reviews.length;
    if (reviewCount === 0) {
      return { ...event, reviewCount: 0, averageRating: 0 };
    }
    const totalRating = event.reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviewCount;
    return { ...event, reviewCount, averageRating };
  });
  const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

  return { events, totalEvents, categories, page, totalPages, q, categoryId, myEvents, startDate, endDate };
};

// --- Default 컴포넌트 (DatePicker 2개 사용 및 한국어 적용) ---
export default function EventsIndexPage() {
  const { events, totalEvents, categories, page, totalPages, q, categoryId, myEvents, startDate: initialStartDate, endDate: initialEndDate } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [isSearchVisible, setIsSearchVisible] = useState(!!q || !!categoryId || myEvents || !!initialStartDate || !!initialEndDate);
  
  // 👇 두 개의 DatePicker 상태를 따로 관리
  const [startDate, setStartDate] = useState<Dayjs | null>(initialStartDate ? dayjs(initialStartDate) : null);
  const [endDate, setEndDate] = useState<Dayjs | null>(initialEndDate ? dayjs(initialEndDate) : null);

  const getPageLink = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(p));
    return `/events?${newParams.toString()}`;
  };

  return (
    // 👇 adapterLocale="ko"를 추가하여 달력을 한국어로 설정
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
      <div className="container mx-auto max-w-7xl py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-extrabold">모든 이벤트</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(prev => !prev)}>
            <Search className="h-6 w-6" />
          </Button>
        </div>

        {isSearchVisible && (
          <Form method="get" className="flex flex-col gap-4 mb-8 p-4 border rounded-lg bg-muted/50">
            {/* 👇 숨겨진 input 필드를 통해 DatePicker의 값을 Form으로 전송합니다. */}
            <input type="hidden" name="startDate" value={startDate ? startDate.format('YYYY-MM-DD') : ''} />
            <input type="hidden" name="endDate" value={endDate ? endDate.format('YYYY-MM-DD') : ''} />
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Input name="q" placeholder="이벤트 이름, 내용으로 검색..." defaultValue={q || ""} className="flex-grow" />
              <Select name="categoryId" defaultValue={categoryId || "all"}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="모든 카테고리" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 👇 두 개의 DatePicker를 사용 */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <DatePicker
                label="시작일"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue as Dayjs)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <span className="hidden sm:inline">-</span>
              <DatePicker
                label="종료일"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue as Dayjs)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="my-events" name="myEvents" defaultChecked={myEvents} />
                <Label htmlFor="my-events" className="cursor-pointer">내가 참여한 이벤트만 보기</Label>
              </div>
              <Button type="submit" className="w-full sm:w-auto"><Search className="h-4 w-4 mr-2" /> 검색</Button>
            </div>
          </Form>
        )}

        {/* --- 이벤트 목록 (이하 동일) --- */}
        {events.length === 0 ? (
          <div className="text-center py-20 border-dashed border-2 rounded-lg">
            <h3 className="text-xl font-semibold">찾으시는 이벤트가 없습니다.</h3>
            <p className="text-muted-foreground mt-2">다른 검색어나 필터를 사용해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1  gap-6">
            {events.map((event) => (
              <Link to={`/events/${event.id}`} key={event.id} className="block">
                <Card className="h-full flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  {event.images[0]?.url && (
                    <img
                      src={event.images[0].url}
                      alt={event.name}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                  )}
                  <CardHeader className="flex-grow pb-2"> 
                    <Badge className="w-fit mb-2">{event.category.name}</Badge>
                    <CardTitle className="text-2xl font-bold line-clamp-2">{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* 👇 날짜와 리뷰 정보를 함께 표시하는 flex 컨테이너 */}
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1.5"/>
                        <span>{new Date(event.startDate).toLocaleDateString()}</span>
                      </div>
                      {/* 👇 리뷰가 있을 때만 별점과 개수를 표시 */}
                      {event.reviewCount > 0 && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 mr-1 text-yellow-400 fill-yellow-400"/>
                          <span className="font-bold text-slate-700">{event.averageRating.toFixed(1)}</span>
                          <span className="ml-1">({event.reviewCount})</span>
                        </div>
                      )}
                    </div>
               
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

      {/* --- 페이지네이션 (이하 동일) --- */}
       {totalPages > 1 && (
        <Pagination className="mt-12">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={page > 1 ? getPageLink(page - 1) : undefined} />
            </PaginationItem>
            <PaginationItem>
              <span className="p-2 text-sm font-medium">
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href={page < totalPages ? getPageLink(page + 1) : undefined} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
    </LocalizationProvider>
  );
}