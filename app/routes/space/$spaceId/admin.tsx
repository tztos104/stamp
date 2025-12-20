import { useState, useEffect } from "react";
import { Form, useActionData, useLoaderData, useNavigation, useFetcher, redirect } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { getSessionWithPermission } from "~/lib/auth.server";
import { generateAiMessages, optimizeLayout } from "~/lib/gemini.server";
import { Search, UserCheck, UserX, Trash2, Link as LinkIcon, RefreshCw, Wand2 } from "lucide-react";

// 📦 Loader: 방 정보 + 연결된 유저 정보 + 글 목록 가져오기
export async function loader({ request, params }: LoaderFunctionArgs) {
    const { user } = await getSessionWithPermission(request, "ADMIN");
    if (!user) throw new Response("Unauthorized", { status: 401 });

    const space = await db.memorySpace.findUnique({
        where: { id: params.spaceId },
        include: {
            user: { select: { id: true, name: true, phoneNumber: true } } // 연결된 유저 정보 가져오기
        }
    });

    if (!space) throw new Response("Not Found", { status: 404 });

    const posts = await db.memoryPost.findMany({
        where: { spaceId: params.spaceId },
        orderBy: { createdAt: "desc" }
    });

    return { space, posts };
}

// 🔐 Action: 각종 처리 로직
export async function action({ request, params }: ActionFunctionArgs) {
    // 관리자 권한 체크 필수
    const { user } = await getSessionWithPermission(request, "ADMIN");
    if (!user) throw new Response("Unauthorized", { status: 401 });

    const formData = await request.formData();
    const intent = formData.get("intent");

    // 🔍 1. 유저 검색 (fetcher용)
    if (intent === "search_user") {
        const keyword = formData.get("keyword") as string;
        if (!keyword) return { error: "검색어를 입력하세요." };

        const users = await db.user.findMany({
            where: {
                OR: [
                    { name: { contains: keyword } },
                    { phoneNumber: { contains: keyword } }
                ]
            },
            take: 5,
            select: { id: true, name: true, phoneNumber: true }
        });
        return { foundUsers: users };
    }

    // 🔗 2. 유저 연결 / 해제
    if (intent === "link_user") {
        const userId = formData.get("userId") as string;
        await db.memorySpace.update({
            where: { id: params.spaceId },
            data: { userId: userId } // 연결
        });
        return { success: true, mode: "LINK" };
    }

    if (intent === "unlink_user") {
        await db.memorySpace.update({
            where: { id: params.spaceId },
            data: { userId: null } // 해제
        });
        return { success: true, mode: "UNLINK" };
    }

    // 💥 3. 방 삭제 (Delete Space)
    if (intent === "delete_space") {
        // 관련된 글 먼저 삭제 (Cascade 설정 안 되어있을 경우 대비)
        await db.memoryPost.deleteMany({ where: { spaceId: params.spaceId } });
        // 방 삭제
        await db.memorySpace.delete({ where: { id: params.spaceId } });

        return redirect("/space"); // 목록으로 이동
    }

    // 📝 4. 글 삭제 (Delete Post)
    if (intent === "delete_post") {
        const postId = Number(formData.get("postId"));
        await db.memoryPost.delete({ where: { id: postId } });
        return { success: true, mode: "DELETE_POST" };
    }

    // ⚙️ 5. 방 정보 수정
    if (intent === "update_space") {
        const title = formData.get("title") as string;
        const password = formData.get("password") as string;
        const recipientName = formData.get("recipientName") as string;

        await db.memorySpace.update({
            where: { id: params.spaceId },
            data: {
                title,
                password: password || undefined
            }
        });
        return { success: true, mode: "UPDATE" };
    }

    // 🤖 6. AI 생성 & 레이아웃 (기존 로직 유지)
    if (intent === "GENERATE") {
        const topic = formData.get("topic") as string;
        const count = Number(formData.get("count"));
        const name = formData.get("name") as string;
        const age = formData.get("age") as string;
        const gender = formData.get("gender") as "male" | "female";

        const messages = await generateAiMessages(topic, count, { name, age, gender });

        await db.$transaction(messages.map((msg: any) => db.memoryPost.create({
            data: {
                spaceId: params.spaceId!,
                type: "MESSAGE",
                content: msg.content,
                nickname: msg.nickname,
                aiStyle: msg.aiStyle,
                writerId: user.id
            }
        })));
        return { success: true, mode: "GENERATE" };
    }
    if (intent === "LAYOUT") {
        const posts = await db.memoryPost.findMany({ where: { spaceId: params.spaceId, type: "MESSAGE" } });
        if (posts.length === 0) return { error: "글이 없습니다." };

        const layouts = await optimizeLayout(posts.map(p => ({ id: p.id, content: p.content || "" })));

        await db.$transaction(layouts.map((l: any) => db.memoryPost.update({
            where: { id: Number(l.id) },
            data: { aiStyle: l.aiStyle }
        })));
        return { success: true, mode: "LAYOUT" };
    }
    return null;
}

export default function SpaceAdminPage() {
    const { space, posts } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    // 유저 검색용 Fetcher
    const userFetcher = useFetcher<typeof action>();

    // 링크 복사
    const [copySuccess, setCopySuccess] = useState(false);
    const [origin, setOrigin] = useState("");

    // ✨ [수정] 브라우저에서만 window 객체에 접근해서 주소를 가져옴
    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    // ... (handleCopyLink 함수 수정)
    const handleCopyLink = () => {
        // window.location.origin 대신 state에 저장된 origin 사용 (혹은 여기선 window 써도 됨)
        const link = `${window.location.origin}/space/${space.id}/write`;
        navigator.clipboard.writeText(link);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };
    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-32">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* 헤더 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            🛠️ {space.title} <span className="text-slate-400 text-sm font-normal">관리자 페이지</span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">ID: {space.id}</p>
                    </div>
                    <div className="flex gap-2">
                        <a href={`/space/${space.id}`} target="_blank" rel="noreferrer" className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 flex items-center gap-1">
                            👀 우주 보기
                        </a>
                        <a href="/space" className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-700">
                            목록으로
                        </a>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* 👈 왼쪽: 설정 패널 */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* 1. 유저 연결 관리 */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center gap-2">
                                👤 주인공 연결
                            </h3>

                            {space.user ? (
                                // 연결된 상태
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-indigo-700 text-sm">{space.user.name}</p>
                                        <p className="text-xs text-indigo-500">{space.user.phoneNumber}</p>
                                    </div>
                                    <Form method="post">
                                        <input type="hidden" name="intent" value="unlink_user" />
                                        <button className="text-xs text-slate-400 hover:text-red-500 underline" onClick={(e) => !confirm("연결을 해제하시겠습니까?") && e.preventDefault()}>
                                            연결 해제
                                        </button>
                                    </Form>
                                </div>
                            ) : (
                                // 연결 안 된 상태 -> 검색창
                                <div className="space-y-3">
                                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                        아직 연결된 유저가 없습니다.<br />주인공을 찾아 연결해주세요.
                                    </div>
                                    <userFetcher.Form method="post" className="flex gap-2">
                                        <input type="hidden" name="intent" value="search_user" />
                                        <input name="keyword" placeholder="이름 또는 전화번호" className="flex-1 border p-2 rounded text-xs" required />
                                        <button className="bg-slate-800 text-white p-2 rounded hover:bg-slate-700"><Search size={14} /></button>
                                    </userFetcher.Form>

                                    {/* 검색 결과 */}
                                    {userFetcher.data && 'foundUsers' in userFetcher.data && (
                                        <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                                            {userFetcher.data.foundUsers?.map((u: any) => (
                                                <div key={u.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200">
                                                    <div>
                                                        <p className="text-xs font-bold">{u.name}</p>
                                                        <p className="text-[10px] text-slate-400">{u.phoneNumber}</p>
                                                    </div>
                                                    <Form method="post">
                                                        <input type="hidden" name="intent" value="link_user" />
                                                        <input type="hidden" name="userId" value={u.id} />
                                                        <button className="text-[10px] bg-indigo-500 text-white px-2 py-1 rounded hover:bg-indigo-600">연결</button>
                                                    </Form>
                                                </div>
                                            ))}
                                            {userFetcher.data.foundUsers?.length === 0 && <p className="text-xs text-slate-400 text-center">검색 결과 없음</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. 초대 링크 */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-lg text-white">
                            <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><LinkIcon size={16} /> 초대 링크</h3>
                            <button onClick={handleCopyLink} className="w-full bg-white/20 hover:bg-white/30 p-3 rounded-xl text-xs text-left truncate transition">
                                {/* ✨ [수정 3] window.location.origin 대신 state에 저장된 origin 사용 */}
                                {copySuccess ? "✅ 복사되었습니다!" : (origin ? `${origin}/space/${space.id}/write` : "링크 로딩 중...")}
                            </button>
                        </div>

                        {/* 3. 방 정보 수정 */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 text-slate-800">⚙️ 기본 설정</h3>
                            <Form method="post" className="space-y-4">
                                <input type="hidden" name="intent" value="update_space" />
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">방 제목</label>
                                    <input name="title" defaultValue={space.title} className="w-full border p-2 rounded text-sm" required />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">비밀번호</label>
                                    <input name="password" defaultValue={space.password || ""} placeholder="미설정" className="w-full border p-2 rounded text-sm" />
                                </div>
                                <button className="w-full bg-slate-800 text-white py-2 rounded-lg text-xs font-bold hover:bg-slate-700">저장</button>
                            </Form>
                        </div>

                        {/* 4. 방 삭제 (위험 구역) */}
                        <div className="bg-red-50 p-5 rounded-2xl border border-red-100">
                            <h3 className="font-bold text-sm text-red-700 mb-2 flex items-center gap-2"><Trash2 size={16} /> 위험 구역</h3>
                            <p className="text-xs text-red-500 mb-3">방을 삭제하면 모든 메시지와 사진이 영구적으로 사라집니다.</p>
                            <Form method="post" onSubmit={(e) => !confirm("정말 이 우주를 폭파하시겠습니까? 복구할 수 없습니다.") && e.preventDefault()}>
                                <input type="hidden" name="intent" value="delete_space" />
                                <button className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition">
                                    💣 우주 폭파 (삭제)
                                </button>
                            </Form>
                        </div>
                    </div>

                    {/* 👉 오른쪽: 콘텐츠 관리 */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* AI & 레이아웃 도구 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-purple-600"><Wand2 size={16} /> AI 유령작가</h4>
                                <Form method="post" className="space-y-2">
                                    <input type="hidden" name="intent" value="GENERATE" />

                                    {/* 나이/이름 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <input name="name" placeholder="이름" className="border p-1.5 rounded text-xs" required />
                                        <input name="age" placeholder="나이 (예: 25)" className="border p-1.5 rounded text-xs" required />
                                    </div>

                                    {/* 성별/주제 */}
                                    <select name="gender" className="w-full border p-1.5 rounded text-xs">
                                        <option value="male">남성</option>
                                        <option value="female">여성</option>
                                    </select>
                                    <input name="topic" placeholder="주제 (예: 생일축하, 응원)" className="w-full border p-1.5 rounded text-xs" required />

                                    {/* 개수/버튼 */}
                                    <div className="flex gap-2">
                                        <select name="count" className="border p-1.5 rounded text-xs flex-1">
                                            <option value="5">5개</option>
                                            <option value="10">10개</option>
                                        </select>
                                        <button disabled={isSubmitting} className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-purple-700 disabled:opacity-50">
                                            {isSubmitting ? "..." : "생성"}
                                        </button>
                                    </div>
                                </Form>
                            </div>

                            {/* 레이아웃 최적화 */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-sm mb-1 flex items-center gap-2 text-blue-600"><RefreshCw size={16} /> 별자리 재배치</h4>
                                    <p className="text-[10px] text-slate-400">메시지가 겹쳐 보일 때 사용하세요.</p>
                                </div>
                                <Form method="post">
                                    <input type="hidden" name="intent" value="LAYOUT" />
                                    <button disabled={isSubmitting} className="w-full bg-blue-50 text-blue-600 py-2 rounded text-xs font-bold hover:bg-blue-100 disabled:opacity-50">
                                        자동 배치 실행
                                    </button>
                                </Form>
                            </div>
                        </div>

                        {/* 메시지 목록 */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
                            <h2 className="text-lg font-bold mb-4 border-b pb-2">📋 메시지 관리 ({posts.length})</h2>
                            <div className="space-y-3">
                                {posts.map((post) => (
                                    <div key={post.id} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition group">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${post.type === 'ALBUM' ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    {post.type}
                                                </span>
                                                <span className="font-bold text-xs text-slate-700">{post.nickname}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 line-clamp-1">{post.content}</p>
                                        </div>
                                        <Form method="post">
                                            <input type="hidden" name="intent" value="delete_post" />
                                            <input type="hidden" name="postId" value={post.id} />
                                            <button
                                                className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
                                                title="삭제"
                                                onClick={(e) => !confirm("삭제하시겠습니까?") && e.preventDefault()}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </Form>
                                    </div>
                                ))}
                                {posts.length === 0 && <p className="text-center text-slate-400 text-xs py-10">메시지가 없습니다.</p>}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}