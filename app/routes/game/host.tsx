// app/routes/game.host.tsx

import { useLoaderData, useRevalidator, useFetcher } from "react-router";
import { db } from "~/lib/db.server";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { RotateCcw, Eye, CheckCircle2, HelpCircle } from "lucide-react";
// 👇 요청하신 라이브러리로 변경했습니다.
import { QRCodeSVG } from 'qrcode.react';

export const loader = async () => {
    const session = await db.gameSession.findFirst();
    return { session };
};

export const action = async () => {
    const session = await db.gameSession.findFirst();
    if (session) {
        // 다음 팀을 위해 모든 상태 초기화
        await db.gameSession.update({
            where: { id: session.id },
            data: {
                char1: "", char2: "", char3: "",
                isTaken1: false, isTaken2: false, isTaken3: false
            },
        });
    }
    return { success: true };
};

export default function GameHostPage() {
    const { session } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const fetcher = useFetcher();
    const [isRevealed, setIsRevealed] = useState(false);
    const [origin, setOrigin] = useState("");

    // 클라이언트 사이드에서만 주소(origin)를 가져오고, 1초마다 데이터 갱신
    useEffect(() => {
        setOrigin(window.location.origin);

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                revalidator.revalidate();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [revalidator]);

    const char1 = session?.char1 || "";
    const char2 = session?.char2 || "";
    const char3 = session?.char3 || "";
    const playUrl = `${origin}/game/play`;

    // 초기화 핸들러
    const handleReset = () => {
        setIsRevealed(false); // 가림막 내리기
        fetcher.submit({}, { method: "post" }); // DB 초기화
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4 relative">

            {/* 👇 우측 상단 QR 코드 영역 */}
            <div className="absolute top-4 right-4 flex flex-col items-center bg-white p-2 rounded-lg shadow-lg">
                {origin && (
                    <QRCodeSVG
                        value={playUrl}
                        size={100}
                        level={"H"} // 오류 복원 레벨 (L, M, Q, H)
                    />
                )}
                <span className="text-black text-xs font-bold mt-1">참가자 접속</span>
            </div>

            <h1 className="text-3xl text-slate-400 font-bold mb-12 tracking-widest uppercase">
                TELEPATHY GAME
            </h1>

            {/* 카드 영역 */}
            <div className="flex gap-4 md:gap-8 mb-16">
                <SecretCard char={char1} label="1번 타자" color="border-red-500" iconColor="text-red-500" isRevealed={isRevealed} isTaken={session?.isTaken1} />
                <SecretCard char={char2} label="2번 타자" color="border-blue-500" iconColor="text-blue-500" isRevealed={isRevealed} isTaken={session?.isTaken2} />
                <SecretCard char={char3} label="3번 타자" color="border-green-500" iconColor="text-green-500" isRevealed={isRevealed} isTaken={session?.isTaken3} />
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-4 mt-4">
                {!isRevealed ? (
                    <Button
                        onClick={() => setIsRevealed(true)}
                        size="lg"
                        className="text-2xl px-12 py-8 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold shadow-[0_0_20px_rgba(250,204,21,0.5)]"
                    >
                        <Eye className="mr-3 h-8 w-8" /> 정답 공개
                    </Button>
                ) : (
                    <Button onClick={() => setIsRevealed(false)} size="lg" variant="secondary" className="text-xl px-10 py-8">
                        다시 가리기
                    </Button>
                )}

                <Button onClick={handleReset} size="lg" variant="destructive" className="text-xl px-8 py-8">
                    <RotateCcw className="mr-2 h-6 w-6" /> 다음 팀 (리셋)
                </Button>
            </div>
        </div>
    );
}

// 카드 컴포넌트 (변경 없음)
function SecretCard({ char, label, color, iconColor, isRevealed, isTaken }: any) {
    const hasInput = char.length > 0;
    return (
        <div className="flex flex-col items-center gap-4">
            <div className={`
        w-28 h-40 md:w-48 md:h-64 
        flex items-center justify-center 
        bg-slate-800 rounded-2xl 
        border-b-8 ${hasInput ? color : 'border-slate-700'} 
        shadow-2xl transition-all duration-300 transform
        ${isRevealed ? 'rotate-0' : ''}
      `}>
                {isRevealed ? (
                    <span className="text-7xl md:text-9xl font-black text-white animate-in zoom-in spin-in-3 duration-500">
                        {char || ""}
                    </span>
                ) : (
                    hasInput ? (
                        <CheckCircle2 className={`w-16 h-16 md:w-24 md:h-24 ${iconColor} animate-bounce`} />
                    ) : (
                        isTaken ? (
                            <span className="text-base md:text-xl text-slate-500 font-medium animate-pulse">입력 중...</span>
                        ) : (
                            <HelpCircle className="w-12 h-12 text-slate-700 opacity-20" />
                        )
                    )
                )}
            </div>
            <span className={`text-xl font-bold ${hasInput ? 'text-white' : 'text-slate-600'}`}>{label}</span>
        </div>
    );
}