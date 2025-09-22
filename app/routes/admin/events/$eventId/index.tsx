// app/routes/admin/events/$eventId._index.tsx


import {type LoaderFunctionArgs, Link, useFetcher, useLoaderData } from "react-router";
import { db } from "~/lib/db.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Calendar, Users, Ticket, Edit, Trash2, Star, QrCode, Copy } from "lucide-react";
import { format } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";

// loader: URL의 eventId를 사용해 특정 이벤트의 모든 상세 데이터를 불러옵니다.
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const eventId = params.eventId;
  if (!eventId) {
    throw new Response("Event not found", { status: 404 });
  }

   const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      images: true,
      category: true,
      participants: { include: { user: true } },
      // 👇 claimableStamps 정보에 redemptions와 user 정보 포함
      claimableStamps: {
        include: {
          redemptions: {
            include: { user: { select: { name: true } } },
            orderBy: { redeemedAt: 'asc' } // 사용 기록은 시간 순서대로
          },
        },
        orderBy: { createdAt: 'asc' }
      },
      reviews: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      }
    },
  });

  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }
 const appUrl = process.env.APP_URL || 'http://localhost:5173';
  return { event,appUrl };
};



export default function EventDetailsPage() {
  const { event ,appUrl} = useLoaderData<typeof loader>();
  const totalParticipants = (event.participants?.length || 0) + (event.claimableStamps?.length || 0);

  return (
    <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <Button variant="outline" asChild>
                <Link to="/admin/events">← 목록으로 돌아가기</Link>
            </Button>
            <Button asChild>
                <Link to={`/admin/events/${event.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2"/> 수정하기
                </Link>
            </Button>
        </div>
        
        <Card>
            {/* --- 이미지 갤러리 --- */}
            {event.images && event.images.length > 0 && (
          <Carousel className="w-full max-w-4xl mx-auto p-4">
            <CarouselContent>
              {event.images.map((image) => (
                <CarouselItem key={image.id}>
                  <div className="p-1">
                    <Card>
                      <CardContent className="flex aspect-video items-center justify-center p-0 overflow-hidden rounded-lg">
                        <img src={image.url} alt={event.name} className="w-full h-full object-contain"/>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        )}

            <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">{event.category.name}</Badge>
                <CardTitle className="text-3xl">{event.name}</CardTitle>
                <CardDescription>{event.description || "이벤트 설명이 없습니다."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Separator />
                <div className="grid gap-2 text-sm">
                    <div className="flex items-center"><Calendar className="h-4 w-4 mr-2 text-muted-foreground"/><strong>기간:</strong><span className="ml-2">{format(new Date(event.startDate), "yyyy.MM.dd")} ~ {format(new Date(event.endDate), "yyyy.MM.dd")}</span></div>
                    <div className="flex items-center"><Users className="h-4 w-4 mr-2 text-muted-foreground"/><strong>총 참가자:</strong><span className="ml-2">{totalParticipants}명</span></div>
                </div>
                <Separator />
                
                {/* --- 참가자 목록 --- */}
                <div>
                    <h3 className="font-semibold mb-2">등록된 참가자 ({event.participants.length}명)</h3>
                    <div className="flex flex-wrap gap-2">
                        {event.participants.map(p => (
                            <Badge key={p.user.id} variant="secondary">{p.user.name} ({p.user.phoneNumber})</Badge>
                        ))}
                    </div>
                </div>
                
          
            </CardContent>
        </Card>
        
        <Card>
        <CardHeader>
          <CardTitle>이벤트 리뷰 관리</CardTitle>
          <CardDescription>총 {event.reviews.length}개의 리뷰가 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {event.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">작성된 리뷰가 없습니다.</p>
            ) : (
              event.reviews.map(review => (
                <div key={review.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">{review.user.name}</span>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map(star => <Star key={star} className={`h-4 w-4 ${review.rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                    <p className="text-xs text-muted-foreground pt-1">{format(new Date(review.createdAt), "yyyy.MM.dd HH:mm")}</p>
                  </div>
                  <DeleteReviewDialog reviewId={review.id} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
          {/* --- 임시 코드 관리 Card (기존 Card 대신 이 부분을 사용합니다) --- */}
      <Card>
        <CardHeader>
          <CardTitle>스탬프 코드 관리</CardTitle>
          <CardDescription>
            총 {event.claimableStamps.length}개의 스탬프 코드가 발급되었습니다.
            {event.claimableStamps.some(s => s.maxUses === null || s.maxUses > 1) && (
              <span className="ml-2 text-primary"> (일부 코드는 여러 번 사용될 수 있습니다.)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {event.claimableStamps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">발급된 스탬프 코드가 없습니다.</p>
            ) : (
              event.claimableStamps.map((stamp) => (
                <ClaimableStampItem key={stamp.id} stamp={stamp} appUrl={appUrl} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- 임시 코드 아이템 컴포넌트 (새로 추가) ---
function ClaimableStampItem({ stamp, appUrl }: { stamp: any, appUrl: string }) {
  const claimUrl = `${appUrl}/claim?code=${stamp.claimCode}`;
const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(claimUrl);
    toast.success("클레임 URL이 클립보드에 복사되었습니다.", {
      action: {
        label: 'QR 보기',
         onClick: () => setIsQrDialogOpen(true),
      },
    });
  };

  const isUnlimited = stamp.maxUses === null;
  const usageStatus = isUnlimited
    ? '무제한 사용'
    : `${stamp.currentUses} / ${stamp.maxUses} 사용`;
  const isUsedUp = !isUnlimited && stamp.currentUses >= stamp.maxUses;
  const isExpired = new Date(stamp.expiresAt) < new Date();

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg 
                    ${isUsedUp || isExpired ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-white border-blue-200'}`}>
      <div className="flex items-center gap-4 mb-2 sm:mb-0">
        <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isExpired}>
              <QrCode className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[280px] flex flex-col items-center p-6">
            <DialogHeader className="w-full text-center">
              <DialogTitle className="text-lg font-bold pb-2">스탬프 적립 QR 코드</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                이 QR 코드를 스캔하여 스탬프를 적립하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4">
              <QRCodeSVG value={claimUrl} size={200} level="H" includeMargin={true} />
            </div>
            <p className="font-mono text-sm text-center pt-2">Code: {stamp.claimCode}</p>
          </DialogContent>
        </Dialog>
        <div>
          <p className="font-mono font-semibold text-base">{stamp.claimCode}</p>
          <p className="text-xs text-muted-foreground">
            유효기간: {format(new Date(stamp.expiresAt), "yyyy.MM.dd HH:mm")}
            {isExpired && <Badge className="ml-2" variant="destructive">만료됨</Badge>}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <Badge variant={isUsedUp ? "destructive" : "secondary"}>
          {usageStatus}
        </Badge>
        <Button variant="outline" size="icon" onClick={copyToClipboard} disabled={isExpired}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function DeleteReviewDialog({ reviewId }: { reviewId: number }) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== 'idle';

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="flex-shrink-0">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <fetcher.Form method="post" action="/api/events/reviews">
          <input type="hidden" name="intent" value="DELETE" />
          <input type="hidden" name="reviewId" value={reviewId} />
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 리뷰를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isDeleting}>
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          </AlertDialogFooter>
        </fetcher.Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}