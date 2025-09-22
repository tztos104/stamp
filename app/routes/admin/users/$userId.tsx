// app/routes/admin/users/$userId.tsx (Hydration 오류 수정)

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher, useLoaderData, Link } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Edit, Save, User, Phone, Calendar, Stamp, Ticket, Activity, Trash2 } from "lucide-react";
import { Role, UserStatus } from "@prisma/client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import { getFlashSession, commitSession } from "~/lib/session.server";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";

// ... (loader, action 함수는 이전과 동일)
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const userId = params.userId;
  if (!userId) {
    throw new Response("User ID is required", { status: 400 });
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      StampCard: {
        orderBy: { createdAt: 'desc' },
        include: { coupon: true, _count: { select: { entries: true } } },
      },
      eventEntries: {
        orderBy: { createdAt: 'desc' },
        include: { event: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) {
    throw new Response("User not found", { status: 404 });
  }
  return { user };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const userId = params.userId;
  if (!userId) {
    throw new Response("User not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const flashSession = await getFlashSession(request.headers.get("Cookie"));

  if (intent === 'updateUser') {
    const name = formData.get("name") as string;
    const role = formData.get("role") as Role;
    const status = formData.get("status") as UserStatus;

    if (!name || name.length < 2) {
        flashSession.flash("toast", { type: "error", message: "이름은 2글자 이상이어야 합니다." });
        return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
    }
    try {
      await db.user.update({
        where: { id: userId },
        data: { name, role, status },
      });
      flashSession.flash("toast", { type: "success", message: "사용자 정보가 성공적으로 업데이트되었습니다." });
      return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) } });
    } catch (error) {
      console.error("User update failed:", error);
      throw new Response("User information update failed.", { status: 500 });
    }
  }

  if (intent === 'deleteStampCard') {
    const stampCardId = Number(formData.get("stampCardId"));
    if (!stampCardId) {
        throw new Response("Stamp Card ID is required", { status: 400 });
    }
    
    try {
        const cardToDelete = await db.stampCard.findUnique({
            where: { id: stampCardId },
            include: { coupon: true }
        });

        if (cardToDelete?.coupon) {
            flashSession.flash("toast", { type: "error", message: "쿠폰이 발급된 스탬프 카드는 삭제할 수 없습니다." });
            return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
        }
        
        await db.$transaction([
            db.stampEntry.deleteMany({ where: { stampCardId: stampCardId } }),
            db.stampCard.delete({ where: { id: stampCardId } })
        ]);

        flashSession.flash("toast", { type: "success", message: "스탬프 카드가 성공적으로 삭제되었습니다." });
        return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});

    } catch (error) {
        console.error("Stamp card deletion failed:", error);
        throw new Response("Stamp card deletion failed.", { status: 500 });
    }
  }

  throw new Response("Invalid intent", { status: 400 });
};


export default function UserDetailPage() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);

  const getRoleBadgeVariant = (userRole: Role | null) => {
    switch (userRole) {
      case Role.ADMIN: return "destructive";
      case Role.MEMBER: return "default";
      case Role.USER: return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
        {/* ... (이전과 동일) ... */}
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link to="/admin/users"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-xl font-bold">사용자 상세 정보</h1>
        </div>

        <fetcher.Form method="post">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <User className="h-6 w-6" /> 
                            {isEditing ? ( <Input name="name" defaultValue={user.name} className="text-2xl font-bold h-10" />) : (user.name)}
                        </CardTitle>
                        <CardDescription className="mt-2 flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{user.phoneNumber}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />가입일: {format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko })}</span>
                        </CardDescription>
                    </div>
                    <Button type="button" onClick={() => setIsEditing(!isEditing)} variant="outline" size="sm">
                        {isEditing ? "취소" : <><Edit className="h-4 w-4 mr-2" /> 정보 수정</>}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="role">역할</Label>
                                <Select name="role" defaultValue={user.role || Role.USER}>
                                    <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={Role.USER}>일반사용자</SelectItem>
                                        <SelectItem value={Role.MEMBER}>멤버</SelectItem>
                                        <SelectItem value={Role.ADMIN}>관리자</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">상태</Label>
                                <Select name="status" defaultValue={user.status}>
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={UserStatus.ACTIVE}>활성</SelectItem>
                                        <SelectItem value={UserStatus.TEMPORARY}>임시</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button type="submit" name="intent" value="updateUser" className="mt-4" disabled={fetcher.state !== 'idle'}>
                            <Save className="h-4 w-4 mr-2" /> {fetcher.state !== 'idle' ? '저장 중...' : '변경사항 저장'}
                        </Button>
                        </>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>역할</Label>
                                <Badge variant={getRoleBadgeVariant(user.role)} className="block w-fit mt-2">{user.role}</Badge>
                            </div>
                            <div>
                                <Label>상태</Label>
                                <Badge variant={user.status === 'ACTIVE' ? "secondary" : "outline"} className="block w-fit mt-2">{user.status}</Badge>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </fetcher.Form>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Stamp className="h-5 w-5" /> 스탬프 카드 ({user.StampCard.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {user.StampCard.length > 0 ? user.StampCard.map(card => (
                    <div key={card.id} className="p-3 border rounded-md flex justify-between items-center gap-2">
                        <div>
                            {/* 👇 <p> 태그를 <div>로 변경하여 오류 해결 */}
                            <div className="font-medium">
                                스탬프 {card._count.entries} / 10
                                {card.isRedeemed && <Badge className="ml-2">보상 완료</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">생성일: {format(new Date(card.createdAt), "yyyy.MM.dd")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {card.coupon && <Badge variant="outline" className="flex items-center gap-1"><Ticket className="h-3 w-3" /> 쿠폰 발급됨</Badge>}
                            <DeleteStampCardDialog cardId={card.id} hasCoupon={!!card.coupon} />
                        </div>
                    </div>
                    )) : <p className="text-muted-foreground text-center">보유한 스탬프 카드가 없습니다.</p>}
                </div>
            </CardContent>
        </Card>

        {/* ... (이벤트 참여 기록 카드는 동일) ... */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> 이벤트 참여 기록 ({user.eventEntries.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>이벤트 명</TableHead>
                            <TableHead className="text-right">참여일</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {user.eventEntries.length > 0 ? user.eventEntries.map(entry => (
                            <TableRow key={entry.id}>
                                <TableCell>
                                    <Link to={`/admin/events/${entry.event.id}`} className="hover:underline">{entry.event.name}</Link>
                                </TableCell>
                                <TableCell className="text-right">{format(new Date(entry.createdAt), "yyyy.MM.dd")}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24">참여한 이벤트가 없습니다.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}

// ... (DeleteStampCardDialog 컴포넌트는 이전과 동일)
function DeleteStampCardDialog({ cardId, hasCoupon }: { cardId: number; hasCoupon: boolean }) {
    const fetcher = useFetcher();
    const isDeleting = fetcher.state !== 'idle';

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={hasCoupon} title={hasCoupon ? "쿠폰이 발급된 카드는 삭제할 수 없습니다" : "스탬프 카드 삭제"}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="deleteStampCard" />
                    <input type="hidden" name="stampCardId" value={cardId} />
                    <AlertDialogHeader>
                        <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            이 스탬프 카드와 관련된 모든 스탬프 기록이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button type="submit" variant="destructive" disabled={isDeleting}>
                                {isDeleting ? "삭제 중..." : "삭제"}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </fetcher.Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}