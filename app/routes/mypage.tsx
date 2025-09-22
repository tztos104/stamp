// app/routes/mypage.tsx (신규 파일)

import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher, useLoaderData, Link } from "react-router";
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
import { Separator } from "~/components/ui/separator";
import { ArrowLeft, User, KeyRound } from "lucide-react";

// --- Loader: 로그인한 사용자 정보를 불러옵니다. ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSession(request);
  if (!user) {
    return redirect("/login?redirectTo=/mypage");
  }
  return { user };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, session } = await getSession(request);
  if (!user || !session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const flashSession = await getFlashSession(request.headers.get("Cookie"));

  // --- 비밀번호 변경 로직만 남깁니다 ---
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
  const { user } = useLoaderData<typeof loader>();
  const passwordFetcher = useFetcher();

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">내 정보 수정</h1>
      </div>

      {/* 이름 변경 카드 */}
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> 프로필 정보</CardTitle>
          <CardDescription>계정의 기본 정보입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            <div className="font-medium">이름</div>
            <p className="text-muted-foreground">{user.name}</p>
            <div className="font-medium pt-2">전화번호</div>
            <p className="text-muted-foreground">{user.phoneNumber} </p>
        </CardContent>
      </Card>


      {/* 비밀번호 변경 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> 비밀번호 변경</CardTitle>
          <CardDescription>새로운 비밀번호를 설정합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 👇 여기도 Shadcn의 Form 컴포넌트로 감싸줍니다. */}
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
    </div>
  );
}