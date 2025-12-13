// app/routes/game.play.tsx

import { type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { db } from "~/lib/db.server";
import { useState, useEffect, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Save, RefreshCcw, ArrowLeft, Users } from "lucide-react";
import * as z from 'zod';

const generateAnonId = () => {
    if (typeof window === 'undefined') return '';
    return 'anon-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// ------------------------------------------------------------------
// 1. 타입 정의
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
// 2. LOADER
// ------------------------------------------------------------------
export const loader = async ({ request }: LoaderFunctionArgs) => {
    const sessionId = 1;
    let session = await db.gameSession.findUnique({ where: { id: sessionId } });

    if (!session) {
        session = await db.gameSession.create({
            data: { id: sessionId, gameState: initialGameState as any, isRevealed: false }
        });
    }

    const gameState = session.gameState as unknown as GameState;

    return {
        sessionId: session.id,
        isRevealed: session.isRevealed,
        gameState,
    };
};

// ------------------------------------------------------------------
// 3. ACTION
// ------------------------------------------------------------------
const actionSchema = z.object({
    intent: z.enum(["occupy", "input", "release"]),
    anonId: z.string().min(1),
    claimerName: z.string().optional(),
    teamId: z.string().transform(Number).optional(),
    position: z.string().transform(Number).optional(),
    char: z.string().max(1).optional(),
    sessionId: z.string().transform(Number),
});

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const sessionId = 1;
    formData.append("sessionId", sessionId.toString());

    const result = actionSchema.safeParse(Object.fromEntries(formData));

    if (!result.success) return { error: "잘못된 요청입니다." };

    const { intent, teamId, position, char, anonId, claimerName } = result.data;
    const finalClaimerName = claimerName || "익명";

    try {
        const updateResult = await db.$transaction(async (prisma) => {
            const session = await prisma.gameSession.findUnique({
                where: { id: sessionId },
                select: { gameState: true },
            });

            if (!session) throw new Error("No session");

            const currentGameState: GameState = session.gameState as unknown as GameState;
            const updatedGameState = JSON.parse(JSON.stringify(currentGameState));

            const team = updatedGameState.teams.find((t: GameTeam) => t.id === teamId);
            const entry = team?.entries.find((e: GameEntry) => e.position === position);

            if (!team || !entry) throw new Error("Invalid target");

            let responseMessage = "";
            let status = 200;

            switch (intent) {
                case "occupy":
                    // [선점 로직] 남이 이미 먹었으면 실패 (내가 아닐 때만)
                    if (entry.claimerId && entry.claimerId !== anonId) {
                        responseMessage = "이미 선점된 자리입니다.";
                        status = 409;
                    } else {
                        entry.claimerId = anonId;
                        entry.claimerName = finalClaimerName;
                        responseMessage = "선점 성공";
                    }
                    break;

                case "input":
                    if (entry.claimerId !== anonId) {
                        status = 403; // 뺏김
                    } else {
                        entry.char = char || "";
                        responseMessage = "저장됨";
                    }
                    break;

                case "release":
                    if (entry.claimerId === anonId) {
                        entry.claimerId = null;
                        entry.claimerName = null;
                        entry.char = "";
                    }
                    break;
            }

            if (status !== 200) return { success: false, message: responseMessage };

            await prisma.gameSession.update({
                where: { id: sessionId },
                data: { gameState: updatedGameState as any },
            });

            return { success: true, message: responseMessage };
        });

        return updateResult;

    } catch (error) {
        return { error: "Error" };
    }
};

// ------------------------------------------------------------------
// 4. COMPONENT
// ------------------------------------------------------------------

export default function GamePlayPage() {
    const { isRevealed, gameState } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const fetcher = useFetcher();

    const [anonId, setAnonId] = useState<string>('');
    const [claimerName, setClaimerName] = useState<string>('');

    // 상태
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [myPosition, setMyPosition] = useState<number | null>(null);
    const [myChar, setMyChar] = useState("");

    const POLLING_INTERVAL = 3000;

    // 🚨 [수정 1] 초기화 & 복구 (딱 한 번만 실행!)
    // 의존성 배열을 []로 비워서, 폴링이 돌든 말든 처음에만 실행되게 합니다.
    useEffect(() => {
        // 1. 익명 ID 설정
        let currentAnonId = localStorage.getItem("myAnonId");
        if (!currentAnonId) {
            currentAnonId = generateAnonId();
            localStorage.setItem("myAnonId", currentAnonId);
        }
        setAnonId(currentAnonId);
        setClaimerName(localStorage.getItem("myClaimerName") || '');

        // 2. 자리 복구
        const savedTeamId = localStorage.getItem("myGameTeamId");
        const savedPosition = localStorage.getItem("myGamePosition");

        if (savedTeamId) {
            setSelectedTeamId(Number(savedTeamId));
            if (savedPosition) {
                setMyPosition(Number(savedPosition));

                // 내 글자 불러오기 (최초 1회만)
                const currentEntry = gameState.teams
                    .find(t => t.id === Number(savedTeamId))?.entries
                    .find(e => e.position === Number(savedPosition));
                if (currentEntry) setMyChar(currentEntry.char);
            }
        }
    }, []); // 👈 여기가 핵심! 빈 배열로 둬서 리렌더링 시 실행 방지

    // [폴링] 데이터 최신화
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") revalidator.revalidate();
        }, POLLING_INTERVAL);
        return () => clearInterval(interval);
    }, [revalidator]);

    // 🚨 [수정 2] 상태 감지 (튕겨남 체크만 수행, 글자 덮어쓰기 X)
    useEffect(() => {
        if (!selectedTeamId || !myPosition || !anonId) return;

        const currentEntry = gameState.teams
            .find(t => t.id === selectedTeamId)?.entries
            .find(e => e.position === myPosition);

        if (!currentEntry) return;

        // 누군가 내 자리를 뺏었거나 리셋된 경우에만 반응
        if (currentEntry.claimerId && currentEntry.claimerId !== anonId) {
            setMyPosition(null);
            localStorage.removeItem("myGamePosition");
            alert("다른 사용자가 선점했습니다.");
        }
        // 💡 중요: 여기서 setMyChar를 호출하지 않음으로써 입력 중인 글자를 보호합니다.
    }, [gameState, selectedTeamId, myPosition, anonId]);

    // --------------------------------------------------------
    // 핸들러
    // --------------------------------------------------------

    const handleSelectTeam = (teamId: number) => {
        setSelectedTeamId(teamId);
        localStorage.setItem("myGameTeamId", teamId.toString());
    };

    const handleSelectPosition = (position: number) => {
        if (!anonId || !selectedTeamId) return;

        fetcher.submit({
            intent: "occupy", teamId: selectedTeamId, position, anonId, claimerName
        }, { method: "post" });

        setMyPosition(position);
        localStorage.setItem("myGamePosition", position.toString());
        localStorage.setItem("myClaimerName", claimerName);

        // 자리를 새로 잡을 때만 서버 값으로 초기화
        const currentEntry = gameState.teams
            .find(t => t.id === selectedTeamId)?.entries
            .find(e => e.position === position);
        if (currentEntry) setMyChar(currentEntry.char);
    };

    const handleBackToPositions = () => {
        if (selectedTeamId && myPosition) {
            fetcher.submit({ intent: "release", teamId: selectedTeamId, position: myPosition, anonId }, { method: "post" });
        }
        setMyPosition(null);
        setMyChar("");
        localStorage.removeItem("myGamePosition");
    };

    const handleBackToTeams = () => {
        setSelectedTeamId(null);
        localStorage.removeItem("myGameTeamId");
    };

    const handleSave = () => {
        if (selectedTeamId && myPosition && anonId) {
            fetcher.submit({ intent: "input", teamId: selectedTeamId, position: myPosition, char: myChar, anonId }, { method: "post" });
        }
    };

    // --------------------------------------------------------
    // 화면 렌더링
    // --------------------------------------------------------

    const currentTeam = gameState.teams.find(t => t.id === selectedTeamId);

    // 저장 여부 확인 (UI 표시용)
    const currentEntryState = currentTeam?.entries.find(e => e.position === myPosition);
    // 🚨 내 로컬 값(myChar)과 서버 값(currentEntryState.char)이 같으면 저장된 것
    const isSaved = currentEntryState?.char === myChar && myChar !== "";

    // 화면 1: 이름 입력
    if (!claimerName) {
        return (
            <div className="container mx-auto max-w-md min-h-screen flex flex-col justify-center px-4 bg-slate-50">
                <Card className="w-full shadow-lg">
                    <CardHeader><CardTitle className="text-center">이름을 입력하세요</CardTitle></CardHeader>
                    <CardContent>
                        <Input
                            autoFocus
                            placeholder="닉네임 (예: 홍길동)"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = (e.target as HTMLInputElement).value;
                                    if (val.trim()) {
                                        setClaimerName(val);
                                        localStorage.setItem("myClaimerName", val);
                                    }
                                }
                            }}
                            className="text-center text-lg h-12 mb-4"
                        />
                        <p className="text-center text-sm text-gray-500">입력 후 엔터를 누르세요</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 화면 2: 팀 선택
    const showTeamSelect = !selectedTeamId && gameState.teams.length > 1;

    if (showTeamSelect) {
        return (
            <div className="container mx-auto max-w-md min-h-screen py-8 px-4 bg-slate-50 flex flex-col items-center">
                <h1 className="text-2xl font-bold mb-8 text-slate-800">팀을 선택하세요</h1>
                <div className="w-full space-y-4">
                    {gameState.teams.map(team => (
                        <Button
                            key={team.id}
                            onClick={() => handleSelectTeam(team.id)}
                            className="w-full h-20 text-2xl font-bold bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-100 hover:border-indigo-500 shadow-sm flex justify-between px-8"
                        >
                            <span>{team.name}</span>
                            <Users className="w-6 h-6 text-slate-400" />
                        </Button>
                    ))}
                </div>
            </div>
        );
    }

    // 화면 3: 자리 선택
    const activeTeam = selectedTeamId ? currentTeam : gameState.teams[0];

    if (!myPosition) {
        return (
            <div className="container mx-auto max-w-md min-h-screen py-8 px-4 bg-slate-50 flex flex-col items-center">
                <div className="w-full flex items-center mb-8 relative justify-center">
                    {gameState.teams.length > 1 && (
                        <Button variant="ghost" size="icon" className="absolute left-0" onClick={handleBackToTeams}>
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                    )}
                    <h1 className="text-2xl font-bold text-slate-800">{activeTeam?.name} 자리 선택</h1>
                </div>

                <div className="grid grid-cols-1 gap-4 w-full">
                    {activeTeam?.entries.map(entry => {
                        const isTaken = entry.claimerId !== null;
                        const isMySpot = entry.claimerId === anonId;

                        return (
                            <Button
                                key={entry.position}
                                disabled={isTaken && !isMySpot}
                                onClick={() => {
                                    if (!selectedTeamId) setSelectedTeamId(gameState.teams[0].id);
                                    handleSelectPosition(entry.position);
                                }}
                                className={`
                                    h-24 text-2xl font-black shadow-md transition-all border-2
                                    ${isMySpot
                                        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                        : isTaken
                                            ? "bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed"
                                            : "bg-white text-slate-800 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
                                    }
                                `}
                            >
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl">{entry.position}</span>
                                    <span className="text-sm font-normal opacity-80">
                                        {isTaken ? (isMySpot ? "나의 선택" : (entry.claimerName || "선점됨")) : "선택 가능"}
                                    </span>
                                </div>
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // 화면 4: 글자 작성
    return (
        <div className="container mx-auto max-w-md min-h-screen py-6 px-4 bg-slate-50 flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-6">
                <Button variant="ghost" onClick={handleBackToPositions} className="text-slate-500">
                    <ArrowLeft className="mr-2 h-5 w-5" /> 자리 변경
                </Button>
                <Badge className="text-lg px-4 py-1 bg-indigo-600 text-white">
                    {activeTeam?.name} - {myPosition}번
                </Badge>
            </div>

            {isRevealed ? (
                <div className="flex-1 flex flex-col justify-center items-center w-full">
                    <div className="p-8 text-center text-red-600 border-2 border-red-300 bg-red-50 rounded-xl w-full shadow-lg">
                        <p className="text-3xl font-bold mb-2">공개되었습니다!</p>
                        <p className="text-lg">화면을 확인하세요</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 w-full flex flex-col items-center gap-6">
                    <div className="relative w-full aspect-square max-w-[300px]">
                        <Input
                            type="text"
                            value={myChar}
                            onChange={(e) => setMyChar(e.target.value)}
                            className={`
        w-full h-full text-center font-black border-4 rounded-[2.5rem] shadow-2xl caret-transparent p-0 leading-none
        text-[140px] 
        focus:ring-8 focus:ring-indigo-100 transition-all duration-300
        ${isSaved
                                    ? 'border-green-500 bg-green-50 text-green-600'
                                    : 'border-slate-300 bg-white text-slate-800'
                                }
    `}
                            // 🚨 [수정] 모바일 키보드 오류 방지를 위한 필수 속성들

                            maxLength={1}
                            autoFocus
                            placeholder="?"
                        />
                    </div>

                    <div className="h-8">
                        {isSaved ? (
                            <span className="text-green-600 font-bold text-lg flex items-center gap-2">
                                <Save className="w-5 h-5" /> 서버에 저장됨
                            </span>
                        ) : (
                            <span className="text-slate-400 font-medium animate-pulse">
                                입력 후 전송 버튼을 누르세요
                            </span>
                        )}
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={isSaved || myChar === ""}
                        className={`w-full max-w-[300px] h-20 text-2xl font-bold shadow-xl rounded-2xl transition-all
                            ${isSaved
                                ? "bg-slate-200 text-slate-400 hover:bg-slate-200"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105"
                            }
                        `}
                    >
                        {isSaved ? "전송 완료" : "전송하기"}
                    </Button>
                </div>
            )}
        </div>
    );
}