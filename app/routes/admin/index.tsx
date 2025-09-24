// app/routes/admin/index.tsx (최근 쿠폰 내역 추가)

import { type LoaderFunctionArgs, Link } from "react-router";
import { useLoaderData } from "react-router";
import { db } from "~/lib/db.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Users, Package, Ticket } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// --- Loader: 대시보드에 필요한 모든 데이터를 불러옵니다. ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [
    totalUsers,
    totalEvents,
    totalCoupons,
    recentUsers,
    recentEvents,
    recentCoupons, // 👈 최근 쿠폰 데이터 추가
  ] = await Promise.all([
    db.user.count(),
    db.event.count(),
    db.coupon.count(),
    db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true },
    }),
    db.event.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true },
    }),
    // 👇 최근 발급된 쿠폰 5개를 가져오는 쿼리 추가
    db.coupon.findMany({
        take: 5,
        orderBy: { createdAt: 'desc'},
        select: {
            id: true,
            code: true,
            createdAt: true,
            stampCard: {
                select: {
                    user: {
                        select: { id: true, name: true }
                    }
                }
            }
        }
    })
  ]);

  return {
    totalUsers,
    totalEvents,
    totalCoupons,
    recentUsers,
    recentEvents,
    recentCoupons, // 👈 반환 객체에 추가
  };
};

// --- UI 컴포넌트 ---
export default function AdminDashboard() {
  const { 
    totalUsers, 
    totalEvents, 
    totalCoupons, 
    recentUsers, 
    recentEvents,
    recentCoupons, // 👈 loader 데이터 사용
  } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground">
          서비스의 전체 현황을 요약해서 보여줍니다.
        </p>
      </div>

      {/* 1. 핵심 지표 카드 (변경 없음) */}
      <div className="grid gap-4 ">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">현재까지 가입한 총 사용자 수</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 이벤트</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">지금까지 생성된 총 이벤트 수</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">발급된 쿠폰</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCoupons}</div>
            <p className="text-xs text-muted-foreground">지금까지 발급된 총 쿠폰 수</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. 최근 활동 목록 (레이아웃 수정 및 쿠폰 카드 추가) */}
      <div className="grid gap-4">
        {/* 최근 가입 사용자 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>최근 가입한 사용자</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="text-right">가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link to={`/admin/users/${user.id}`} className="font-medium hover:underline">
                        {user.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{format(new Date(user.createdAt), "yy.MM.dd")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* 최근 등록된 이벤트 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>최근 등록된 이벤트</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이벤트명</TableHead>
                  <TableHead className="text-right">등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map(event => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link to={`/admin/events/${event.id}`} className="font-medium hover:underline">
                        {event.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{format(new Date(event.createdAt), "yy.MM.dd")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 👇 최근 발급된 쿠폰 카드 (신규 추가) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>최근 발급된 쿠폰</CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead className="text-right">발급일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCoupons.map(coupon => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <Link to={`/admin/users/${coupon.stampCard.user.id}`} className="font-medium hover:underline">
                        {coupon.stampCard.user.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{format(new Date(coupon.createdAt), "yy.MM.dd")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}