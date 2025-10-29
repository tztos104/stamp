import { Link, redirect, type ActionFunctionArgs, useFetcher, type LoaderFunction } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getFlashSession, commitSession } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { db } from "~/lib/db.server";
import { getSession, lucia, verifyPassword } from "~/lib/auth.server"; 
import type { LoaderFunctionArgs } from "@remix-run/node";


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session  = await getSession(request);
  const user = session.user
  if (user) {
    return redirect("/");
  }
  return null;
};

// --- 로그인 서버 로직 (Action 함수) ---
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const phoneNumber = formData.get("phoneNumber") as string;
  const password = formData.get("password") as string;

  // 1. 전화번호로 Key 정보 찾기 (저장된 비밀번호 해시를 가져오기 위해)
  const key = await db.key.findUnique({
    where: {
      id: `password:${phoneNumber}`,
    },
  });

  if (!key || !key.hashedPassword) {
    return { error: "전화번호 또는 비밀번호가 올바르지 않습니다." };
  }

  // 2. 입력된 비밀번호와 저장된 해시 비교
  const isValidPassword = verifyPassword(key.hashedPassword, password);

  if (!isValidPassword) {
    return { error: "전화번호 또는 비밀번호가 올바르지 않습니다." };
  }
  const user = await db.user.findUnique({
    where: { id: key.userId },
    select: { name: true },
  });

  // 3. 비밀번호 일치 시, 세션 생성 및 쿠키 설정
  const session = await lucia.createSession(key.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
const flashSession = await getFlashSession(request.headers.get("Cookie"));
  flashSession.flash("toast", {
    type: "success",
    message: `${user?.name ?? '사용자'}님, 환영합니다!`, // "홍길동님, 환영합니다!"
  });
  return redirect("/", {
     headers: [
      ["Set-Cookie", sessionCookie.serialize()],
      ["Set-Cookie", await commitSession(flashSession)],
    ],
  });
};

// --- UI 및 클라이언트 로직 ---
const formSchema = z.object({
  phoneNumber: z.string().min(1, { message: "전화번호를 입력해주세요." }),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요." }),
});

export default function LoginPage() {
  const fetcher = useFetcher<typeof action>();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    fetcher.submit(values, { method: "post" });
  }

  return (
    <div className="container mx-auto flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>
            전화번호와 비밀번호를 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetcher.data?.error && (
            <div className="mb-4 rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-700">
              <p>{fetcher.data.error}</p>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} method="post" className="space-y-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>전화번호</FormLabel>
                    <FormControl>
                      <Input placeholder="01012345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-semibold"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-xs">
            계정이 없으신가요?{" "}
            <Link to="/signup" className="underline">
              회원가입
            </Link>
             <span className="mx-1">·</span>
            <Link to="/forgot-password" className="underline">
              비밀번호 찾기
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}