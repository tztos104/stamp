// app/routes/admin/users/index.tsx

import { Link, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, useSearchParams } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "~/components/ui/pagination";
import { Badge } from "~/components/ui/badge";
import { Award, Calendar, CreditCard, Phone, Search, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import type { Prisma, Role, UserStatus } from "@prisma/client";
const USERS_PER_PAGE = 10;

// --- Loader: 사용자 목록을 검색/필터링/페이지네이션 기능과 함께 불러옵니다. ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const role = url.searchParams.get("role") as Role | 'all' || 'all';
  const status = url.searchParams.get("status") as UserStatus | 'all' || 'all';
  const page = parseInt(url.searchParams.get("page") || "1");

  const where: Prisma.UserWhereInput = {
    AND: [
      q ? {
        OR: [
          { name: { contains: q } },
          { phoneNumber: { contains: q.replace(/-/g, '') } },
        ],
      } : {},
      role !== 'all' ? { role: role } : {},
      status !== 'all' ? { status: status } : {},
    ],
  };

  const [rawUsers, totalUsers] = await db.$transaction([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * USERS_PER_PAGE,
      take: USERS_PER_PAGE,
      include: {
        _count: {
          select: { 
            eventEntries: true, 
            StampCard: true,
          }
        },
        StampCard: {
          include: {
            coupon: {
              select: { id: true }
            }
          }
        }
      }
    }),
    db.user.count({ where }),
  ]);

  const users = rawUsers.map(user => {
    const couponCount = user.StampCard.filter(card => card.coupon !== null).length;
    const { StampCard, ...rest } = user; 
    return { 
      ...rest, 
      couponCount,
      createdAtFormatted: format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko })
    };
  });

  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

  return { users, totalUsers, page, totalPages, q, role, status };
};

// --- Default 컴포넌트: 사용자 목록 UI ---
export default function AdminUsersPage() {
  const { users, totalUsers, page, totalPages, q, role, status } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const [isSearchVisible, setIsSearchVisible] = useState(!!q || role !== 'all' || status !== 'all'); 

  const getPageLink = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(p));
    return `/admin/users?${newParams.toString()}`;
  };
 const getRoleBadgeVariant = (userRole: Role|null) => {
    switch (userRole) {
      case "ADMIN": return "destructive"; 
      case "MEMBER": return "default";  
      case "USER": return "outline";    
      default: return "secondary";
    }
  };


   const getStatusBadgeVariant = (userStatus: UserStatus) => {
    switch (userStatus) {
      case "ACTIVE": return "secondary";     // 👈 UserStatus.ACTIVE 대신 문자열 "ACTIVE" 사용
      case "TEMPORARY": return "outline";  // 👈 UserStatus.TEMPORARY 대신 문자열 "TEMPORARY" 사용
      default: return "secondary";
    }
  };

 return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>사용자 관리</CardTitle>
              <CardDescription>총 {totalUsers}명의 사용자가 있습니다.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(prev => !prev)}>
              <Search className="h-5 w-5" />
              <span className="sr-only">검색창 열기/닫기</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* --- 검색 및 필터 UI --- */}
          {isSearchVisible && (
            <Form method="get" className="flex flex-col md:flex-row gap-2 mb-4 p-4 border rounded-lg bg-muted/50">
              <Input name="q" placeholder="이름, 전화번호로 검색..." defaultValue={q || ""} className="flex-grow" />
              <Select name="role" defaultValue={role || "all"}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="모든 역할" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 역할</SelectItem>
                 <SelectItem value="USER">일반사용자</SelectItem>
                  <SelectItem value="MEMBER">멤버</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                </SelectContent>
              </Select>
              <Select name="status" defaultValue={status || "all"}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="모든 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="ACTIVE">활성</SelectItem>
                  <SelectItem value="TEMPORARY">임시</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full md:w-auto"><Search className="h-4 w-4 mr-2" /> 검색</Button>
            </Form>
          )}

          {/* --- 사용자 목록 카드 --- */}
          {users.length === 0 ? (
            <div className="text-center py-20 border-dashed border-2 rounded-lg">
              <h3 className="text-lg font-semibold">검색 결과가 없습니다.</h3>
              <p className="text-sm text-muted-foreground mt-2">다른 검색어나 필터를 사용해보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {users.map((user) => (
                <Link to={`/admin/users/${user.id}`} key={user.id} className="block">
                  <Card className="h-full hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-6 w-6 text-primary" />
                        <CardTitle className="text-lg font-semibold">{user.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                        <Badge variant={getStatusBadgeVariant(user.status)}>{user.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 mr-2" />
                        <span>{user.phoneNumber.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>가입: {user.createdAtFormatted}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-2 border-t mt-3">
                        <div className="flex items-center">
                          <CreditCard className="h-4 w-4 mr-1.5" />
                          <span className="font-medium text-foreground">{user._count.StampCard}</span> 스탬프 카드
                        </div>
                        <div className="flex items-center">
                          <Award className="h-4 w-4 mr-1.5" />
                          {/* 🚨 loader에서 계산된 couponCount를 사용합니다. */}
                          <span className="font-medium text-foreground">{user.couponCount}</span> 쿠폰
                        </div>
                        <div className="flex items-center">
                          <Search className="h-4 w-4 mr-1.5" />
                          <span className="font-medium text-foreground">{user._count.eventEntries}</span> 이벤트 참여
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* --- 페이지네이션 --- */}
          {totalPages > 1 && (
            <Pagination className="mt-8">
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
        </CardContent>
      </Card>
    </div>
  );
}