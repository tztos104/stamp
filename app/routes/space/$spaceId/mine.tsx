import { useLoaderData, Link, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { getSession } from "~/lib/auth.server";
import { myPostsCookie } from "~/lib/cookies.server";

interface PostItem {
    id: number;
    nickname: string;
    type: string;
    content: string;
    mediaUrl: string | null;
    createdAt: string; // loader를 거쳐오면 Date가 string(ISO형식)으로 변합니다.
}
export async function loader({ request, params }: LoaderFunctionArgs) {
    const { user } = await getSession(request);

    // 1. 쿠키 확인
    const cookieHeader = request.headers.get("Cookie");
    // 쿠키에는 문자열로 저장됨 (예: ["1", "2"])
    const myPostIdsStr = (await myPostsCookie.parse(cookieHeader)) || [];

    // ✨ [핵심 수정] DB 조회를 위해 문자열 ID들을 숫자로 변환
    const myPostIds = myPostIdsStr.map((id: string) => Number(id)).filter((n: number) => !isNaN(n));

    // 2. DB 조회
    const myPosts = await db.memoryPost.findMany({
        where: {
            spaceId: params.spaceId,
            OR: [
                ...(user ? [{ writerId: user.id }] : []),
                { id: { in: myPostIds } }
            ]
        },
        orderBy: { createdAt: "desc" },
    });

    return { myPosts, spaceId: params.spaceId };
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const postId = Number(formData.get("postId"));

    // 1. 권한 체크용 쿠키 확인
    const cookieHeader = request.headers.get("Cookie");
    const myPostIds = (await myPostsCookie.parse(cookieHeader)) || [];
    const { user } = await getSession(request);

    // 2. 삭제 권한 확인
    // ✨ [핵심 수정] 쿠키(문자열 리스트)에 postId(숫자)가 있는지 확인할 때 문자열로 변환해서 비교
    const canDelete =
        myPostIds.includes(String(postId)) ||
        (user && (await db.memoryPost.findFirst({ where: { id: postId, writerId: user.id } })));

    if (!canDelete) {
        return { error: "삭제 권한이 없습니다." };
    }

    // 3. 바로 삭제!
    await db.memoryPost.delete({ where: { id: postId } });
    return { success: true };
}

export default function MyPostsPage() {
    const { myPosts, spaceId } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6 pt-4">
                    <h1 className="text-2xl font-bold text-slate-800">내가 쓴 글 목록 📋</h1>
                    <Link to={`/space/${spaceId}`} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold">
                        메인으로 이동
                    </Link>
                </div>

                {myPosts.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-slate-400 mb-4">아직 작성한 기록이 없어요.</p>
                        <Link to={`/space/${spaceId}/write`} className="text-indigo-600 font-bold underline">
                            첫 글 남기러 가기
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {myPosts.map((post: PostItem) => (
                            <li key={post.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        {/* 내가 쓴 닉네임 표시 */}
                                        <span className="font-bold text-lg text-slate-800">{post.nickname}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${post.type === 'ALBUM' ? 'bg-pink-100 text-pink-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {post.type === 'ALBUM' ? '사진' : '메시지'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {new Date(post.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {post.content}
                                </p>

                                {post.mediaUrl && (
                                    <div className="mt-3 rounded-lg overflow-hidden border border-slate-100">
                                        <img src={post.mediaUrl} alt="" className="w-full max-h-60 object-cover" />
                                    </div>
                                )}

                                {/* 삭제 버튼 */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                                    <fetcher.Form method="post">
                                        <input type="hidden" name="postId" value={post.id} />
                                        <button
                                            className="text-xs bg-red-50 text-red-500 px-3 py-2 rounded font-bold hover:bg-red-100 transition flex items-center gap-1"
                                            onClick={(e) => {
                                                if (!confirm("정말 삭제하시겠습니까? (복구할 수 없습니다)")) e.preventDefault();
                                            }}
                                        >
                                            🗑️ 삭제하기
                                        </button>
                                    </fetcher.Form>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-8 text-center pb-10">
                    <Link to={`/space/${spaceId}/write`} className="inline-block w-full py-4 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl font-bold hover:bg-white hover:border-indigo-400 hover:text-indigo-500 transition">
                        + 또 다른 글 남기기
                    </Link>
                </div>
            </div>
        </div>
    );
}