// app/routes/events.$id.tsx

import { useLoaderData, Form, useNavigation, useFetcher,type LoaderFunctionArgs, redirect, Link } from "react-router"; // ActionFunctionArgs 제거
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Calendar, Users, Star, Send, Edit, Trash2 } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { useState } from "react";
import { Label } from "~/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "~/components/ui/alert-dialog";
import { format, intervalToDuration } from 'date-fns'; // intervalToDuration 추가
import { ko } from 'date-fns/locale';
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";

// ----------------------------------------------------
// 1. Loader 함수: 참가 여부, 리뷰 작성 여부, 사용자 ID 추가 (변경 없음)
// ----------------------------------------------------
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return redirect(`/login?redirectTo=/events/${params.id}`);
  }

  const eventId = params.id;
  if (!eventId) throw new Response("Event not found", { status: 404 });

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      images: true,
      category: true,
      reviews: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      _count: { select: { participants: true, claimableStamps: true } }
    },
  });

  if (!event) throw new Response("Event not found", { status: 404 });

  // 1. 이 이벤트에 참여했는지 확인
  const participation = await db.stampEntry.findFirst({
    where: { eventId, userId: user.id }
  });
  const isParticipant = !!participation;

  // 2. 이 이벤트에 리뷰를 작성했는지 확인
  const userReview = event.reviews.find(review => review.user.id === user.id);
  const hasReviewed = !!userReview;

  return { event, isParticipant, hasReviewed, currentUserId: user.id };
};

// ----------------------------------------------------
// 2. Action 함수: (제거) - API 라우트로 모든 리뷰 CRUD 처리 이관
// ----------------------------------------------------
// export const action = async ({ request }: ActionFunctionArgs) => { ... } // 이 함수는 이제 필요 없습니다!


// ----------------------------------------------------
// 3. Default 컴포넌트: 리뷰 CRUD 로직을 useFetcher로 API 라우트에 연결
// ----------------------------------------------------
export default function EventDetailPage() {
  const { event, isParticipant, hasReviewed, currentUserId } = useLoaderData<typeof loader>();
  const totalParticipants = event._count.participants + event._count.claimableStamps;
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const duration = intervalToDuration({ start: startDate, end: endDate });
  let durationString = Object.entries(duration)
    .filter(([unit, value]) => value > 0 && ['years', 'months', 'days', 'hours', 'minutes'].includes(unit))
    .map(([unit, value]) => `${value}${ {years: '년', months: '개월', days: '일', hours: '시간', minutes: '분'}[unit] }`)
    .join(' ');
  durationString = durationString ? `총 ${durationString} 진행` : '';

  return (
     <>
    <div className="container mx-auto max-w-4xl py-3 space-y-6">
   
      <Card>
        {event.images && event.images.length > 0 && (
          <Carousel className="w-full max-w-4xl mx-auto rounded-t-lg overflow-hidden">
            <CarouselContent>
              {event.images.map((image) => (
                 <CarouselItem key={image.id}>
                    {/* 👇 2. 이미지를 클릭 가능한 버튼으로 감싸고 onClick 이벤트 추가 */}
                    <button 
                      type="button" 
                      className="w-full aspect-video bg-muted block cursor-zoom-in"
                      onClick={() => setViewingImage(image.url)}
                    >
                      <img src={image.url} alt={event.name} className="w-full h-full object-cover" />
                    </button>
                  </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
          </Carousel>
        )}
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 border-[#81C784] text-[#81C784] bg-[#F0FDF4] ">
            {event.category.name}
          </Badge>
          <CardTitle className="text-4xl font-extrabold">{event.name}</CardTitle>
          <CardDescription className="text-lg text-gray-600 pt-2">{event.description || "이벤트 설명이 없습니다."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="grid gap-2 text-sm">
            <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-[#81C784]" /> {/* 캘린더 아이콘 색상 변경 */}
                <strong>기간:</strong>
                <span className="ml-2">
                    {format(startDate, "yyyy.MM.dd", { locale: ko })} ~ {format(endDate, "yyyy.MM.dd", { locale: ko })}
                </span>
            </div>
            {durationString && (
                <div className="flex items-center">
                    <span className="ml-6 text-muted-foreground text-xs">{durationString}</span>
                </div>
            )}
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 text-[#4FC3F7]" /> {/* Users 아이콘 색상 변경 */}
              <strong>총 참가자:</strong>
              <span className="ml-2">{totalParticipants}명</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>리뷰 ({event.reviews.length}개)</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 리뷰 폼: 참여자이고, 리뷰를 아직 안 썼을 때만 보임 */}
          {isParticipant && !hasReviewed && <ReviewForm eventId={event.id} />}
          
          {event.reviews.length === 0 ? (
            <p className="text-gray-500 text-center py-4">아직 이 이벤트에 대한 리뷰가 없습니다.</p>
          ) : (
            <div className="space-y-6 pt-4">
              {event.reviews.map((review) => (
                <ReviewItem key={review.id} review={review} currentUserId={currentUserId} eventId={event.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
   {/* "목록으로" 버튼 수정 */}
      <div className="flex justify-center w-full"> 
        <Button 
          asChild 
          variant="outline" 
          className="w-full max-w-sm border-2 border-[#81C784] text-[#81C784] hover:bg-[#E8F5E9] hover:text-[#4CAF50] font-semibold"
        >
          {/* Link 컴포넌트가 Button의 유일한 자식이 되도록 함 */}
          <Link to="/events">← 목록으로</Link>
        </Button>
      </div>
    </div>
<Dialog open={!!viewingImage} onOpenChange={(isOpen) => { if (!isOpen) setViewingImage(null); }}>
    <DialogTitle></DialogTitle>
    <DialogDescription></DialogDescription>
        <DialogContent className="max-w-4xl p-2">
            {viewingImage && (
                <img src={viewingImage} alt="Event" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
            )}
        </DialogContent>
      </Dialog>
      </>
  );
}

// ----------------------------------------------------
// 4. 리뷰 아이템 컴포넌트 (보기/수정 상태 관리)
//    - useFetcher를 사용하여 API 라우트와 통신
// ----------------------------------------------------
function ReviewItem({ review, currentUserId, eventId }: { review: any, currentUserId: string, eventId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const isMyReview = review.user.id === currentUserId;

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      {isEditing ? (
        <ReviewForm
          eventId={eventId}
          intent="UPDATE"
          existingReview={review}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <div className="flex items-center mb-2">
            <Avatar className="h-8 w-8 mr-3">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.user.name}`} />
              <AvatarFallback>{review.user.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <span className="font-semibold">{review.user.name}</span>
            <span className="ml-auto text-sm text-gray-500">{format(new Date(review.createdAt), "yyyy.MM.dd", { locale: ko })}</span>
            {isMyReview && (
              <div className="ml-2 flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="text-[#66BB6A] hover:bg-[#E8F5E9]"> {/* 버튼 색상 추가 */}
                  <Edit className="h-4 w-4" />
                </Button>
                <DeleteMyReviewDialog reviewId={review.id} eventId={eventId} />
              </div>
            )}
          </div>
          <div className="flex items-center mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
            ))}
          </div>
          <p className="text-gray-800">{review.comment}</p>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// 5. 리뷰 작성/수정 폼 컴포넌트
//    - useFetcher를 사용하여 API 라우트와 통신
// ----------------------------------------------------
function ReviewForm({ eventId, intent = "CREATE", existingReview, onCancel }: { eventId: string, intent?: "CREATE" | "UPDATE", existingReview?: any, onCancel?: () => void }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const fetcher = useFetcher(); // useNavigation 대신 useFetcher 사용
  const isSubmitting = fetcher.state === 'submitting';

  return (
    // action prop을 사용하여 API 라우트 지정
    <fetcher.Form method="post" action="/api/events/reviews" className="p-4 border rounded-lg mb-6 space-y-4 bg-background">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="eventId" value={eventId} />
      {intent === "UPDATE" && <input type="hidden" name="reviewId" value={existingReview.id} />}
      
      <div>
        <Label className="font-semibold">별점</Label>
        <div className="flex items-center mt-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => setRating(star)}>
              <Star className={`h-6 w-6 cursor-pointer ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
            </button>
          ))}
          <input type="hidden" name="rating" value={rating} />
        </div>
      </div>
      <div>
        <Label htmlFor="comment" className="font-semibold">코멘트</Label>
        <Textarea id="comment" name="comment" defaultValue={existingReview?.comment || ""} required className="mt-2" />
      </div>
      <div className="flex justify-end gap-2">
        {intent === "UPDATE" && <Button type="button" variant="ghost" onClick={onCancel} className="text-gray-600 hover:bg-gray-100">취소</Button>} {/* 취소 버튼 색상 추가 */}
        <Button type="submit" disabled={isSubmitting || rating === 0} className="bg-[#81C784] hover:bg-[#66BB6A] text-white"> {/* 버튼 색상 추가 */}
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "저장 중..." : (intent === "CREATE" ? "리뷰 등록" : "리뷰 수정")}
        </Button>
      </div>
    </fetcher.Form>
  );
}

// ----------------------------------------------------
// 6. 내 리뷰 삭제 확인 다이얼로그
//    - useFetcher를 사용하여 API 라우트와 통신
// ----------------------------------------------------
function DeleteMyReviewDialog({ reviewId, eventId }: { reviewId: number, eventId: string }) {
  const fetcher = useFetcher();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <fetcher.Form method="post" action="/api/events/reviews"> {/* API 라우트 지정 */}
          <input type="hidden" name="intent" value="DELETE" />
          <input type="hidden" name="reviewId" value={reviewId} />
          <input type="hidden" name="eventId" value={eventId} />
          <AlertDialogHeader>
            <AlertDialogTitle>정말 리뷰를 삭제하시겠습니까?</AlertDialogTitle>
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