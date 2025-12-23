import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { myPostsCookie } from "~/lib/cookies.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const postId = Number(url.searchParams.get("postId"));

    // 1. 글 조회
    const post = await db.memoryPost.findUnique({ where: { id: postId } });
    if (!post) throw new Response("Not Found", { status: 404 });

    // 2. 권한 확인 (내 글인지)
    const { user } = await getSession(request);
    const cookieHeader = request.headers.get("Cookie");
    const myPostIds = (await myPostsCookie.parse(cookieHeader)) || [];

    // ✨ [핵심 수정] 쿠키에 있는 ID(문자열)와 비교하기 위해 post.id(숫자)를 문자열로 변환
    const isMine =
        (user && user.id === post.writerId) ||
        myPostIds.includes(String(post.id));

    // 내 글이 아니면 볼 수 없음 (보안)
    if (!isMine) {
        throw new Response("권한이 없습니다. (본인이 쓴 글만 확인할 수 있어요)", { status: 401 });
    }

    return { post, spaceId: params.spaceId };
}

export default function SuccessPage() {
    const { post, spaceId } = useLoaderData<typeof loader>();

    // 날짜 포맷 (한국식)
    const formattedDate = new Date(post.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* 배경 효과 */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80"></div>

            <div className="relative z-10 max-w-md w-full text-center">
                <div className="mb-8 animate-pop-in-up">
                    <span className="text-4xl">🎉</span>
                    <h1 className="text-2xl font-bold text-white mt-4">기록이 남겨졌어요!</h1>
                    <p className="text-slate-400 text-sm mt-2">생일자에게 이렇게 보여질 거예요.</p>
                </div>

                {/* 🃏 카드 미리보기 */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-2xl mb-8 animate-fade-in-up">
                    {/* 타입에 따라 다르게 보여주기 */}
                    {post.type === "ALBUM" ? (
                        // 📸 폴라로이드 스타일
                        <div className="bg-white p-3 pb-8 shadow-lg rotate-1 transform transition hover:rotate-0 duration-300">
                            <div className="bg-slate-100 overflow-hidden mb-3 aspect-square relative flex items-center justify-center">
                                {/* ✨ [수정] 이미지가 있을 때만 렌더링 */}
                                {post.mediaUrl ? (
                                    <img
                                        src={post.mediaUrl}
                                        alt="추억 사진"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-slate-400 text-xs">이미지 없음</span>
                                )}
                            </div>
                            <p className="font-handwriting text-slate-800 text-xl break-keep">{post.content}</p>
                            <p className="text-xs text-right text-slate-400 mt-2">- {post.nickname}</p>
                        </div>
                    ) : (
                        // 💌 메시지 카드 스타일
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg text-left relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl">❝</div>
                            <p className="text-lg font-medium leading-relaxed relative z-10 break-keep">"{post.content}"</p>
                            <div className="mt-4 flex justify-between items-end border-t border-white/20 pt-3">
                                <span className="text-xs opacity-70">{formattedDate}</span>
                                <span className="font-bold text-sm">From. {post.nickname}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 버튼들 */}
                <div className="flex flex-col gap-3">
                    <Link
                        to={`/space/${spaceId}/write`}
                        className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-100 transition shadow-lg"
                    >
                        ✍️ 하나 더 남기기
                    </Link>
                    <Link
                        to={`/space/${spaceId}/mine`}
                        className="text-slate-400 text-sm hover:text-white underline decoration-slate-600 underline-offset-4"
                    >
                        내가 쓴 글 목록 보기
                    </Link>
                </div>
            </div>
        </div>
    );
}