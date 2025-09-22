// app/routes/card.tsx

import {  Link, type LoaderFunctionArgs, redirect, useRevalidator } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { getSession } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { StampSlot } from "~/components/stampSlot";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Calendar, Gift, Star, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import { format } from "date-fns/format";
import { toast } from "sonner";
import { Toaster } from "~/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const STAMPS_PER_CARD = 10;

// --- Loader 함수 (수정) ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return redirect("/login?redirectTo=/card");
  }

  // 1. 현재 사용자가 채우고 있는 카드 (isRedeemed: false)
  let stampCards = await db.stampCard.findMany({
    where: { userId: user.id },
    include: {
      entries: {
        orderBy: { createdAt: 'asc' },
        include: { event: { select: { id: true , name: true } } } // 이벤트 이미지 추가
      },
      coupon: true, // 발급된 쿠폰 정보도 포함
    },
    orderBy: { createdAt: 'desc' }, // 최신 카드를 먼저 보여주기 위해
  });

  // 2. 사용 중인 카드가 없다면 새로 생성
 const hasActiveCard = stampCards.some(card => !card.isRedeemed);
  if (!hasActiveCard) {
    const newCard = await db.stampCard.create({
      data: { userId: user.id },
      include: {
        entries: {
          orderBy: { createdAt: 'asc' },
          include: { event: { select: { id: true, name: true} } }
        },
        coupon: true,
      },
    });
    stampCards.unshift(newCard); // 새로 만든 카드를 목록의 맨 앞에 추가
  }
  
  // 3. 가장 최근에 발급받은 쿠폰 (사용 여부 무관)
 const coupons = await db.coupon.findMany({
    where: { stampCard: { userId: user.id } },
    orderBy: { createdAt: 'desc' }, // 최신 쿠폰을 먼저 보여주기 위해
  });

  return { stampCards, coupons, userId: user.id };
};


// --- Default 컴포넌트 (UI 로직 수정) ---
export default function MyStampCardPage() {
  const { stampCards, coupons , userId } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const issueCouponFetcher = useFetcher();
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (viewingEventId) {
      fetcher.load(`/api/events/${viewingEventId}`);
    }
  }, [viewingEventId]);

  useEffect(() => {
    if (issueCouponFetcher.state === 'idle' && issueCouponFetcher.data) {
      if (issueCouponFetcher.data.success) {
        toast.success(issueCouponFetcher.data.message || "쿠폰이 성공적으로 발급되었습니다!");
        revalidator.revalidate(); // 데이터 갱신
      } else if (issueCouponFetcher.data.error) {
        toast.error(issueCouponFetcher.data.error || "쿠폰 발급 중 오류가 발생했습니다.");
      }
    }
  }, [issueCouponFetcher.state, issueCouponFetcher.data, revalidator]);
  
  const handleStampClick = (eventId: string) => {
    setViewingEventId(eventId);
  };

 // 스탬프 카드 분류: 진행 중 (미사용) vs. 완료됨 (사용됨)
  const activeCards = stampCards.filter(card => !card.isRedeemed);
  const redeemedCards = stampCards.filter(card => card.isRedeemed);

  // 쿠폰 분류: 보유 중 (미사용) vs. 사용됨
  const availableCoupons = coupons.filter(coupon => !coupon.isUsed);
  const usedCoupons = coupons.filter(coupon => coupon.isUsed);


  return (
     <>
      <div className="container mx-auto max-w-2xl py-3">
         
        {/* --- 최상위 탭: 보유 중 / 사용 내역 --- */}
        <Tabs defaultValue="available" className="w-full mt-10">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg mb-4">
            <TabsTrigger value="available" className="data-[state=active]:bg-[#E8F5E9] data-[state=active]:text-[#4CAF50] data-[state=active]:shadow-sm rounded-md py-2 text-base font-medium transition-colors">
              보유 중 ({activeCards.length + availableCoupons.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-[#E8F5E9] data-[state=active]:text-[#4CAF50] data-[state=active]:shadow-sm rounded-md py-2 text-base font-medium transition-colors">
              사용 내역 ({redeemedCards.length + usedCoupons.length})
            </TabsTrigger>
          </TabsList>

          {/* --- 보유 중 탭 컨텐츠 --- */}
          <TabsContent value="available">
            <div className="space-y-8">
              
              {activeCards.length > 0 ? (
                <div className="space-y-6">
                  {activeCards.map((card) => {
                    const collectedStamps = card.entries.length;
                    const cardStatusText = `${STAMPS_PER_CARD - collectedStamps}개 더 모으면 쿠폰이 발급됩니다!`;
                    const isCardFull = collectedStamps >= STAMPS_PER_CARD;

                    return (
                      <Card key={card.id} className={`p-6 bg-white border-[#81C784] shadow-lg`}>
                        <CardHeader className="text-center pb-4">
                          
                          <CardDescription className={`text-lg text-[#81C784]`}>
                            {cardStatusText}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-5 gap-3 p-3 border-dashed border-2 rounded-lg bg-[#F9FAFB] border-[#D1E7DD]">
                            {card.entries.map((stamp) => (
                              <StampSlot key={stamp.id} stamp={stamp} onStampClick={handleStampClick} />
                            ))}
                            {Array.from({ length: STAMPS_PER_CARD - collectedStamps }).map((_, index) => (
                              <div key={`empty-${card.id}-${index}`} className="aspect-square w-full rounded-full border-2 border-dashed bg-muted/20 border-gray-300" />
                            ))}
                          </div>

                          <div className="mt-8 text-center">
                            {isCardFull && !card.isRedeemed && (
                              <issueCouponFetcher.Form method="post" action="/api/coupons/issue">
                                <input type="hidden" name="intent" value="issueCoupon" />
                                <input type="hidden" name="stampCardId" value={card.id} />
                                <input type="hidden" name="userId" value={userId} />
                                <Button 
                                  type="submit" 
                                  disabled={issueCouponFetcher.state === 'submitting'} 
                                  className="w-full text-lg py-6 animate-pulse bg-[#81C784] text-white hover:bg-[#66BB6A]"
                                >
                                  <Gift className="h-6 w-6 mr-2" />
                                  {issueCouponFetcher.state === 'submitting' ? "쿠폰 발급 중..." : "쿠폰 발급받기"}
                                </Button>
                              </issueCouponFetcher.Form>
                            )}
                          </div>
                     </CardContent>
                      </Card>
                  );
                })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">현재 진행 중인 스탬프 카드가 없습니다.</p>
              )}

              <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4 mt-8">보유 쿠폰</h2>
              {availableCoupons.length > 0 ? (
                <div className="space-y-6">
                  {availableCoupons.map((coupon) => (
                    <Card key={coupon.id} className="border-2 text-left border-[#81C784] bg-[#F0FDF4]">
                      <CardHeader>
                        <CardTitle className="text-xl text-[#66BB6A]">
                          <Gift className="inline-block h-5 w-5 mr-2" />
                          보유한 쿠폰
                        </CardTitle>
                        <CardDescription className="text-[#81C784]">
                          {coupon.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span className="text-gray-800">쿠폰 코드:</span>
                          <span className="p-2 rounded-md tracking-wider bg-[#EEF7EF] text-[#66BB6A]">
                            {coupon.code}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">유효 기간:</span>
                          <span>~ {format(new Date(coupon.expiresAt), "yyyy년 MM월 dd일")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">보유한 쿠폰이 없습니다.</p>
              )}
            </div>
          </TabsContent>

          {/* --- 사용 내역 탭 컨텐츠 --- */}
          <TabsContent value="history">
            <div className="space-y-8">
              
              {redeemedCards.length > 0 ? (
                <div className="space-y-6">
                  {redeemedCards.map((card) => {
                    const cardStatusText = card.coupon ? `"${card.coupon.description}" 쿠폰 발급됨` : "쿠폰 발급 없음";
                    return (
                      <Card key={card.id} className="p-4 bg-gray-50 border-gray-200 shadow-sm">
                        <CardHeader className="text-center pb-1">
                      
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-5 gap-3 p-3 border-dashed border-2 rounded-lg bg-[#F9FAFB] border-[#D1E7DD]">
                            {card.entries.map((stamp) => (
                              <StampSlot key={stamp.id} stamp={stamp} onStampClick={handleStampClick} />
                            ))}
                            {Array.from({ length: STAMPS_PER_CARD - card.entries.length }).map((_, index) => (
                              <div key={`empty-${card.id}-${index}`} className="aspect-square w-full rounded-full border-2 border-dashed bg-muted/20 border-gray-300" />
                            ))}
                          </div>
<CardDescription className="text-center text-sm text-gray-500 mt-2">
                            {cardStatusText} ({format(new Date(card.createdAt), "yyyy.MM.dd")})
                          </CardDescription>
                        </CardContent>
                      </Card>
                  );
                })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">완료된 스탬프 카드가 없습니다.</p>
              )}

              <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4 mt-8">사용한 쿠폰</h2>
              {usedCoupons.length > 0 ? (
                <div className="space-y-6">
                  {usedCoupons.map((coupon) => (
                    <Card key={coupon.id} className="border-2 text-left border-gray-300 bg-gray-50">
                      <CardHeader>
                        <CardTitle className="text-xl text-gray-500">
                          <Gift className="inline-block h-5 w-5 mr-2" />
                          사용한 쿠폰
                        </CardTitle>
                        <CardDescription className="text-gray-400">
                          {coupon.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span className="text-gray-400">쿠폰 코드:</span>
                          <span className="p-2 rounded-md tracking-wider bg-gray-200 text-gray-500 line-through">
                            {coupon.code}
                          </span>
                        </div>
                   
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-10">사용한 쿠폰이 없습니다.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- 이벤트 상세 정보 다이얼로그 (수정된 부분) --- */}
      <Dialog open={!!viewingEventId} onOpenChange={(isOpen) => { if (!isOpen) setViewingEventId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          {fetcher.state === 'loading' || !fetcher.data ? (
            <DialogHeader>
              <DialogTitle className="text-gray-800">이벤트 정보를 불러오는 중...</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground pt-2"></DialogDescription>
            </DialogHeader>
          ) : (
            <>
              {/* 이미지를 DialogHeader 바깥으로 이동 */}
              {fetcher.data.event.images && fetcher.data.event.images.length > 0 && (
                <img src={fetcher.data.event.images[0].url} alt={fetcher.data.event.name} className="w-full h-48 object-cover rounded-md mb-4" />
              )}
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800">{fetcher.data.event.name}</DialogTitle>
                <DialogDescription className="text-sm text-gray-600 pt-2">
                  {fetcher.data.event.description || "이벤트 설명이 없습니다."}
                </DialogDescription>
              </DialogHeader>
              
              {/* Badge와 Rating 정보를 DialogHeader와 DialogDescription 사이에 위치 */}
              <div className="flex justify-between items-center mt-4">
                <Badge variant="outline" className="w-fit border-[#81C784] text-[#81C784]">
                  {fetcher.data.event.category.name}
                </Badge>
                {fetcher.data.event.averageRating !== null && fetcher.data.event.reviewCount > 0 && (
                  <div className="flex items-center text-sm">
                    <Star className="h-4 w-4 mr-1 text-[#FFD700] fill-[#FFD700]"/>
                    <span className="font-bold text-slate-700">{fetcher.data.event.averageRating.toFixed(1)}</span>
                    <span className="ml-1 text-muted-foreground">({fetcher.data.event.reviewCount})</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-4 text-sm text-gray-700">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-[#81C784]" />
                  {new Date(fetcher.data.event.startDate).toLocaleDateString()} ~ {new Date(fetcher.data.event.endDate).toLocaleDateString()}
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-[#4FC3F7]" />
                  총 {fetcher.data.event._count.participants + fetcher.data.event._count.claimableStamps}명 참여
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button asChild className="bg-[#81C784] hover:bg-[#66BB6A] text-white">
                  <Link to={`/events/${fetcher.data.event.id}`}>상세 페이지로 이동</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Toaster richColors /> {/* Toast 컴포넌트 추가 */}
    </>
  );
}