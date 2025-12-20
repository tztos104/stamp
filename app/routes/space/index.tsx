import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { db } from "~/lib/db.server";
import { getSessionWithPermission } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
    // 1. 관리자 권한 체크 (여기서는 로그인 여부만 체크하지만, 실제론 user.role === 'ADMIN' 등 필요)
    const { user } = await getSessionWithPermission(request, "ADMIN");
    if (!user) throw new Response("Unauthorized", { status: 401 });

    // 2. 모든 우주 조회 (최신순)
    const spaces = await db.memorySpace.findMany({
        include: {
            _count: { select: { posts: true } } // 글 개수도 같이 가져오기
        },
        orderBy: { createdAt: "desc" }
    });

    return { spaces };
}

export default function AdminDashboard() {
    const { spaces } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">👑 우주 관리자 센터</h1>
                <p className="text-slate-500 mb-8">생성된 모든 우주를 관리하고 AI를 지원합니다.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {spaces.map((space) => (
                        <div key={space.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl font-bold text-slate-800 truncate pr-2">
                                    {space.title}
                                </h2>
                                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-bold">
                                    {new Date(space.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="flex gap-2 mb-6">
                                <div className="flex-1 bg-indigo-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-indigo-600">{space._count.posts}</div>
                                    <div className="text-xs text-indigo-400 font-bold">메시지</div>
                                </div>
                                <div className="flex-1 bg-pink-50 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-pink-600">ON</div>
                                    <div className="text-xs text-pink-400 font-bold">상태</div>
                                </div>
                            </div>

                            <Link
                                to={`/space/${space.id}/admin`}
                                className="block w-full bg-slate-900 text-white text-center py-3 rounded-xl font-bold hover:bg-slate-800 transition"
                            >
                                🛠️ 관리하기
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}