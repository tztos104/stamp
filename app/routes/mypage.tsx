// app/routes/mypage.tsx

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher, useLoaderData, Link, useSearchParams } from "react-router"; // useSearchParams 추가
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { db } from "~/lib/db.server";
import { getSession, verifyPassword, hashPassword } from "~/lib/auth.server";
import { getFlashSession, commitSession } from "~/lib/session.server";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { User, KeyRound, LayoutGrid, MessageSquare, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"; // 화살표 아이콘 추가

// --- Loader: 사용자 정보 + 내 우주 + 내 글 불러오기 (페이징 적용) ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return redirect("/login?redirectTo=/mypage");
  }

  // 1. URL에서 페이지 번호 파싱
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 10; // 한 페이지당 보여줄 글 개수
  const skip = (page - 1) * pageSize;

  // 2. 내가 만든 우주(방) 조회 (여기는 전체 조회 유지)
  const mySpaces = await db.memorySpace.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { posts: true } }
    }
  });

  // 3. 내가 쓴 글 조회 (페이징 + 전체 개수 카운트)
  // Promise.all로 병렬 처리하여 효율성 증대
  const [myPosts, totalPostCount] = await Promise.all([
    db.memoryPost.findMany({
      where: { writerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        space: { select: { id: true, title: true } }
      },
      skip: skip,      // 건너뛸 개수
      take: pageSize,  // 가져올 개수
    }),
    db.memoryPost.count({ // 전체 글 개수 조회
      where: { writerId: user.id }
    })
  ]);

  const totalPages = Math.ceil(totalPostCount / pageSize);

  return {
    user,
    mySpaces,
    myPosts,
    pagination: {
      page,
      totalPages,
      totalPostCount
    }
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, session } = await getSession(request);
  if (!user || !session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const flashSession = await getFlashSession(request.headers.get("Cookie"));

  // --- 비밀번호 변경 로직 ---
  if (intent === "updatePassword") {
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (!currentPassword || newPassword.length < 4) {
      flashSession.flash("toast", { type: "error", message: "비밀번호는 4자리 이상이어야 합니다." });
      return redirect("/mypage", { headers: { "Set-Cookie": await commitSession(flashSession) } });
    }

    const key = await db.key.findUnique({ where: { id: `password:${user.phoneNumber}` } });
    if (!key || !key.hashedPassword) {
      flashSession.flash("toast", { type: "error", message: "인증 정보를 찾을 수 없습니다." });
      return redirect("/mypage", { headers: { "Set-Cookie": await commitSession(flashSession) } });
    }

    const isValidPassword = verifyPassword(key.hashedPassword, currentPassword);
    if (!isValidPassword) {
      flashSession.flash("toast", { type: "error", message: "현재 비밀번호가 일치하지 않습니다." });
      return redirect("/mypage", { headers: { "Set-Cookie": await commitSession(flashSession) } });
    }

    const newHashedPassword = hashPassword(newPassword);
    await db.key.update({
      where: { id: key.id },
      data: { hashedPassword: newHashedPassword },
    });

    flashSession.flash("toast", { type: "success", message: "비밀번호가 성공적으로 변경되었습니다." });
    return redirect("/mypage", { headers: { "Set-Cookie": await commitSession(flashSession) } });
  }

  throw new Response("Invalid intent", { status: 400 });
};

// --- Zod 스키마 정의 ---
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, { message: "현재 비밀번호를 입력해주세요." }),
  newPassword: z.string().min(4, { message: "새 비밀번호는 4자리 이상이어야 합니다." }),
}).refine(data => data.currentPassword !== data.newPassword, {
  message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
  path: ["newPassword"],
});

// --- UI 컴포넌트 ---
export default function MyPage() {
  const { user, mySpaces, myPosts, pagination } = useLoaderData<typeof loader>();
  const passwordFetcher = useFetcher();
  const [searchParams] = useSearchParams(); // 탭 유지 등을 위해 사용 가능

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  // 페이지네이션 헬퍼 함수
  const getPageNumbers = () => {
    const pages = [];
    // 간단하게 전체 페이지를 보여주거나, 로직을 추가해 1 2 3 ... 10 처럼 만들 수 있습니다.
    // 여기서는 최대 5개 페이지만 표시하는 간단한 로직을 적용합니다.
    let start = Math.max(1, pagination.page - 2);
    let end = Math.min(pagination.totalPages, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">

      {/* 1. 프로필 정보 (가로 배치) */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <User className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{user.name}님</h2>
                <p className="text-sm text-slate-500">{user.phoneNumber}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* 로그아웃 버튼 등을 여기에 추가 가능 */}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 탭 메뉴 (내 활동 / 계정 설정) */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="activity">내 활동 (우주 & 기록)</TabsTrigger>
          <TabsTrigger value="settings">계정 설정</TabsTrigger>
        </TabsList>

        {/* 탭 1: 내 활동 내용 */}
        <TabsContent value="activity" className="space-y-6">

          {/* 🪐 내가 만든 우주 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LayoutGrid className="h-5 w-5 text-indigo-500" />
                나의 우주 <span className="text-sm text-slate-400 font-normal">({mySpaces.length})</span>
              </CardTitle>
              <CardDescription>직접 생성한 기념일 방 목록입니다.</CardDescription>
            </CardHeader>
            <CardContent>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mySpaces.map(space => (
                  <div key={space.id} className="border rounded-xl p-4 hover:bg-slate-50 transition flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 truncate">{space.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        오픈일: {new Date(space.targetDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> 메시지 {space._count.posts}개
                      </span>
                      <div className="flex gap-2">
                        <Link to={`/space/${space.id}`} className="text-xs bg-white border border-slate-200 px-2 py-1.5 rounded-md font-bold hover:bg-slate-100 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> 입장
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                {mySpaces.length === 0 && (
                  <div className="col-span-full text-center py-6 text-slate-400">
                    생성한 우주가 없습니다.
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* ✍️ 내가 쓴 글 (페이징 적용) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-pink-500" />
                내가 남긴 기록 <span className="text-sm text-slate-400 font-normal">({pagination.totalPostCount})</span>
              </CardTitle>
              <CardDescription>다른 우주에 남긴 축하 메시지들입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {myPosts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">
                  <p>아직 작성한 기록이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPosts.map(post => (
                    <Link
                      key={post.id}
                      to={`/space/${post.spaceId}`} // 해당 우주로 이동
                      className="block border rounded-xl p-4 hover:border-pink-200 hover:bg-pink-50/30 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-[10px] bg-slate-50">
                          {post.space.title}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-2">
                        {post.content}
                      </p>
                      {post.mediaUrl && (
                        <div className="mt-2 text-xs text-pink-500 font-bold flex items-center gap-1">
                          📷 사진 포함됨
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* ✨ 페이지네이션 컨트롤 (글이 있을 때만 표시) */}
              {pagination.totalPostCount > 0 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {/* 이전 페이지 버튼 */}
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    disabled={pagination.page <= 1}
                    className={pagination.page <= 1 ? "pointer-events-none opacity-50" : ""}
                  >
                    <Link to={`?page=${pagination.page - 1}`} preventScrollReset>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  </Button>

                  {/* 페이지 번호들 */}
                  {getPageNumbers().map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={pageNum === pagination.page ? "default" : "outline"}
                      size="sm"
                      asChild
                      className={pageNum === pagination.page ? "bg-pink-500 hover:bg-pink-600" : ""}
                    >
                      <Link to={`?page=${pageNum}`} preventScrollReset>
                        {pageNum}
                      </Link>
                    </Button>
                  ))}

                  {/* 다음 페이지 버튼 */}
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                    disabled={pagination.page >= pagination.totalPages}
                    className={pagination.page >= pagination.totalPages ? "pointer-events-none opacity-50" : ""}
                  >
                    <Link to={`?page=${pagination.page + 1}`} preventScrollReset>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>


        {/* 탭 2: 계정 설정 (비밀번호 변경) */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> 비밀번호 변경</CardTitle>
              <CardDescription>새로운 비밀번호를 설정합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <passwordFetcher.Form method="post" className="space-y-4" onSubmit={passwordForm.handleSubmit(data => {
                  passwordFetcher.submit({ ...data, intent: 'updatePassword' }, { method: 'post' });
                  passwordForm.reset();
                })}>
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>현재 비밀번호</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>새 비밀번호</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={passwordFetcher.state !== 'idle'}>
                    {passwordFetcher.state !== 'idle' ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </passwordFetcher.Form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}