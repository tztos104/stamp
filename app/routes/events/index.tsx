// app/routes/events/index.tsx (서버 사이드 정렬로 수정)

import { useLoaderData, type LoaderFunctionArgs, redirect, Link, Form, useSearchParams } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "~/components/ui/pagination";
import { Search, Calendar, Star } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { getSession } from "~/lib/auth.server";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ko';

const EVENTS_PER_PAGE = 9;

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
  const sortBy = url.searchParams.get("sortBy") || "latest";

  const filterMyEvents = user.role === 'USER' || myEvents;
  // 👇 orderBy는 기본 정렬(최신순)만 사용합니다.
  const orderBy: Prisma.EventOrderByWithRelationInput = { createdAt: 'desc' };

  const where: Prisma.EventWhereInput = {
    AND: [
      q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }] } : {},
      categoryId && categoryId !== 'all' ? { categoryId: Number(categoryId) } : {},
      filterMyEvents ? { participants: { some: { userId: user.id } } } : {},
      startDate ? { endDate: { gte: new Date(startDate) } } : {},
      endDate ? { startDate: { lte: new Date(endDate) } } : {},
    ],
  };

  const [rawEvents, totalEvents, categories] = await db.$transaction([
    db.event.findMany({
      where,
      orderBy, // 기본 정렬 적용
      // 👇 페이지네이션은 코드 내에서 처리하므로 여기서는 모든 결과를 가져옵니다.
      // take와 skip은 잠시 후 코드에서 직접 처리합니다.
      include: {
        category: { select: { name: true } },
        images: { select: { url: true }, take: 1 },
        reviews: { select: { rating: true } },
        _count: { select: { participants: true } }, // 👈 인기순 정렬을 위해 _count 추가
      },
    }),
    db.event.count({ where }),
    db.eventCategory.findMany(),
  ]);

  let processedEvents = rawEvents.map(event => {
    const reviewCount = event.reviews.length;
    const totalRating = reviewCount > 0 ? event.reviews.reduce((sum, review) => sum + review.rating, 0) : 0;
    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    return { ...event, reviewCount, averageRating };
  });

  // 👇 데이터베이스가 아닌, 서버 코드에서 직접 정렬을 수행합니다.
  switch (sortBy) {
    case 'popular':
      processedEvents.sort((a, b) => b._count.participants - a._count.participants);
      break;
    case 'rating':
      processedEvents.sort((a, b) => b.averageRating - a.averageRating);
      break;
    // 'latest'는 이미 DB에서 정렬했으므로 별도 처리 필요 없음
  }

  // 👇 코드 내에서 페이지네이션 처리
  const paginatedEvents = processedEvents.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE);

  const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

  return { events: paginatedEvents, totalEvents, categories, page, totalPages, q, categoryId, myEvents, startDate, endDate, sortBy, userRole: user.role };
};


// --- UI 컴포넌트 (변경 없음) ---
export default function EventsIndexPage() {
  const { events, categories, page, totalPages, q, categoryId, myEvents, startDate: initialStartDate, endDate: initialEndDate, sortBy, userRole } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [isSearchVisible, setIsSearchVisible] = useState(!!q || !!categoryId || myEvents || !!initialStartDate || !!initialEndDate || sortBy !== 'latest');
  
  const [startDate, setStartDate] = useState<Dayjs | null>(initialStartDate ? dayjs(initialStartDate) : null);
  const [endDate, setEndDate] = useState<Dayjs | null>(initialEndDate ? dayjs(initialEndDate) : null);

  const getPageLink = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(p));
    return `/events?${newParams.toString()}`;
  };

  return (
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
            <input type="hidden" name="startDate" value={startDate ? startDate.format('YYYY-MM-DD') : ''} />
            <input type="hidden" name="endDate" value={endDate ? endDate.format('YYYY-MM-DD') : ''} />
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Input name="q" placeholder="이벤트 이름, 내용으로 검색..." defaultValue={q || ""} className="flex-grow" />
              <Select name="categoryId" defaultValue={categoryId || "all"}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="모든 카테고리" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select name="sortBy" defaultValue={sortBy || "latest"}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="popular">인기순</SelectItem>
                  <SelectItem value="rating">별점순</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
              {userRole !== 'USER' ? (
                <div className="flex items-center space-x-2">
                  <Checkbox id="my-events" name="myEvents" defaultChecked={myEvents} />
                  <Label htmlFor="my-events" className="cursor-pointer">내가 참여한 이벤트만 보기</Label>
                </div>
              ) : (
                // 'USER' 역할일 때는 공간을 차지하지 않도록 빈 div를 둡니다.
                <div></div>
              )}
              <Button type="submit" className="w-full sm:w-auto"><Search className="h-4 w-4 mr-2" /> 검색</Button>
            </div>
          </Form>
        )}

        {/* --- 이하 UI는 변경 없음 --- */}
        {events.length === 0 ? (
          <div className="text-center py-20 border-dashed border-2 rounded-lg">
            <h3 className="text-xl font-semibold">찾으시는 이벤트가 없습니다.</h3>
            <p className="text-muted-foreground mt-2">다른 검색어나 필터를 사용해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
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
                    <CardTitle className="text-lg font-bold line-clamp-2">{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1.5"/>
                        <span>{new Date(event.startDate).toLocaleDateString()}</span>
                      </div>
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

       {totalPages > 1 && (
        <Pagination className="mt-12">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={page > 1 ? getPageLink(page - 1) : undefined} />
            </PaginationItem>
            <PaginationItem>
              <span className="p-2 text-sm font-medium">{page} / {totalPages}</span>
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