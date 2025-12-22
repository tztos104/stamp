import { useState } from "react";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { processAndUploadImage } from "~/lib/upload.server";
import { unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { getSession } from "~/lib/auth.server";
import { myPostsCookie } from "~/lib/cookies.server";
import { Sparkles, Image as ImageIcon, Calendar, Plus, Trash2, X } from "lucide-react";

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { user } = await getSession(request);
    const space = await db.memorySpace.findUnique({
        where: { id: params.spaceId },
        include: { user: { select: { name: true } } }
    });
    if (!space) throw new Response("Not Found", { status: 404 });
    return { user, space };
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { user } = await getSession(request);

    // ⚠️ 대량 업로드 시 메모리 주의 (50MB 제한은 파일 '개당'이 아니라 파트당 적용되나, 총량 고려 필요)
    const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: 100_000_000 });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);

    const type = formData.get("type") as "MESSAGE" | "ALBUM";
    const nickname = formData.get("nickname") as string;

    // DB에 저장된 게시글 ID들을 모을 배열
    const createdPostIds: string[] = [];

    if (type === "MESSAGE") {
        // [기존 로직] 메시지는 하나만 저장
        const content = formData.get("content") as string;
        const newPost = await db.memoryPost.create({
            data: {
                spaceId: params.spaceId!,
                type: "MESSAGE",
                content,
                nickname,
                writerId: user?.id || null,
            }
        });
        createdPostIds.push(String(newPost.id));

    } else if (type === "ALBUM") {
        // ✨ [수정] 앨범은 여러 장을 한꺼번에 처리 (getAll 사용)
        const photos = formData.getAll("photo") as File[];
        const contents = formData.getAll("content") as string[];

        // 병렬 처리를 위해 Promise.all 사용 (순서대로 사진 업로드 -> DB 저장)
        await Promise.all(photos.map(async (file, index) => {
            // 파일이 없거나 0바이트면 건너뜀
            if (!file || file.size === 0) return;

            const uploadResult = await processAndUploadImage(file);
            // 업로드 실패 시 해당 건은 스킵
            if (!uploadResult) return;
            const { url, takenAt } = uploadResult;
            // 사진 순서에 맞는 설명 가져오기 (없으면 빈 문자열)
            const content = contents[index] || "";
            const finalDate = takenAt ? new Date(takenAt) : new Date();
            const newPost = await db.memoryPost.create({
                data: {
                    spaceId: params.spaceId!,
                    type: "ALBUM",
                    content: content,
                    mediaUrl: url,
                    nickname: nickname,
                    writerId: user?.id || null,
                    createdAt: finalDate
                }
            });
            createdPostIds.push(String(newPost.id));
        }));
    }

    // 쿠키 업데이트 (새로 생긴 ID들을 모두 추가)
    if (createdPostIds.length > 0) {
        const cookieHeader = request.headers.get("Cookie");
        const myPostIds = (await myPostsCookie.parse(cookieHeader)) || [];
        const updatedIds = [...myPostIds, ...createdPostIds];

        // 성공 페이지로 이동 (마지막에 만든 ID 하나만 파라미터로 넘김, 혹은 그냥 성공 페이지로)
        return redirect(`/space/${params.spaceId}/success?postId=${createdPostIds[0]}`, {
            headers: { "Set-Cookie": await myPostsCookie.serialize(updatedIds) },
        });
    }

    // 실패 혹은 아무것도 저장 안됨
    return redirect(`/space/${params.spaceId}`);
}

export default function WritePage() {
    const { user, space } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const [tab, setTab] = useState<"MESSAGE" | "ALBUM">("MESSAGE");

    // ✨ [추가] 사진 여러 장 관리를 위한 State
    // 각 항목은 고유 ID를 가짐 (화면 렌더링용)
    const [photoItems, setPhotoItems] = useState([{ id: Date.now(), preview: null as string | null }]);

    // 항목 추가 (최대 10장 제한)
    const addPhotoItem = () => {
        if (photoItems.length >= 10) {
            alert("최대 10장까지 한 번에 올릴 수 있어요!");
            return;
        }
        setPhotoItems([...photoItems, { id: Date.now(), preview: null }]);
    };

    // 항목 삭제
    const removePhotoItem = (targetId: number) => {
        if (photoItems.length === 1) {
            alert("최소 1장은 있어야 해요!");
            return;
        }
        setPhotoItems(photoItems.filter(item => item.id !== targetId));
    };

    // 파일 미리보기 업데이트
    const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setPhotoItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, preview: file ? URL.createObjectURL(file) : null };
            }
            return item;
        }));
    };

    const recipient = space.user?.name || space.title;
    const openDate = new Date(space.targetDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

    return (
        <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 relative">

                {/* 1. 상단 정보 (생략 가능하나 문맥 유지를 위해 포함) */}
                <div className="bg-slate-100 p-5 rounded-t-xl -mx-6 -mt-6 mb-6 text-center border-b border-slate-200">
                    <h1 className="text-xl font-bold text-slate-800">
                        {space.user ? <>{space.user.name}<span className="font-normal text-sm ml-1">에게</span></> : space.title}
                    </h1>
                </div>

                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-indigo-800">
                        <p className="font-bold mb-0.5">이 메시지는 {openDate}에 공개돼요!</p>
                        <p className="text-xs opacity-80">그 전까지는 비공개로 안전하게 보관됩니다 🔒</p>
                    </div>
                </div>

                {/* 탭 버튼 */}
                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                    <button type="button" onClick={() => setTab("MESSAGE")} className={`flex-1 py-2 text-sm font-bold rounded transition-all flex items-center justify-center gap-1 ${tab === "MESSAGE" ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}>
                        <Sparkles size={14} /> 편지 쓰기
                    </button>
                    <button type="button" onClick={() => setTab("ALBUM")} className={`flex-1 py-2 text-sm font-bold rounded transition-all flex items-center justify-center gap-1 ${tab === "ALBUM" ? "bg-white shadow text-pink-600" : "text-slate-500"}`}>
                        <ImageIcon size={14} /> 사진 올리기
                    </button>
                </div>

                <Form method="post" encType="multipart/form-data" className="space-y-6">
                    <input type="hidden" name="type" value={tab} />

                    {/* 공통: 작성자 이름 */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">보내는 사람</label>
                        <input name="nickname" defaultValue={user?.name || ""} placeholder="닉네임" className="w-full border p-3 rounded bg-slate-50 focus:outline-indigo-500" required />
                    </div>

                    {tab === "MESSAGE" ? (
                        /* 메시지 모드 (기존과 동일) */
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">메시지</label>
                            <textarea name="content" rows={5} placeholder="축하 메시지를 남겨주세요" className="w-full border p-3 rounded resize-none focus:outline-indigo-500" required />
                        </div>
                    ) : (
                        /* ✨ 사진 모드 (여러 장 업로드 UI) */
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="block text-xs font-bold text-slate-500">사진 목록 ({photoItems.length}/10)</label>
                                <button type="button" onClick={addPhotoItem} className="text-xs flex items-center gap-1 font-bold text-pink-600 hover:text-pink-700 transition">
                                    <Plus size={14} /> 사진 추가하기
                                </button>
                            </div>

                            {/* 사진 입력 카드 리스트 */}
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-hide">
                                {photoItems.map((item, index) => (
                                    <div key={item.id} className="relative border rounded-lg p-3 bg-slate-50 flex gap-3 animate-fade-in items-start">
                                        {/* 삭제 버튼 */}
                                        {photoItems.length > 1 && (
                                            <button type="button" onClick={() => removePhotoItem(item.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition">
                                                <X size={16} />
                                            </button>
                                        )}

                                        {/* 왼쪽: 사진 미리보기 및 입력 */}
                                        <div className="shrink-0">
                                            <div className={`w-20 h-20 rounded border-2 border-dashed flex items-center justify-center relative bg-white overflow-hidden ${item.preview ? 'border-pink-300' : 'border-slate-300'}`}>
                                                {item.preview ? (
                                                    <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-slate-300 text-2xl">📷</span>
                                                )}
                                                <input
                                                    type="file"
                                                    name="photo" /* 중요: name이 모두 photo여야 배열로 넘어감 */
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleFileChange(item.id, e)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* 오른쪽: 설명 입력 */}
                                        <div className="flex-1 pt-1">
                                            <div className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                                                <span className="bg-slate-200 text-slate-600 px-1.5 rounded text-[10px]">{index + 1}</span>
                                                사진 설명
                                            </div>
                                            <input
                                                name="content" /* 중요: name이 모두 content여야 배열로 넘어감 */
                                                placeholder="사진에 대한 설명 (선택)"
                                                className="w-full border p-2 text-sm rounded focus:outline-pink-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={addPhotoItem} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-bold hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50 transition flex items-center justify-center gap-2">
                                <Plus size={18} /> 사진 더 추가하기
                            </button>
                        </div>
                    )}

                    <button disabled={isSubmitting} className={`w-full text-white py-3.5 rounded-xl font-bold shadow-lg transition disabled:opacity-50 ${tab === "MESSAGE" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-pink-600 hover:bg-pink-700"}`}>
                        {isSubmitting ? "업로드 중..." : (tab === "MESSAGE" ? "🚀 별 띄우기" : `📸 사진 ${photoItems.length}장 저장하기`)}
                    </button>
                </Form>
            </div>
        </div>
    );
}