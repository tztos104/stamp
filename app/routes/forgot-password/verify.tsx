import { type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "react-router";
import { useFetcher } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { commitSession, getFlashSession } from "~/lib/session.server";

// Loader: 이 페이지에 접근할 자격이 있는지 확인합니다.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  if (!flashSession.has("verificationCode") || !flashSession.has("passwordResetUserId")) {
    // 인증번호나 사용자 ID 정보가 없으면 첫 단계로 돌려보냅니다.
    return redirect("/forgot-password");
  }
  return null; // 데이터 없이 페이지 렌더링만 허용
};

// Action: 입력된 인증번호를 세션의 값과 비교합니다.
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const code = formData.get("code") as string;
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  
  const verificationCode = flashSession.get("verificationCode");

  if (!verificationCode || code !== verificationCode) {
    flashSession.flash("toast", { type: "error", message: "인증번호가 올바르지 않습니다." });
    return redirect("/forgot-password/verify", {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }

  // 인증 성공! 다음 단계로 넘어갈 자격을 세션에 저장합니다.
  flashSession.set("isVerifiedForPasswordReset", true);
  
  return redirect("/forgot-password/reset", {
    headers: { "Set-Cookie": await commitSession(flashSession) },
  });
};

const formSchema = z.object({
  code: z.string().length(6, { message: "6자리 인증번호를 입력해주세요." }),
});

export default function VerifyCodePage() {
  const fetcher = useFetcher();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "" },
  });

  return (
    <div className="container mx-auto flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">인증번호 입력</CardTitle>
          <CardDescription>핸드폰으로 전송된 6자리 인증번호를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => fetcher.submit(values, { method: "post" }))} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>인증번호</FormLabel>
                    <FormControl>
                      <Input placeholder="123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={fetcher.state !== 'idle'}>
                {fetcher.state !== 'idle' ? '확인 중...' : '인증번호 확인'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}