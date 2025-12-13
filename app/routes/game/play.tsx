// app/routes/game.play.tsx

import { type ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { db } from "~/lib/db.server";
import { useState, useEffect, useMemo } from "react"; // useMemo 추가
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Save, RefreshCcw } from "lucide-react"; // 아이콘 추가

export const loader = async () => {
    let session = await db.gameSession.findFirst();
    if (!session) {
        session = await db.gameSession.create({ data: {} });
    }
    return { session };
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const intent = formData.get("intent");
    const position = formData.get("position");
    const char = formData.get("char")?.toString() || "";

    const session = await db.gameSession.findFirst();
    if (!session) return { success: false };

    const data: any = {};

    if (intent === "occupy") {
        if (position === "1" && session.isTaken1) return { success: false };
        if (position === "2" && session.isTaken2) return { success: false };
        if (position === "3" && session.isTaken3) return { success: false };

        if (position === "1") data.isTaken1 = true;
        if (position === "2") data.isTaken2 = true;
        if (position === "3") data.isTaken3 = true;
    }
    else if (intent === "input") {
        if (position === "1") data.char1 = char;
        if (position === "2") data.char2 = char;
        if (position === "3") data.char3 = char;
    }
    else if (intent === "release") {
        if (position === "1") { data.isTaken1 = false; data.char1 = ""; }
        if (position === "2") { data.isTaken2 = false; data.char2 = ""; }
        if (position === "3") { data.isTaken3 = false; data.char3 = ""; }
    }

    await db.gameSession.update({ where: { id: session.id }, data });
    return { success: true };
};

export default function GamePlayPage() {
    const { session } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const revalidator = useRevalidator();

    const [myPosition, setMyPosition] = useState<string | null>(null);
    const [myChar, setMyChar] = useState("");

    // 현재 서버에 저장된 내 자리의 글자 (비교용)
    const serverChar = useMemo(() => {
        if (myPosition === "1") return session.char1;
        if (myPosition === "2") return session.char2;
        if (myPosition === "3") return session.char3;
        return "";
    }, [session, myPosition]);

    // 내 입력값과 서버값이 같은지 확인 (저장 상태 확인)
    const isSaved = myChar === serverChar;

    // 1. 초기 로드 시 내 자리 복구
    useEffect(() => {
        const savedPosition = localStorage.getItem("myGamePosition");
        if (savedPosition) {
            setMyPosition(savedPosition);
            // 복구 시 서버에 있는 값을 입력창에 넣어줌
            if (savedPosition === "1") setMyChar(session.char1);
            if (savedPosition === "2") setMyChar(session.char2);
            if (savedPosition === "3") setMyChar(session.char3);
        }
    }, []); // 최초 1회만 실행

    // 2. 실시간 데이터 동기화 (1초마다)
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                revalidator.revalidate();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [revalidator]);

    // 3. 튕김 방지 및 리셋 처리
    useEffect(() => {
        const isOccupyingNow = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "occupy";
        if (isOccupyingNow) return;

        if (myPosition === "1" && !session.isTaken1) handleForceReset();
        if (myPosition === "2" && !session.isTaken2) handleForceReset();
        if (myPosition === "3" && !session.isTaken3) handleForceReset();
    }, [session, myPosition, fetcher.state]);

    const handleForceReset = () => {
        setMyPosition(null);
        setMyChar("");
        localStorage.removeItem("myGamePosition");
    };

    const handleSelectPosition = (pos: string) => {
        setMyPosition(pos);
        localStorage.setItem("myGamePosition", pos);

        // 자리를 잡을 때 서버에 있는 기존 값이 있다면 가져옴
        if (pos === "1") setMyChar(session.char1);
        if (pos === "2") setMyChar(session.char2);
        if (pos === "3") setMyChar(session.char3);

        fetcher.submit({ intent: "occupy", position: pos }, { method: "post" });
    };

    const handleReleasePosition = () => {
        if (myPosition) {
            fetcher.submit({ intent: "release", position: myPosition }, { method: "post" });
        }
        handleForceReset();
    };

    // ▼ 글자 입력 핸들러 (서버 전송 X, 로컬 상태만 변경)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.slice(-1);
        setMyChar(val);
    };

    // ▼ [추가] 저장 버튼 핸들러 (여기서 서버로 전송)
    const handleSave = () => {
        if (myPosition) {
            fetcher.submit({ intent: "input", position: myPosition, char: myChar }, { method: "post" });
        }
    };

    return (
        <div className="container mx-auto max-w-md min-h-screen py-6 px-4 bg-slate-50 flex flex-col items-center">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">이구동성 텔레파시 📡</h1>

            {!myPosition ? (
                <Card className="w-full shadow-lg border-0">
                    <CardHeader>
                        <CardTitle className="text-center text-xl">나의 위치 선택</CardTitle>
                        <p className="text-center text-sm text-gray-500">팀원들과 상의 없이 눈치껏 고르세요!</p>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3">
                        <PositionButton num="1" role="첫 번째 글자" color="bg-red-50 text-red-600 border-red-200" isTaken={session.isTaken1} onClick={() => handleSelectPosition("1")} />
                        <PositionButton num="2" role="두 번째 글자" color="bg-blue-50 text-blue-600 border-blue-200" isTaken={session.isTaken2} onClick={() => handleSelectPosition("2")} />
                        <PositionButton num="3" role="세 번째 글자" color="bg-green-50 text-green-600 border-green-200" isTaken={session.isTaken3} onClick={() => handleSelectPosition("3")} />
                    </CardContent>
                </Card>
            ) : (
                <div className="w-full flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
                    <Badge className="text-lg px-4 py-1 mb-2 bg-slate-800">
                        {myPosition}번 타자 ({myPosition === "1" ? "첫글자" : myPosition === "2" ? "가운데" : "마지막"})
                    </Badge>

                    <div className="flex flex-col items-center gap-4 w-full">
                        <div className="relative w-full aspect-square max-w-[320px]">
                            <Input
                                type="text"
                                value={myChar}
                                onChange={handleInputChange}
                                className={`
                                    w-full h-full text-center font-black border-4 rounded-[2rem] shadow-xl caret-transparent p-0 leading-none
                                    text-[100px] /* 폰트 크기 대폭 확대 */
                                    focus:ring-4 focus:ring-slate-300
                                    ${isSaved ? 'border-slate-800 bg-white text-black' : 'border-yellow-500 bg-yellow-50 text-black'}
                                `}
                                maxLength={1}
                                autoFocus
                                placeholder="?"
                            />
                        </div>

                        {/* 상태 메시지 */}
                        <div className="h-6 text-sm font-bold">
                            {isSaved ? (
                                <span className="text-green-600 flex items-center gap-1">✅ 서버에 저장됨</span>
                            ) : (
                                <span className="text-yellow-600 flex items-center gap-1 animate-pulse">⚠️ 저장되지 않음 (버튼을 누르세요)</span>
                            )}
                        </div>
                    </div>

                    {/* ▼ 저장 버튼 추가 */}
                    <div className="flex gap-3 w-full max-w-[250px]">
                        <Button
                            onClick={handleSave}
                            disabled={isSaved || myChar === ""} // 이미 저장되었거나 빈칸이면 비활성 (선택사항)
                            className={`flex-1 h-14 text-xl font-bold shadow-md transition-all
                                ${isSaved
                                    ? "bg-slate-200 text-slate-400 hover:bg-slate-300"
                                    : "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105"
                                }
                            `}
                        >
                            <Save className="mr-2 h-5 w-5" />
                            {isSaved ? "저장 완료" : "저장하기"}
                        </Button>
                    </div>

                    <Button variant="outline" onClick={handleReleasePosition} className="mt-4 text-slate-400">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        자리 다시 고르기
                    </Button>
                </div>
            )}
        </div>
    );
}

function PositionButton({ num, role, color, isTaken, onClick }: any) {
    return (
        <Button
            onClick={onClick}
            disabled={isTaken}
            className={`
        h-20 text-lg border-2 flex items-center justify-between px-6 transition-all
        ${isTaken
                    ? "bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed opacity-70"
                    : `${color} hover:brightness-95 hover:scale-[1.02] shadow-sm`
                }
      `}
        >
            <div className="flex items-center gap-3">
                <span className="text-2xl font-black">{num}</span>
                <span className="text-sm font-bold">{role}</span>
            </div>
            {isTaken ? <span className="text-xs font-bold">선점됨</span> : <span className="text-xs bg-white/50 px-2 py-1 rounded">선택 가능</span>}
        </Button>
    );
}