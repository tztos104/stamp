import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { db } from "~/lib/db.server";
import { commitSession, getFlashSession } from "~/lib/session.server";
import { hashPassword } from "~/lib/auth.server";

// Loader: 이전 단계(인증번호 확인)를 통과했는지 확인합니다.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  if (!flashSession.get("isVerifiedForPasswordReset")) {
    // 자격이 없으면 첫 단계로 돌려보냅니다.
    return redirect("/forgot-password");
  }
  return null;
};

// Action: 새 비밀번호를 받아 데이터베이스를 업데이트합니다.
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const password = formData.get("password") as string;
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  const userId = flashSession.get("passwordResetUserId");

  if (!userId) {
      flashSession.flash("toast", { type: "error", message: "사용자 정보가 없습니다. 다시 시도해주세요." });
      return redirect("/forgot-password", { headers: { "Set-Cookie": await commitSession(flashSession) } });
  }

  const hashedPassword = hashPassword(password);

  await db.key.update({
      where: { id: `password:${userId}` }, // Lucia v3+ 방식에서는 key 테이블을 업데이트합니다.
      data: { hashedPassword: hashedPassword }
  });

  // 사용된 세션 정보를 모두 삭제합니다.
  flashSession.unset("verificationCode");
  flashSession.unset("passwordResetUserId");
  flashSession.unset("isVerifiedForPasswordReset");

  flashSession.flash("toast", { type: "success", message: "비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요." });
  
  return redirect("/login", {
    headers: { "Set-Cookie": await commitSession(flashSession) },
  });
};

const formSchema = z.object({
  password: z.string().min(4, { message: "비밀번호는 4자리 이상이어야 합니다." }),
});

export default function ResetPasswordPage() {
  const fetcher = useFetcher();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  return (
    <div className="container mx-auto flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">비밀번호 재설정</CardTitle>
          <CardDescription>새로운 비밀번호를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => fetcher.submit(values, { method: "post" }))} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>새 비밀번호</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={fetcher.state !== 'idle'}>
                {fetcher.state !== 'idle' ? '변경 중...' : '비밀번호 변경하기'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}