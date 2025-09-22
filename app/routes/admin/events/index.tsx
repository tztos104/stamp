// app/routes/admin/events/_index.tsx (최종 기능 완성본)


import { Link, useLoaderData, Form, useSearchParams,useFetcher, useNavigate, type LoaderFunctionArgs } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { MoreHorizontal, PlusCircle, Users, Calendar, Search, Package } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Prisma } from "@prisma/client";
import { useState } from "react";
import { Checkbox } from "~/components/ui/checkbox"; // 👈 Checkbox 추가
import { Label } from "~/components/ui/label"; 
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // 👈 DatePicker로 다시 변경
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ko'; 
const EVENTS_PER_PAGE = 6;

// loader 함수가 검색, 정렬, 필터링, 페이지네이션을 모두 처리하도록 업그레이드
export const loader = async ({ request }: LoaderFunctionArgs) => {

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const categoryId = url.searchParams.get("categoryId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const searchType = url.searchParams.get("type") || "event"; // 'event' or 'participant'
  const searchStartDateParam = url.searchParams.get("searchStartDate");
  const searchEndDateParam = url.searchParams.get("searchEndDate");

  const searchStartDate = searchStartDateParam ? dayjs(searchStartDateParam).toDate() : undefined;
  const searchEndDate = searchEndDateParam ? dayjs(searchEndDateParam).toDate() : undefined;

  const where: Prisma.EventWhereInput = {
    // 👇 검색 로직을 searchType에 따라 분기 처리합니다.
    AND: [
      q ? (
        searchType === 'participant'
          ? { participants: { some: { user: { name: { contains: q } } } } }
          : { OR: [{ name: { contains: q } }, { description: { contains: q } }] }
      ) : {},
      categoryId && categoryId !== 'all' ? { categoryId: Number(categoryId) } : {},
       searchStartDate ? { startDate: { gte: searchStartDate } } : {},
      searchEndDate ? { endDate: { lte: searchEndDate } } : {},
    ],
  };

  const [events, totalEvents, categories] = await db.$transaction([
    db.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * EVENTS_PER_PAGE,
      take: EVENTS_PER_PAGE,
      include: {
        category: true,
        images: { take: 1 },
        _count: { select: { participants: true, claimableStamps: true } },
        participants: {
            select: {
                user: {
                    select: { id: true, name: true }
                }
            },
            take: 5 // 카드에 보여줄 최대 참가자 수 (예: 5명)
        }
      },
    }),
    db.event.count({ where }),
    db.eventCategory.findMany(),
  ]);
 
  const totalPages = Math.ceil(totalEvents / EVENTS_PER_PAGE);

  return { events, totalEvents, categories, page, totalPages, q, categoryId, searchType,
    searchStartDate: searchStartDateParam || undefined, // 문자열 원본 그대로 반환 (dayjs 초기화에 사용)
    searchEndDate: searchEndDateParam || undefined,    
   };
};


export default function EventListPage() {
  const { events, totalEvents, categories, page, totalPages, q, categoryId, searchType ,searchStartDate: initialSearchStartDate, 
    searchEndDate: initialSearchEndDate } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
   const [isSearchVisible, setIsSearchVisible] = useState(
    !!q || !!categoryId || !!initialSearchStartDate || !!initialSearchEndDate // 검색 조건이 있을 경우 기본으로 검색창 열림
  );
const [startDate, setStartDate] = useState<Dayjs | null>(
    initialSearchStartDate ? dayjs(initialSearchStartDate) : null
  );
  const [endDate, setEndDate] = useState<Dayjs | null>(
    initialSearchEndDate ? dayjs(initialSearchEndDate) : null
  );
  // 페이지네이션 링크를 위한 함수
  const getPageLink = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(p));
    return `/admin/events?${newParams.toString()}`;
  };
 
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ko">
    <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>이벤트 관리</CardTitle>
              <CardDescription  className="text-xs">
                총 {totalEvents}개의 이벤트가 있습니다.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(prev => !prev)}>
                <Search className="h-5 w-5" />
                <span className="sr-only">검색창 열기/닫기</span>
              </Button>
              <Button asChild>
                <Link to="/admin/events/create"><PlusCircle className="h-4 w-4 mr-2" /> 새 이벤트</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* --- 검색 및 필터 UI --- */}
          {isSearchVisible && (
            <Form method="get" className="flex flex-col sm:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
               <input type="hidden" name="searchStartDate" value={startDate ? startDate.format('YYYY-MM-DD') : ''} />
                <input type="hidden" name="searchEndDate" value={endDate ? endDate.format('YYYY-MM-DD') : ''} />
              <Select name="type" defaultValue={searchType}>
                <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">이벤트</SelectItem>
                  <SelectItem value="participant">참가자</SelectItem>
                </SelectContent>
              </Select>
              <Input name="q" placeholder="검색어 입력..." defaultValue={q || ""} className="flex-grow"/>
              <Select name="categoryId" defaultValue={categoryId || "all"}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="모든 카테고리" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <div className="flex flex-col sm:flex-row items-center gap-2">
                  <DatePicker
                    label="시작일"
                    value={startDate}
                    onChange={(newValue) => setStartDate(newValue as Dayjs)}
                    format="YYYY년 MM월 DD일"
                    slotProps={{ 
                      textField: { 
                        size: 'small', 
                        fullWidth: true, 
                        sx: {
                          '& .MuiInputBase-root': {
                            borderRadius: '0.375rem', // rounded-md
                            borderColor: '#e2e8f0', // border-gray-200
                            height: '40px', // Input 높이 조정
                            '&.Mui-focused': {
                              borderColor: '#2563eb', // border-blue-600 focus
                              boxShadow: '0 0 0 1px #2563eb',
                            },
                          },
                          '& .MuiInputBase-input': {
                            padding: '8px 14px', // 내부 패딩 조정
                          },
                          '& .MuiInputAdornment-root': {
                            marginRight: '0px',
                          }
                        }
                      } 
                    }}
                  />
                  <span className="hidden sm:inline">-</span>
                  <DatePicker
                    label="종료일"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue as Dayjs)}
                    format="YYYY년 MM월 DD일"
                    slotProps={{ 
                      textField: { 
                        size: 'small', 
                        fullWidth: true, 
                        sx: {
                          '& .MuiInputBase-root': {
                            borderRadius: '0.375rem', // rounded-md
                            borderColor: '#e2e8f0', // border-gray-200
                            height: '40px', // Input 높이 조정
                            '&.Mui-focused': {
                              borderColor: '#2563eb', // border-blue-600 focus
                              boxShadow: '0 0 0 1px #2563eb',
                            },
                          },
                          '& .MuiInputBase-input': {
                            padding: '8px 14px', // 내부 패딩 조정
                          },
                          '& .MuiInputAdornment-root': {
                            marginRight: '0px',
                          }
                        }
                      } 
                    }}
                  />
                </div>
                
              <Button type="submit" className="w-full sm:w-auto"><Search className="h-4 w-4 mr-2"/> 검색</Button>
            </Form>
          )}

          {/* --- 이벤트 목록 --- */}
          {events.length === 0 ? (
            <div className="text-center py-20 border-dashed border-2 rounded-lg">
              <h3 className="text-lg font-semibold">검색 결과가 없습니다.</h3>
              <p className="text-sm text-muted-foreground mt-2">다른 검색어나 필터를 사용해보세요.</p>
            </div>
          ) : (
            // 👇 다중 컬럼 그리드를 단순한 세로 스택으로 변경
            <div className="space-y-4">
               {events.map((event) => {
                const totalParticipants = event._count.participants + event._count.claimableStamps;
                return (
                 
                    <Card  key={event.id} className="transition-all group-hover:bg-muted/50 group-hover:shadow-md  relative group">
                       

                       <div className="flex items-start p-4 gap-4">
                        
                        <div className="w-24 h-24 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {event.images[0]?.url ? (
                            <img src={event.images[0].url} alt={event.name} className="w-full h-full object-cover"/>
                          ) : (
                            <Package className="h-10 w-10 text-muted-foreground"/>
                          )}
                        </div>
                        
                        <div className="flex-1 grid gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{event.category.name}</Badge>
                            <p className="font-semibold text-sm leading-tight group-hover:underline">{event.name}</p>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4 mr-2"/>
                            <span>{format(new Date(event.startDate), "yyyy.MM.dd")}</span>
                          </div>
                          <div className="flex items-start text-sm text-muted-foreground">
                            <Users className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0"/>
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {event.participants.map(({ user }) => (
                                  <Badge key={user.id} variant="secondary" className="text-xs">{user.name}</Badge>
                                ))}
                                {totalParticipants > 5 && <span className="text-xs self-center"> 등</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                    {/* 3. 수정/삭제 메뉴 (오른쪽) */}
                    <div className="absolute top-2 right-2 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>작업</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => navigate(`/admin/events/${event.id}/edit`)}>
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DeleteEventDialog event={event} />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <Link to={`/admin/events/${event.id}`} className="absolute inset-0 z-0">
                      <span className="sr-only">{event.name} 상세 보기</span>
                    </Link>

                </Card>
                
              );
            })}
            </div>
          )}

          {/* --- 페이지네이션 --- */}
          {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              {page <= 1 ? (
                // 비활성화 상태일 때는 클릭할 수 없는 버튼 모양의 span을 보여줍니다.
                <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 opacity-50 cursor-not-allowed">
                  <PaginationPrevious size="sm" />
                </span>
              ) : (
                // 활성화 상태일 때만 링크를 가진 컴포넌트를 보여줍니다.
                <PaginationPrevious href={getPageLink(page - 1)} size="sm" />
              )}
            </PaginationItem>

            <PaginationItem>
                <span className="p-2 text-sm font-medium">
                  {page} / {totalPages}
                </span>
            </PaginationItem>
            
            <PaginationItem>
              {page >= totalPages ? (
                // 비활성화 상태일 때
                <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 opacity-50 cursor-not-allowed">
                  <PaginationNext size="sm" />
                </span>
              ) : (
                // 활성화 상태일 때
                <PaginationNext href={getPageLink(page + 1)} size="sm" />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
        </CardContent>
      </Card>
    </div>
    </LocalizationProvider>
  );
}

// 👇 삭제 다이얼로그를 별도의 컴포넌트로 분리하여 관리
function DeleteEventDialog({ event }: {event: any}) {
    const [isForceChecked, setIsForceChecked] = useState(false);
    const fetcher = useFetcher<{ error?: string }>();
    const errorMessage = fetcher.data?.error;
    const isSubmitting = fetcher.state !== 'idle';
    return (
        <AlertDialog onOpenChange={() => setIsForceChecked(false)}>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                    삭제
                </DropdownMenuItem>
            </AlertDialogTrigger>
             <AlertDialogContent>
                {/* 👇 fetcher.Form을 사용하여 페이지 이동 없이 통신합니다. */}
                <fetcher.Form method="post" action="/api/events/delete">
                    <input type="hidden" name="eventId" value={event.id} />
                    {isForceChecked && <input type="hidden" name="force" value="true" />}
                    
                    <AlertDialogHeader>
                        <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            '{event.name}' 이벤트가 영구적으로 삭제됩니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* 👇 에러 메시지를 다이얼로그 안에 직접 표시합니다. */}
                    {errorMessage && (
                        <div className="my-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
                            {errorMessage}
                        </div>
                    )}

                    <div className="flex items-center space-x-2 my-4">
                        <Checkbox id={`force-delete-${event.id}`} checked={isForceChecked} onCheckedChange={(checked) => setIsForceChecked(!!checked)} />
                        <Label htmlFor={`force-delete-${event.id}`} className="text-sm font-medium leading-none text-destructive">
                            관련된 모든 참가 기록도 함께 삭제합니다. (주의!)
                        </Label>
                    </div>
                    
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <Button type="submit" variant={isForceChecked ? "destructive" : "default"} disabled={isSubmitting}>
                            {isSubmitting ? "삭제 중..." : (isForceChecked ? "강제 삭제" : "삭제")}
                        </Button>
                    </AlertDialogFooter>
                </fetcher.Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
