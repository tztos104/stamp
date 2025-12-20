import { useState } from "react";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { processAndUploadImage } from "~/lib/upload.server";
import { unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { getSession } from "~/lib/auth.server";
import { myPostsCookie } from "~/lib/cookies.server"; // 🍪 쿠키 가져오기

export async function loader({ request }: LoaderFunctionArgs) {
    const { user } = await getSession(request);
    return { user };
}

export async function action({ request, params }: ActionFunctionArgs) {
    const { user } = await getSession(request);
    console.log("현재 액션을 수행하는 유저:", user);
    const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: 50_000_000 });
    const formData = await unstable_parseMultipartFormData(request, uploadHandler);
    console.log("현재 액션을 수행하는 유저:", formData);
    // 1. 입력 데이터 가져오기 (비밀번호 없음!)
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

    // 2. DB 저장 (심플!)
    const newPost = await db.memoryPost.create({
        data: {
            spaceId: params.spaceId!,
            type: finalType,
            content: content,
            mediaUrl: mediaUrl,
            nickname: nickname,
            writerId: user?.id || null, // 회원이면 ID 저장
            // password: null, // 비회원 비밀번호는 이제 안 씀 (비워둠)
        }
    });

    // 3. 🍪 쿠키에 "내가 쓴 글 ID" 추가
    const cookieHeader = request.headers.get("Cookie");
    const myPostIds = (await myPostsCookie.parse(cookieHeader)) || [];

    // 기존 목록 + 이번에 쓴 글 ID 추가
    const updatedIds = [...myPostIds, newPost.id];

    // 4. 목록 페이지로 이동하며 쿠키 굽기
    return redirect(`/space/${params.spaceId}/success?postId=${newPost.id}`, {
        headers: {
            "Set-Cookie": await myPostsCookie.serialize(updatedIds),
        },
    });
}

export default function WritePage() {
    const { user } = useLoaderData<typeof loader>();
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

    return (
        <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4 text-center">
                    {tab === "MESSAGE" ? "메시지 남기기 💌" : "사진 올리기 📸"}
                </h2>

                <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                    <button type="button" onClick={() => setTab("MESSAGE")} className={`flex-1 py-2 text-sm font-bold rounded transition-all ${tab === "MESSAGE" ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}>📝 글쓰기</button>
                    <button type="button" onClick={() => setTab("ALBUM")} className={`flex-1 py-2 text-sm font-bold rounded transition-all ${tab === "ALBUM" ? "bg-white shadow text-pink-600" : "text-slate-500"}`}>📸 사진</button>
                </div>

                <Form method="post" encType="multipart/form-data" className="space-y-4">
                    <input type="hidden" name="type" value={tab} />

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">작성자</label>
                        <input
                            name="nickname"
                            defaultValue={user?.name || ""}
                            placeholder="닉네임을 입력하세요"
                            className="w-full border p-3 rounded bg-slate-50 focus:outline-indigo-500"
                            required
                        />
                    </div>

                    {/* ❌ 비밀번호 입력칸 삭제됨 (아주 깔끔!) */}

                    {tab === "MESSAGE" ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">메시지</label>
                            <textarea name="content" rows={4} placeholder="축하 메시지를 남겨주세요" className="w-full border p-3 rounded resize-none focus:outline-indigo-500" required />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">사진 선택</label>
                                <div className={`border-2 border-dashed ${preview ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300'} p-4 text-center rounded relative min-h-[150px] flex flex-col items-center justify-center`}>
                                    {preview ? (
                                        <img src={preview} alt="Preview" className="max-h-[200px] mx-auto rounded object-contain" />
                                    ) : (
                                        <span className="text-slate-400 text-sm">📷 여기를 눌러 사진 업로드</span>
                                    )}
                                    <input type="file" name="photo" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">사진 설명</label>
                                <input name="content" placeholder="한줄 코멘트" className="w-full border p-3 rounded" />
                            </div>
                        </>
                    )}

                    <button disabled={isSubmitting} className={`w-full text-white py-3 rounded-lg font-bold transition disabled:opacity-50 ${tab === "MESSAGE" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-pink-600 hover:bg-pink-700"}`}>
                        {isSubmitting ? "저장 중..." : "등록완료"}
                    </button>
                </Form>
            </div>
        </div>
    );
}