// app/routes/admin/coupons._index.tsx

import { type LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData, Form, Link, useSearchParams, useFetcher } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "~/components/ui/pagination";
import { Badge } from "~/components/ui/badge";
import { Search, Ticket } from "lucide-react";
import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Switch } from "~/components/ui/switch";

const COUPONS_PER_PAGE = 10;

// ----------------------------------------------------
// 1. Loader 함수: 모든 쿠폰 목록을 검색/필터링/페이지네이션 기능과 함께 불러옵니다.
// ----------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status"); // 'used', 'not_used', or 'all'
  const page = parseInt(url.searchParams.get("page") || "1");

  const where: Prisma.CouponWhereInput = {
    AND: [
      q ? {
        OR: [
          { code: { contains: q } }, // 쿠폰 코드로 검색
          { stampCard: { user: { name: { contains: q } } } }, // 사용자 이름으로 검색
        ],
      } : {},
      status === 'used' ? { isUsed: true } : {},
      status === 'not_used' ? { isUsed: false } : {},
    ],
  };

  const [coupons, totalCoupons] = await db.$transaction([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * COUPONS_PER_PAGE,
      take: COUPONS_PER_PAGE,
      include: {
        stampCard: {
          include: {
            user: { select: { name: true } }, // 쿠폰 소유자 이름
          },
        },
      },
    }),
    db.coupon.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCoupons / COUPONS_PER_PAGE);

  return { coupons, totalCoupons, page, totalPages, q, status };
};

// ----------------------------------------------------
// 2. Default 컴포넌트: 쿠폰 목록 UI 렌더링
// ----------------------------------------------------
export default function AdminCouponsPage() {
  const { coupons, totalCoupons, page, totalPages, q, status } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const getPageLink = (p: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(p));
    return `/admin/coupons?${newParams.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>쿠폰 관리</CardTitle>
          <CardDescription>총 {totalCoupons}개의 쿠폰이 발급되었습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* --- 검색 및 필터 UI --- */}
          <Form method="get" className="flex flex-col sm:flex-row gap-2 mb-4">
            <Input name="q" placeholder="쿠폰 코드, 사용자 이름 검색..." defaultValue={q || ""} className="flex-grow" />
            <Select name="status" defaultValue={status || "all"}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="모든 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="not_used">미사용</SelectItem>
                <SelectItem value="used">사용 완료</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit"><Search className="h-4 w-4 mr-2" /> 검색</Button>
          </Form>

          {/* --- 쿠폰 목록 테이블 --- */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                 
                  <TableHead className="w-15">사용자</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>유효 기간</TableHead>
                  <TableHead className="text-center">사용 여부</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      해당하는 쿠폰이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons.map((coupon) => (
                    <CouponRow key={coupon.id} coupon={coupon} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

// ----------------------------------------------------
// 3. 쿠폰 행 컴포넌트 (상태 변경 로직 포함)
// ----------------------------------------------------
function CouponRow({ coupon }: { coupon: any }) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== 'idle';
  
  // Optimistic UI: 서버 응답을 기다리지 않고 즉시 UI 변경
  const optimisticIsUsed = isSubmitting 
    ? !coupon.isUsed 
    : coupon.isUsed;

  return (
    <TableRow>
    
      <TableCell>{coupon.stampCard.user.name}</TableCell>
      <TableCell>{coupon.description}</TableCell>
      <TableCell>{format(new Date(coupon.expiresAt), "yyyy.MM.dd 까지", { locale: ko })}</TableCell>
      <TableCell className="text-center">
        <fetcher.Form method="post" action="/api/coupons/issue">
        <input type="hidden" name="intent" value="toggleCouponStatus" />
          <input type="hidden" name="couponId" value={coupon.id} />
          <Switch
            checked={optimisticIsUsed}
             onCheckedChange={() => {
              fetcher.submit(
                { couponId: coupon.id, intent: "toggleCouponStatus" }, // intent 필드 포함
                { method: 'post', action: '/api/coupons/issue' }
              );
            }}
            disabled={isSubmitting}
            aria-label="쿠폰 사용 여부 토글"
          />
        </fetcher.Form>
      </TableCell>
    </TableRow>
  );
}