// app/routes/game.host.tsx

import { type LoaderFunctionArgs, useLoaderData, useRevalidator, useFetcher, type ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { RotateCcw, Eye, CheckCircle2, HelpCircle, Plus, Minus } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import * as z from 'zod';

// ------------------------------------------------------------------
// 1. 타입 및 초기 상태 정의
// ------------------------------------------------------------------
type GameEntry = {
    position: number;
    char: string;
    claimerId: string | null;
    claimerName: string | null;
}

type GameTeam = {
    id: number;
    name: string;
    entries: GameEntry[];
}

type GameState = {
    teams: GameTeam[];
};

// 초기 상태: 1팀만 존재
const initialGameState: GameState = {
    teams: [
        {
            id: 1, name: "1팀", entries: [
                { position: 1, char: "", claimerId: null, claimerName: null },
                { position: 2, char: "", claimerId: null, claimerName: null },
                { position: 3, char: "", claimerId: null, claimerName: null },
            ]
        },
    ],
};

// ------------------------------------------------------------------
// 2. LOADER (객체 직접 반환)
// ------------------------------------------------------------------
export const loader = async ({ params }: LoaderFunctionArgs) => {
    const sessionId = 1;
    let session = await db.gameSession.findUnique({
        where: { id: sessionId },
        select: { isRevealed: true, gameState: true },
    });

    if (!session) {
        session = await db.gameSession.create({
            data: {
                id: sessionId,
                gameState: initialGameState as any,
                isRevealed: false
            },
            select: { isRevealed: true, gameState: true }
        });
    }

    const gameState = session.gameState as unknown as GameState;
    const teams = gameState.teams || initialGameState.teams;

    // 🚨 [약속] 객체 그대로 반환
    return {
        isRevealed: session.isRevealed,
        teams,
    };
};

// ------------------------------------------------------------------
// 3. ACTION (객체 직접 반환)
// ------------------------------------------------------------------
const actionSchema = z.object({
    action: z.enum(["reset", "toggle-reveal", "add-team", "remove-team"]),
});

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const result = actionSchema.safeParse(Object.fromEntries(formData));
    const sessionId = 1;

    if (!result.success) {
        return { error: "잘못된 요청입니다." };
    }

    const { action } = result.data;

    // [리셋]
    if (action === "reset") {
        await db.gameSession.update({
            where: { id: sessionId },
            data: { gameState: initialGameState as any, isRevealed: false },
        });
        return { success: true };
    }

    // [공개 토글]
    if (action === "toggle-reveal") {
        const session = await db.gameSession.findUnique({ where: { id: sessionId }, select: { isRevealed: true } });
        if (session) {
            await db.gameSession.update({
                where: { id: sessionId },
                data: { isRevealed: !session.isRevealed },
            });
        }
        return { success: true };
    }

    // [팀 추가]
    if (action === "add-team") {
        const session = await db.gameSession.findUnique({ where: { id: sessionId }, select: { gameState: true } });
        if (session) {
            const currentGameState = session.gameState as unknown as GameState;
            const currentTeams = currentGameState.teams || [];

            const nextId = currentTeams.length + 1;

            const newTeam: GameTeam = {
                id: nextId,
                name: `${nextId}팀`,
                entries: [
                    { position: 1, char: "", claimerId: null, claimerName: null },
                    { position: 2, char: "", claimerId: null, claimerName: null },
                    { position: 3, char: "", claimerId: null, claimerName: null },
                ]
            };

            currentGameState.teams.push(newTeam);

            await db.gameSession.update({
                where: { id: sessionId },
                data: { gameState: currentGameState as any },
            });
        }
        return { success: true };
    }

    // [팀 삭제]
    if (action === "remove-team") {
        const session = await db.gameSession.findUnique({ where: { id: sessionId }, select: { gameState: true } });
        if (session) {
            const currentGameState = session.gameState as unknown as GameState;
            if (currentGameState.teams.length > 1) {
                currentGameState.teams.pop();
                await db.gameSession.update({
                    where: { id: sessionId },
                    data: { gameState: currentGameState as any },
                });
            }
        }
        return { success: true };
    }

    return { success: false };
};

// ------------------------------------------------------------------
// 4. COMPONENT (레이아웃 수정)
// ------------------------------------------------------------------

export default function GameHostPage() {
    const { isRevealed, teams } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const fetcher = useFetcher();
    const [origin, setOrigin] = useState("");

    const POLLING_INTERVAL = 5000;

    useEffect(() => {
        setOrigin(window.location.origin);
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                revalidator.revalidate();
            }
        }, POLLING_INTERVAL);
        return () => clearInterval(interval);
    }, [revalidator]);

    const playUrl = `${origin}/game/play`;
    const isSubmitting = fetcher.state !== 'idle';

    const handleReset = () => {
        if (confirm("정말 리셋하시겠습니까? 팀이 1개로 초기화되고 모든 입력이 사라집니다.")) {
            fetcher.submit({ action: "reset" }, { method: "post" });
        }
    };
    const handleToggleReveal = () => fetcher.submit({ action: "toggle-reveal" }, { method: "post" });
    const handleAddTeam = () => fetcher.submit({ action: "add-team" }, { method: "post" });
    const handleRemoveTeam = () => {
        if (teams.length > 1 && confirm(`마지막 팀(${teams.length}팀)을 삭제하시겠습니까?`)) {
            fetcher.submit({ action: "remove-team" }, { method: "post" });
        }
    };

    // 🚨 [핵심 수정] 팀 배치 레이아웃 규칙 변경
    let gridClass = "grid gap-8 w-full max-w-7xl px-4 ";

    if (teams.length === 1) {
        // 1팀: 중앙 정렬 (1열)
        gridClass += "grid-cols-1 max-w-2xl";
    } else if (teams.length <= 4) {
        // 2~4팀: 2열 배치 (1 2 / 3 4)
        // ✨ 2팀일 때도 좌우로 나란히 보여서 한 화면에 다 들어옵니다.
        gridClass += "grid-cols-1 md:grid-cols-2";
    } else {
        // 5팀 이상: 3열 배치 (1 2 3 / 4 5 6)
        gridClass += "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start text-white p-4 relative pb-40">

            {/* QR 코드 (우측 상단) */}
            <div className="absolute top-4 right-4 flex flex-col items-center bg-white p-2 rounded-lg shadow-lg z-10">
                {origin && <QRCodeSVG value={playUrl} size={100} level={"H"} />}
                <span className="text-black text-xs font-bold mt-1">참가자 접속</span>
            </div>

            <h1 className="text-3xl text-slate-400 font-bold mb-8 tracking-widest uppercase mt-10">
                TELEPATHY TEAM BATTLE
            </h1>

            {/* 상태 표시 */}
            <div className={`text-center font-bold text-lg p-3 rounded-lg w-full max-w-xl mb-8 ${isRevealed ? 'bg-red-600 text-white shadow-red-800/50' : 'bg-blue-600 text-white shadow-blue-800/50'} shadow-lg`}>
                현재 상태: {isRevealed ? '글자 공개됨' : '글자 비공개 상태'}
            </div>

            {/* 🚨 [적용] 팀별 카드 영역 (그리드 클래스 적용) */}
            <div className={gridClass}>
                {teams.map((team, index) => {
                    const colors = [
                        { border: 'border-red-500', text: 'text-red-500', title: 'text-red-500' },
                        { border: 'border-blue-500', text: 'text-blue-500', title: 'text-blue-500' },
                        { border: 'border-green-500', text: 'text-green-500', title: 'text-green-500' },
                        { border: 'border-yellow-500', text: 'text-yellow-500', title: 'text-yellow-500' },
                        { border: 'border-purple-500', text: 'text-purple-500', title: 'text-purple-500' },
                    ];
                    const theme = colors[index % colors.length];

                    return (
                        <div key={team.id} className="bg-slate-800 p-4 rounded-xl shadow-2xl border-b-4 border-slate-700 flex flex-col items-center">
                            <h2 className={`text-2xl font-extrabold mb-4 ${theme.title}`}>{team.name}</h2>
                            <div className="flex justify-center gap-3 w-full">
                                {team.entries.map(entry => (
                                    <SecretCard
                                        key={entry.position}
                                        char={entry.char}
                                        label={`${entry.position}번`}
                                        color={theme.border}
                                        iconColor={theme.text}
                                        isRevealed={isRevealed}
                                        isClaimed={!!entry.claimerId}
                                        claimerName={entry.claimerName}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 하단 컨트롤 바 (고정) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 border-t border-slate-700 backdrop-blur-md flex flex-col gap-4 items-center z-50">

                {/* 1. 팀 관리 버튼 */}
                <div className="flex gap-4 w-full max-w-lg">
                    <Button
                        onClick={handleAddTeam}
                        disabled={isSubmitting}
                        className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold text-lg"
                    >
                        <Plus className="mr-2 h-5 w-5" /> 팀 추가
                    </Button>

                    <Button
                        onClick={handleRemoveTeam}
                        disabled={isSubmitting || teams.length <= 1}
                        className="flex-1 py-6 bg-slate-800 hover:bg-red-900/30 border border-slate-600 text-slate-400 hover:text-red-400 font-bold text-lg disabled:opacity-30"
                    >
                        <Minus className="mr-2 h-5 w-5" /> 팀 삭제
                    </Button>
                </div>

                {/* 2. 게임 진행 버튼 */}
                <div className="flex gap-4 w-full max-w-lg">
                    {!isRevealed ? (
                        <Button
                            onClick={() => fetcher.submit({ action: "toggle-reveal" }, { method: "post" })}
                            size="lg"
                            className="flex-1 text-2xl py-8 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold shadow-[0_0_20px_rgba(250,204,21,0.5)]"
                        >
                            <Eye className="mr-3 h-8 w-8" /> 정답 공개
                        </Button>
                    ) : (
                        <Button
                            onClick={() => fetcher.submit({ action: "toggle-reveal" }, { method: "post" })}
                            size="lg"
                            variant="secondary"
                            className="flex-1 text-xl py-8"
                        >
                            다시 가리기
                        </Button>
                    )}

                    <Button
                        onClick={handleReset}
                        size="lg"
                        variant="destructive"
                        className="text-xl px-8 py-8 shadow-md"
                    >
                        <RotateCcw className="mr-2 h-6 w-6" />
                        초기화
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// 5. CARD COMPONENT (기존 디자인 유지)
// ------------------------------------------------------------------
function SecretCard({ char, label, color, iconColor, isRevealed, isClaimed, claimerName }: any) {
    const hasInput = char.length > 0;

    return (
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className={`
                w-full aspect-[2/3] 
                flex flex-col items-center justify-center 
                bg-slate-700 rounded-xl 
                border-b-8 ${hasInput ? color : 'border-slate-600'} 
                shadow-2xl transition-all duration-300
            `}>
                {isRevealed ? (
                    <span className="text-5xl md:text-7xl font-black text-white animate-in zoom-in spin-in-3 duration-500 leading-none">
                        {char || "—"}
                    </span>
                ) : (
                    hasInput ? (
                        <CheckCircle2 className={`w-10 h-10 md:w-16 md:h-16 ${iconColor} animate-pulse`} />
                    ) : (
                        isClaimed ? (
                            <span className="text-xs md:text-sm text-slate-400 font-medium">
                                {claimerName ? `${claimerName.slice(0, 1)}**` : '...'}
                            </span>
                        ) : (
                            <HelpCircle className="w-8 h-8 md:w-12 md:h-12 text-slate-600 opacity-20" />
                        )
                    )
                )}
            </div>
            <span className={`text-base font-bold ${hasInput ? 'text-white' : 'text-slate-500'} text-center whitespace-nowrap`}>
                {label}
            </span>
        </div>
    );
}