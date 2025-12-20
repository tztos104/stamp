import { useState, useEffect } from "react";
import { Form, redirect, useActionData, useFetcher } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { Search, UserCheck, UserX, XCircle } from "lucide-react"; // 아이콘 (없으면 생략 가능)
import { User } from "@phosphor-icons/react";

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent"); // 'search' 또는 'create'

    // 🔍 1. 유저 검색 로직 (useFetcher로 호출됨)
    if (intent === "search") {
        const keyword = formData.get("keyword") as string;

        if (!keyword) return { searchError: "검색어를 입력해주세요." };

        // 이름이나 전화번호에 키워드가 '포함'된 유저 검색 (최대 5명)
        const users = await db.user.findMany({
            where: {
                OR: [
                    { name: { contains: keyword } },       // 이름 포함
                    { phoneNumber: { contains: keyword } } // 번호 포함
                ]
            },
            take: 5, // 너무 많이 나오지 않게 5명만 제한
            select: { id: true, name: true, phoneNumber: true }
        });

        if (users.length === 0) {
            return { searchError: "검색 결과가 없습니다." };
        }

        // foundUsers 배열 반환
        return { foundUsers: users };
    }

    // 🚀 2. 방 생성 로직
    if (intent === "create") {
        const title = formData.get("title") as string;
        const dateStr = formData.get("date") as string;
        const password = formData.get("password") as string;

        // 연결할 유저 ID (없으면 null string일 수 있음)
        const userId = formData.get("userId") as string;



        const space = await db.memorySpace.create({
            data: {
                title,
                targetDate: new Date(dateStr),
                password,
                // 유저 ID가 있으면 연결, 없으면 null (선택 사항)
                userId: userId || null,
                // 유저 연결 여부와 상관없이, 방 자체의 수신자 정보로 저장

            },
        });

        return redirect(`/space/${space.id}/admin`);
    }

    return null;
}

export default function AdminCreateSpace() {
    const actionData = useActionData<typeof action>(); // create 결과 (에러 등)
    const searchFetcher = useFetcher<typeof action>(); // 검색 전용 fetcher

    // 선택된 유저 상태 (검색 후 '연결' 버튼 누르면 여기 저장됨)
    const [linkedUser, setLinkedUser] = useState<{ id: string, name: string, phoneNumber: string } | null>(null);

    // 검색 결과가 나오면 바로 linkedUser로 설정하고 싶다면 useEffect 사용 (선택사항)
    // 여기서는 검색 -> 결과 확인 -> [선택] 버튼 클릭 흐름으로 구현합니다.

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg space-y-8">

                <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                    🛠️ 관리자: 새 우주 생성
                </h1>

                {/* 🔍 1. 유저 검색 섹션 (연결할 경우) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        🔗 유저 연결 (선택)
                    </h3>

                    {!linkedUser ? (
                        <>
                            <searchFetcher.Form method="post" className="flex gap-2">
                                <input type="hidden" name="intent" value="search" />
                                <input
                                    name="keyword"
                                    placeholder="이름 또는 번호 일부 (예: 길동, 1234)"
                                    className="w-full border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                                <button className="bg-slate-800 text-white p-2 rounded hover:bg-slate-700 whitespace-nowrap">
                                    <Search size={18} />
                                </button>
                            </searchFetcher.Form>

                            {/* 📋 검색 결과 목록 표시 */}
                            <div className="mt-3 space-y-2">
                                {searchFetcher.data && 'foundUsers' in searchFetcher.data && searchFetcher.data.foundUsers?.map((user: any) => (
                                    <div key={user.id} className="bg-white p-3 rounded border border-slate-200 flex justify-between items-center animate-fade-in hover:bg-slate-50 transition">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-100 p-2 rounded-full">
                                                <User size={16} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{user.name}</p>
                                                <p className="text-xs text-slate-500">{user.phoneNumber}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setLinkedUser(user)}
                                            className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition"
                                            type="button"
                                        >
                                            선택
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {searchFetcher.data && 'searchError' in searchFetcher.data && (
                                <p className="text-xs text-red-500 mt-2 font-bold px-1">❌ {searchFetcher.data.searchError}</p>
                            )}
                        </>
                    ) : (
                        // ✅ 선택된 유저 표시
                        <div className="bg-indigo-50 p-3 rounded border border-indigo-200 flex justify-between items-center animate-pop-in">
                            <div className="flex items-center gap-2">
                                <UserCheck className="text-indigo-600" size={20} />
                                <div>
                                    <p className="text-sm font-bold text-indigo-800">{linkedUser.name}님 연결됨</p>
                                    <p className="text-xs text-indigo-600">{linkedUser.phoneNumber}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setLinkedUser(null)}
                                className="text-slate-400 hover:text-red-500 transition"
                                title="연결 해제"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                    )}
                </div>

                <hr className="border-slate-200" />

                {/* 📝 2. 방 정보 입력 (메인 폼) */}
                <Form method="post" className="space-y-4">
                    <input type="hidden" name="intent" value="create" />

                    {/* 👇 연결된 유저 ID (없으면 비어있음) */}
                    <input type="hidden" name="userId" value={linkedUser?.id || ""} />

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">우주 제목</label>
                        <input name="title" placeholder="예: 지은이 생일 축하해" className="w-full border p-3 rounded-lg" required />
                    </div>


                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">공개 일자</label>
                            <input name="date" type="date" className="w-full border p-3 rounded-lg" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">입장 비번</label>
                            <input name="password" type="text" placeholder="4자리" className="w-full border p-3 rounded-lg" required />
                        </div>
                    </div>

                    <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg mt-4 flex justify-center items-center gap-2">
                        {linkedUser ? "🔗 유저 연결하여 생성" : "✨ 유저 없이 생성"}
                    </button>
                </Form>
            </div>
        </div>
    );
}