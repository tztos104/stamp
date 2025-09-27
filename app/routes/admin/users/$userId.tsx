// app/routes/admin/users/$userId.tsx (기능 강화 최종본)

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher, useLoaderData, Link } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { ArrowLeft, Edit, Save, User, Phone, Calendar, Stamp, Ticket, Activity, Trash2, PlusCircle, Search as SearchIcon, AwardIcon } from "lucide-react";
import type { Role, UserStatus, Event as PrismaEvent } from "@prisma/client";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useState, useEffect } from "react";
import { getFlashSession, commitSession } from "~/lib/session.server";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";

// --- Loader: 사용자 정보와 '활동 로그' 데이터를 함께 불러옵니다. ---
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const userId = params.userId;
  if (!userId) throw new Response("User ID is required", { status: 400 });

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
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { event: { select: { id: true, name: true } } }
      }
    },
  });

  if (!user) throw new Response("User not found", { status: 404 });

  // --- 날짜 포맷팅 로직 ---
  const formattedUser = {
    ...user,
    createdAtFormatted: format(new Date(user.createdAt), "yyyy.MM.dd", { locale: ko }),
    StampCard: user.StampCard.map(card => ({
      ...card,
      createdAtFormatted: format(new Date(card.createdAt), "yyyy.MM.dd"),
      coupon: card.coupon ? {
          ...card.coupon,
          createdAtFormatted: format(new Date(card.coupon.createdAt), "yyyy.MM.dd")
      } : null
    })),
    eventEntries: user.eventEntries.map(entry => ({
      ...entry,
      createdAtFormatted: format(new Date(entry.createdAt), "yyyy.MM.dd")
    }))
  };

  const stampActivities = user.eventEntries.map(entry => ({
    type: '스탬프 적립' as const,
    date: format(new Date(entry.createdAt), "yyyy.MM.dd HH:mm"),
    description: entry.event ? `'${entry.event.name}' 이벤트 참여` : `admin 도장 발급: ${entry.adminNote || ''}`,
    link: entry.event ? `/admin/events/${entry.event.id}` : `/admin/users/${userId}`
  }));

  const reviewActivities = user.reviews.map(review => ({
    type: '리뷰 작성' as const,
    date: format(new Date(review.createdAt), "yyyy.MM.dd HH:mm"),
    description: `'${review.event.name}' 이벤트에 별점 ${review.rating}점 리뷰 작성`,
    link: `/admin/events/${review.event.id}`
  }));
  
  const couponActivities = user.StampCard.filter(card => card.coupon).map(card => ({
    type: '쿠폰 발급' as const,
    date: format(new Date(card.coupon!.createdAt), "yyyy.MM.dd HH:mm"),
    description: `스탬프 카드 보상으로 쿠폰 발급 (${card.coupon!.code})`,
    link: `/admin/coupons`
  }));

  const allActivities = [...stampActivities, ...reviewActivities, ...couponActivities]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { user: formattedUser, activities: allActivities };
};


// --- Action: 사용자 정보 수정, 스탬프 추가/삭제 로직을 처리합니다. ---
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const userId = params.userId;
  if (!userId) throw new Response("User not found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  
  if (intent === 'updateUser') {
    const name = formData.get("name") as string;
    const role = formData.get("role") as Role;
    const status = formData.get("status") as UserStatus;

    if (!name || name.length < 2) {
        flashSession.flash("toast", { type: "error", message: "이름은 2글자 이상이어야 합니다." });
    } else {
        try {
            await db.user.update({ where: { id: userId }, data: { name, role, status } });
            flashSession.flash("toast", { type: "success", message: "사용자 정보가 성공적으로 업데이트되었습니다." });
        } catch (error) {
            flashSession.flash("toast", { type: "error", message: "사용자 정보 업데이트에 실패했습니다." });
        }
    }
    return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) } });
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
            throw new Error("쿠폰이 발급된 스탬프 카드는 삭제할 수 없습니다.");
        }
        
        await db.$transaction([
            db.stampEntry.deleteMany({ where: { stampCardId: stampCardId } }),
            db.stampCard.delete({ where: { id: stampCardId } })
        ]);

        flashSession.flash("toast", { type: "success", message: "스탬프 카드가 성공적으로 삭제되었습니다." });

    } catch (error: any) {
        flashSession.flash("toast", { type: "error", message: error.message || "스탬프 카드 삭제 중 오류 발생" });
    }
    return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
  }

  if (intent === 'addStamp') {
    const eventId = formData.get("eventId") as string;
    if (!eventId) {
      flashSession.flash("toast", { type: "error", message: "이벤트를 선택해주세요." });
    } else {
        try {
            await db.$transaction(async (prisma) => {
                let activeCard = await prisma.stampCard.findFirst({
                    where: { userId, isRedeemed: false },
                    include: { _count: { select: { entries: true } } },
                    orderBy: { createdAt: 'asc' }
                });
    
                  if (!activeCard || activeCard._count.entries >= 10) {
                const newCard = await prisma.stampCard.create({ data: { userId } });
                // 👇 새로 만든 카드 객체에 _count 속성을 직접 추가하여 타입을 맞춰줍니다.
                activeCard = {
                    ...newCard,
                    _count: { entries: 0 } 
                };
            }
                const existingEntry = await prisma.stampEntry.findFirst({
                    where: { userId, eventId, stampCardId: activeCard.id }
                });
    
                if (existingEntry) {
                    throw new Error("이미 해당 이벤트의 스탬프가 이 카드에 존재합니다.");
                }
    
                await prisma.stampEntry.create({
                    data: { userId, eventId, stampCardId: activeCard.id }
                });
            });
            flashSession.flash("toast", { type: "success", message: "스탬프가 성공적으로 추가되었습니다." });
        } catch (error: any) {
            flashSession.flash("toast", { type: "error", message: error.message || "스탬프 추가 중 오류 발생" });
        }
    }
    return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
  }

  if (intent === 'deleteStamp') {
      const stampEntryId = Number(formData.get("stampEntryId"));
      try {
          const stampEntry = await db.stampEntry.findUnique({
              where: { id: stampEntryId, userId },
              include: { stampCard: { include: { coupon: true } } }
          });

          if (stampEntry?.stampCard.coupon) {
              throw new Error("쿠폰이 발급된 카드의 스탬프는 삭제할 수 없습니다.");
          }

          await db.stampEntry.delete({ where: { id: stampEntryId, userId }});
          flashSession.flash("toast", { type: "success", message: "스탬프가 삭제되었습니다." });
      } catch (error: any) {
          flashSession.flash("toast", { type: "error", message: error.message || "스탬프 삭제 중 오류 발생" });
      }
      return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
  }

  if (intent === 'addAdminStamp') {
    const adminNote = formData.get("adminNote") as string;
    if (!adminNote || adminNote.trim().length === 0) {
      flashSession.flash("toast", { type: "error", message: "발급 사유를 입력해주세요." });
    } else {
        try {
            await db.$transaction(async (prisma) => {
                let activeCard = await prisma.stampCard.findFirst({
                    where: { userId, isRedeemed: false },
                    include: { _count: { select: { entries: true } } },
                    orderBy: { createdAt: 'asc' }
                });
    
                if (!activeCard || activeCard._count.entries >= 10) {
                   const newCard = await prisma.stampCard.create({ data: { userId } });
                // 👇 새로 만든 카드 객체에 _count 속성을 직접 추가하여 타입을 맞춰줍니다.
                activeCard = {
                    ...newCard,
                    _count: { entries: 0 } 
                };
                    
                }
    
                await prisma.stampEntry.create({
                    data: { 
                        userId, 
                        stampCardId: activeCard.id,
                        adminNote: adminNote // eventId 대신 adminNote를 저장
                    }
                });
            });
            flashSession.flash("toast", { type: "success", message: "관리자 스탬프가 성공적으로 발급되었습니다." });
        } catch (error: any) {
            flashSession.flash("toast", { type: "error", message: error.message || "스탬프 발급 중 오류 발생" });
        }
    }
    return redirect(`/admin/users/${userId}`, { headers: { "Set-Cookie": await commitSession(flashSession) }});
  }
  throw new Response("Invalid intent", { status: 400 });
};

export default function UserDetailPage() {
  const { user, activities } = useLoaderData<typeof loader>();
  const [isEditing, setIsEditing] = useState(false);
  const fetcher = useFetcher();
  const getRoleBadgeVariant = (userRole: Role | null) => {
    switch (userRole) {
      case "ADMIN": return "destructive";
      case "MEMBER": return "default";
      case "USER": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
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
                            <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />가입일: {user.createdAtFormatted}</span>
                        </CardDescription>
                    </div>
                    <Button type="button" onClick={() => setIsEditing(!isEditing)} variant="outline" size="sm">
                        {isEditing ? "취소" : <><Edit className="h-4 w-4 mr-2" /> 정보 수정</>}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label htmlFor="role">역할</Label>
                                <Select name="role" defaultValue={user.role || "USER"}>
                                    <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USER">일반사용자</SelectItem>
                                        <SelectItem value="MEMBER">멤버</SelectItem>
                                        <SelectItem value="ADMIN">관리자</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">상태</Label>
                                <Select name="status" defaultValue={user.status}>
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">활성</SelectItem>
                                        <SelectItem value="TEMPORARY">임시</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button type="submit" name="intent" value="updateUser" className="mt-4" disabled={fetcher.state !== 'idle'}>
                            <Save className="h-4 w-4 mr-2" /> {fetcher.state !== 'idle' ? '저장 중...' : '변경사항 저장'}
                        </Button>
                        </>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
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
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Stamp className="h-5 w-5" /> 스탬프 관리</CardTitle>
                <AddAdminStampDialog />
                <AddStampDialog />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                     {user.eventEntries.length > 0 ? user.eventEntries.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="text-sm">
                            {/* 👇 event가 있으면 이벤트 이름을, 없으면 adminNote를 보여줍니다. */}
                            <p className="font-medium flex items-center gap-1.5">
                                {entry.event ? (
                                    <Link to={`/admin/events/${entry.event.id}`} className="hover:underline">{entry.event.name}</Link>
                                ) : (
                                    <>
                                        <AwardIcon className="h-4 w-4 text-primary" />
                                        <span>{entry.adminNote || '관리자 발급'}</span>
                                    </>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {entry.createdAtFormatted} 적립
                            </p>
                        </div>
                        <DeleteStampDialog stampEntryId={entry.id} />
                    </div>
                )) : (
                        <p className="text-sm text-center text-muted-foreground py-4">적립된 스탬프가 없습니다.</p>
                    )}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> 활동 로그</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">날짜</TableHead>
                            <TableHead className="w-[100px]">유형</TableHead>
                            <TableHead>내용</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activities.length > 0 ? activities.map((activity: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="text-xs text-muted-foreground">{activity.date}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                                        <ActivityIcon type={activity.type} /> {activity.type}
                                    </Badge>
                                </TableCell>
                                <TableCell><Link to={activity.link} className="hover:underline">{activity.description}</Link></TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">활동 기록이 없습니다.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> 스탬프 카드 ({user.StampCard.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {user.StampCard.length > 0 ? user.StampCard.map((card: any) => (
                    <div key={card.id} className="p-3 border rounded-md flex justify-between items-center gap-2">
                        <div>
                            <div className="font-medium">
                                스탬프 {card._count.entries} / 10
                                {card.isRedeemed && <Badge className="ml-2">보상 완료</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">생성일: {card.createdAtFormatted}</p>
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
    </div>
  );
}

function AddStampDialog() {
  const fetcher = useFetcher();
  const eventSearchFetcher = useFetcher<{ events: Pick<PrismaEvent, 'id' | 'name'>[] }>();
  const [open, setOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");

  const handleSearch = (query: string) => {
    if (query.length > 0) {
        eventSearchFetcher.load(`/api/events/search?q=${query}`);
    }
  };

  useEffect(() => {
      // 폼 제출이 성공적으로 완료되면 fetcher.data에 redirect 응답이 담겨있을 수 있습니다.
      // 또는 상태가 idle로 돌아왔을 때를 기준으로 삼을 수 있습니다.
      if (fetcher.state === 'idle' && fetcher.data === undefined) {
         // 성공적으로 제출된 후 특별한 반환값이 없을 때를 가정합니다.
      }
      // 성공적인 toast 메시지는 loader에서 처리하므로 여기서는 다이얼로그만 닫습니다.
      if (fetcher.state === 'submitting') {
          setOpen(false);
      }
  }, [fetcher.state, fetcher.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusCircle className="h-4 w-4 mr-2" /> 스탬프 추가</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>스탬프 수동 추가</DialogTitle>
          <DialogDescription>
            사용자에게 특정 이벤트의 스탬프를 수동으로 적립합니다.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post" onSubmit={() => setOpen(false)}>
            <input type="hidden" name="intent" value="addStamp" />
            <input type="hidden" name="eventId" value={selectedEventId} />
            <Command className="rounded-lg border shadow-md mt-2">
                <CommandInput onValueChange={handleSearch} placeholder="이벤트 이름 검색..." />
                <CommandList>
                    <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                    {eventSearchFetcher.data?.events && (
                        <CommandGroup>
                        {eventSearchFetcher.data.events.map(event => (
                            <CommandItem
                                key={event.id}
                                value={event.name}
                                onSelect={() => setSelectedEventId(event.id)}
                            >
                                {event.name}
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </Command>

            {selectedEventId && <p className="text-sm text-muted-foreground mt-2">선택된 이벤트: {eventSearchFetcher.data?.events?.find(e => e.id === selectedEventId)?.name}</p>}

            <DialogFooter className="mt-4">
                <Button type="submit" disabled={!selectedEventId || fetcher.state !== 'idle'}>
                    {fetcher.state !== 'idle' ? '추가 중...' : '스탬프 추가하기'}
                </Button>
            </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStampDialog({ stampEntryId }: { stampEntryId: number }) {
    const fetcher = useFetcher();
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="deleteStamp" />
                    <input type="hidden" name="stampEntryId" value={stampEntryId} />
                    <AlertDialogHeader>
                        <AlertDialogTitle>이 스탬프를 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button type="submit" variant="destructive">삭제</Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </fetcher.Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}

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

function AddAdminStampDialog() {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);

 useEffect(() => {
      if (fetcher.state === 'idle' && fetcher.formMethod != null) {
          setOpen(false);
      }
  }, [fetcher]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><AwardIcon className="h-4 w-4 mr-2" /> 관리자 발급</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>관리자 스탬프 발급</DialogTitle>
          <DialogDescription>
            이벤트 참여와 관계없이 사용자에게 스탬프를 지급합니다. 발급 사유를 명확히 기재해주세요.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="post">
            <input type="hidden" name="intent" value="addAdminStamp" />
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="adminNote" className="text-right">발급 사유</Label>
                    <Input id="adminNote" name="adminNote" className="col-span-3" placeholder="예: 고객 불만 보상" />
                </div>
            </div>
            <DialogFooter>
                <Button type="submit" disabled={fetcher.state !== 'idle'}>
                    {fetcher.state !== 'idle' ? '발급 중...' : '스탬프 발급하기'}
                </Button>
            </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityIcon({ type }: { type: '스탬프 적립' | '리뷰 작성' | '쿠폰 발급' }) {
  switch (type) {
    case '스탬프 적립': return <Stamp className="h-4 w-4" />;
    case '리뷰 작성': return <Edit className="h-4 w-4" />;
    case '쿠폰 발급': return <Ticket className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}