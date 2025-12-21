import { useState } from "react";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { processAndUploadImage } from "~/lib/upload.server";
import { unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { getSession } from "~/lib/auth.server";
import { myPostsCookie } from "~/lib/cookies.server";
import { Sparkles, Image as ImageIcon, Calendar, Info } from "lucide-react"; // ✨ 아이콘 추가

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { user } = await getSession(request);

    // ✨ [수정] targetDate(공개일)도 함께 가져옵니다.
    const space = await db.memorySpace.findUnique({
        where: { id: params.spaceId },
        include: {
            user: { select: { name: true } }
        }
    });

    if (!space) throw new Response("Not Found", { status: 404 });

    return { user, space };
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { user } = await getSession(request);
    const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: 50_000_000 });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);

    const type = formData.get("type") as "MESSAGE" | "ALBUM";
    const nickname = formData.get("nickname") as string;
    const content = formData.get("content") as string;
    const file = formData.get("photo") as File;

    let mediaUrl = null;
    let finalType = type;

    if (type === "ALBUM") {
        if (file && file.size > 0) {
            mediaUrl = await processAndUploadImage(file);
        } else {
            finalType = "MESSAGE";
        }
    }

    const newPost = await db.memoryPost.create({
        data: {
            spaceId: params.spaceId!,
            type: finalType,
            content: content,
            mediaUrl: mediaUrl,
            nickname: nickname,
            writerId: user?.id || null,
        }
    });

    const cookieHeader = request.headers.get("Cookie");
    const myPostIds = (await myPostsCookie.parse(cookieHeader)) || [];
    const updatedIds = [...myPostIds, newPost.id];

    return redirect(`/space/${params.spaceId}/success?postId=${newPost.id}`, {
        headers: {
            "Set-Cookie": await myPostsCookie.serialize(updatedIds),
        },
    });
}

export default function WritePage() {
    const { user, space } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const [tab, setTab] = useState<"MESSAGE" | "ALBUM">("MESSAGE");
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
        } else {
            setPreview(null);
        }
    };

    const recipient = space.user?.name || space.title;

    // ✨ 날짜 포맷팅 (예: 12월 25일)
    const openDate = new Date(space.targetDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 relative overflow-hidden">

                {/* 1. 상단 수신자 정보 */}
                <div className="bg-slate-100 p-5 rounded-t-xl -mx-6 -mt-6 mb-6 text-center border-b border-slate-200 flex flex-col items-center justify-center min-h-[80px]">
                    {space.user ? (
                        /* 👤 유저가 연결된 경우: "TO. OOO에게" */
                        <>

                            <h1 className="text-xl font-bold text-slate-800">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">TO.</span> {space.user.name}<span className="font-normal text-sm ml-1">에게</span>
                            </h1>
                        </>
                    ) : (
                        /* 🏷️ 유저가 없는 경우: "방 제목"만 표시 */
                        <h1 className="text-xl font-bold text-slate-800 break-keep">
                            {space.title}
                        </h1>
                    )}
                </div>

                {/* 2. ✨ 안내 메시지 (타임캡슐 컨셉 설명) */}
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-indigo-800">
                        <p className="font-bold mb-0.5">이 메시지는 {openDate}에 공개돼요!</p>
                        <p className="text-xs opacity-80">그 전까지는 비공개로 안전하게 보관됩니다 🔒</p>
                    </div>
                </div>

                {/* 3. 탭 선택 */}
                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                    <button type="button" onClick={() => setTab("MESSAGE")} className={`flex-1 py-2 text-sm font-bold rounded transition-all flex items-center justify-center gap-1 ${tab === "MESSAGE" ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}>
                        <Sparkles size={14} /> 편지 쓰기
                    </button>
                    <button type="button" onClick={() => setTab("ALBUM")} className={`flex-1 py-2 text-sm font-bold rounded transition-all flex items-center justify-center gap-1 ${tab === "ALBUM" ? "bg-white shadow text-pink-600" : "text-slate-500"}`}>
                        <ImageIcon size={14} /> 사진 올리기
                    </button>
                </div>

                {/* 4. ✨ 탭별 설명 문구 추가 */}
                <div className="text-center mb-6">
                    {tab === "MESSAGE" ? (
                        <p className="text-xs text-slate-400 animate-fade-in">
                            작성하신 편지는 {recipient}님의 우주에서<br />
                            <span className="text-indigo-500 font-bold">하나의 반짝이는 별⭐</span>이 되어 떠오릅니다.
                        </p>
                    ) : (
                        <p className="text-xs text-slate-400 animate-fade-in">
                            업로드한 사진은 {recipient}님의 앨범에<br />
                            <span className="text-pink-500 font-bold">감성적인 폴라로이드 사진📸</span>으로 남게 됩니다.
                        </p>
                    )}
                </div>

                <Form method="post" encType="multipart/form-data" className="space-y-4">
                    <input type="hidden" name="type" value={tab} />

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">보내는 사람</label>
                        <input
                            name="nickname"
                            defaultValue={user?.name || ""}
                            placeholder="닉네임을 입력하세요"
                            className="w-full border p-3 rounded bg-slate-50 focus:outline-indigo-500 transition-all focus:bg-white focus:border-indigo-300"
                            required
                        />
                    </div>

                    {tab === "MESSAGE" ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">메시지</label>
                            <textarea
                                name="content"
                                rows={5}
                                placeholder={space.user
                                    ? `${space.user.name}님에게 축하의 메시지를 남겨주세요.`
                                    : "이곳에 축하와 응원의 메시지를 남겨주세요."
                                }
                                className="w-full border p-3 rounded resize-none focus:outline-indigo-500 transition-all focus:bg-white focus:border-indigo-300"
                                required
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">사진 선택</label>
                                <div className={`border-2 border-dashed ${preview ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'} p-4 text-center rounded relative min-h-[150px] flex flex-col items-center justify-center transition-all cursor-pointer group`}>
                                    {preview ? (
                                        <img src={preview} alt="Preview" className="max-h-[200px] mx-auto rounded object-contain shadow-sm" />
                                    ) : (
                                        <div className="text-slate-400 text-sm group-hover:text-slate-600 transition-colors">
                                            <span className="text-2xl block mb-1">📷</span>
                                            <span className="font-bold text-slate-500">사진을 꾹 눌러 선택하세요</span>
                                        </div>
                                    )}
                                    <input type="file" name="photo" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">사진 설명 (선택)</label>
                                <input name="content" placeholder="사진에 대한 짧은 코멘트" className="w-full border p-3 rounded focus:outline-pink-500 transition-all focus:bg-white focus:border-pink-300" />
                            </div>
                        </>
                    )}

                    <button disabled={isSubmitting} className={`w-full text-white py-3.5 rounded-xl font-bold transition shadow-lg disabled:opacity-50 disabled:shadow-none transform active:scale-[0.98] ${tab === "MESSAGE" ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200" : "bg-pink-600 hover:bg-pink-700 shadow-pink-200"}`}>
                        {isSubmitting ? "전송 중..." : (tab === "MESSAGE" ? "🚀 별 띄우기" : "📸 앨범에 저장하기")}
                    </button>
                </Form>

            </div>
        </div>
    );
}