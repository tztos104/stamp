import { Link, redirect, useFetcher, type ActionFunctionArgs } from "react-router"; 
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
     
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

import { db } from "~/lib/db.server"; // 👈 db.server를 직접 import
import { lucia, hashPassword } from "~/lib/auth.server"; // 👈 hashPassword를 import (createUser 대신)
import { Prisma } from "@prisma/client";
import { getSession, commitSession } from "~/lib/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const password = formData.get("password") as string;

  // 👇 auth.server.ts 에서 가져온 함수로 비밀번호 해싱
  const hashedPassword = hashPassword(password);

  try {
    // 👇 사용자 생성 로직을 signup.tsx 안에서 직접 실행
    const user = await db.user.create({
      data: {
        name,
        phoneNumber,
        status: "ACTIVE",
        keys: {
          create: {
            id: `password:${phoneNumber}`,
            hashedPassword,
          },
        },
      },
      select: { id: true },
    });

    // 회원가입 성공 시, 세션을 만들고 바로 로그인 처리
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

     const flashSession = await getSession(request.headers.get("Cookie"));
    flashSession.flash("toast", {
      type: "success",
      message: "회원가입이 완료되었습니다! 환영합니다.",
    });

    return redirect("/", {
      headers: [
        ["Set-Cookie", sessionCookie.serialize()],
        ["Set-Cookie", await commitSession(flashSession)],
      ],
    });

  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { error: "이미 사용 중인 전화번호입니다." };
    }
    return { error: "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." };
  }
};

// 1. 폼 데이터의 유효성 검사를 위한 규칙(스키마)을 정의합니다.
const formSchema = z.object({
  name: z.string().min(2, { message: "이름은 2글자 이상이어야 합니다." }),
  phoneNumber:z.string().regex(/^\d{3}-?\d{3,4}-?\d{4}$/, {
    message: '전화번호 형식에 맞게 입력해주세요',
  }).transform((s) => s.replace(/\D/g, '')),
  password: z.string().min(4, { message: "비밀번호는 4자리 이상이어야 합니다." }),
});

export default function SignupPage() {
  const fetcher = useFetcher<typeof action>();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema), // zod 스키마를 사용해 유효성을 검사합니다.
    defaultValues: {
      name: "",
      phoneNumber: "",
      password: "",
    },
  });

  // 3. '계정 만들기' 버튼을 눌렀을 때 실행될 함수입니다.
  function onSubmit(values: z.infer<typeof formSchema>) {
    fetcher.submit(values, { method: "post" }); // 폼 데이터를 action으로 전송
  }

 return (
    <div className="container mx-auto flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">회원가입</CardTitle>
          <CardDescription>
            계정을 만들 정보를 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 👇 action에서 에러를 반환하면 여기에 메시지를 표시합니다. */}
          {fetcher.data?.error && (
            <div className="mb-4 rounded-md border border-red-500 bg-red-50 p-3 text-sm text-red-700">
              <p>{fetcher.data.error}</p>
            </div>
          )}
          <Form {...form}>
            {/* 👇 <form> 태그를 <fetcher.Form>으로 변경할 수도 있지만, handleSubmit을 사용하면 <form>도 괜찮습니다. */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input placeholder="홍길동" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              {/* 👇 fetcher가 데이터를 전송 중일 때 버튼을 비활성화합니다. */}
              <Button type="submit" className="w-full" disabled={fetcher.state !== 'idle'}>
                {fetcher.state !== 'idle' ? '가입 처리 중...' : '계정 만들기'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="underline">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}