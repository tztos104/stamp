// app/routes/signup.tsx

import { Link, redirect, useFetcher, type ActionFunctionArgs, type LoaderFunctionArgs,useLoaderData } from "react-router"; // LoaderFunctionArgs 추가
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
  Form, // shadcn/ui Form 컴포넌트
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";

import { db } from "~/lib/db.server";
import { lucia, hashPassword } from "~/lib/auth.server";
import { Prisma } from "@prisma/client";
import { getFlashSession, commitSession } from "~/lib/session.server";


// --- Loader 함수 (추가) ---
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const claimCode = url.searchParams.get("claimCode");
  return { claimCode };
};


export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const password = formData.get("password") as string;
  const claimCode = formData.get("claimCode") as string; // hidden input으로 넘어온 코드

  const flashSession = await getFlashSession(request.headers.get("Cookie"));

  // --- 폼 데이터 유효성 검증 (Zod 스키마는 클라이언트에서, 서버에서는 기본 검증) ---
  const validationResult = formSchema.safeParse({ name, phoneNumber, password });
  if (!validationResult.success) {
    const errorMessages = validationResult.error.issues.map(e => e.message).join(", ");
    flashSession.flash("toast", { message: errorMessages, type: "error" });
    return redirect(`/signup${claimCode ? `?claimCode=${claimCode}` : ''}`, {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }

  const hashedPassword = hashPassword(password);

  try {
   const transactionResult = await db.$transaction(async (prisma) => {
      // 1. 기존 사용자를 전화번호로 찾습니다. (상태 무관)
      const existingUser = await prisma.user.findUnique({
        where: { phoneNumber },
      });

      let user: { id: string };

      // 2. 사용자 상태에 따라 분기 처리
      if (existingUser) {
        // 2-1. 이미 존재하는 정식 회원(ACTIVE)일 경우, 오류 처리
        if (existingUser.status === 'ACTIVE') {
          throw new Prisma.PrismaClientKnownRequestError(
            "이미 사용 중인 전화번호입니다.",
            { code: 'P2002', clientVersion: '' }
          );
        }

        // 2-2. 임시 회원(TEMPORARY)일 경우, 정식 회원으로 전환 (UPDATE)
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name, // 사용자가 입력한 이름으로 업데이트
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        // Key 테이블에 비밀번호 정보 생성
        await prisma.key.create({
          data: {
            id: `password:${phoneNumber}`,
            userId: user.id,
            hashedPassword,
          },
        });

      } else {
        // 2-3. 존재하지 않는 사용자일 경우, 신규 생성 (CREATE)
        user = await prisma.user.create({
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
      }


      // 3. (claimCode가 있을 경우에만) 스탬프 적립 및 사용 기록
      if (claimCode) {
        const claimableStamp = await prisma.claimableStamp.findUnique({
          where: { claimCode },
          include: { event: true },
        });

        if (!claimableStamp) throw new Error("존재하지 않는 스탬프 코드입니다.");
        if (new Date() > claimableStamp.expiresAt) throw new Error("만료된 스탬프 코드입니다.");
        if (claimableStamp.maxUses !== null && claimableStamp.currentUses >= claimableStamp.maxUses) {
          throw new Error("이 스탬프 코드는 모두 사용되었습니다.");
        }
        
        const existingRedemption = await prisma.claimableStampRedemption.findUnique({
            where: { claimableStampId_userId: { claimableStampId: claimableStamp.id, userId: user.id } }
        });
        if (existingRedemption) throw new Error("이미 사용한 스탬프 코드입니다.");

        let activeStampCard = await prisma.stampCard.findFirst({
          where: { userId: user.id, isRedeemed: false },
        });
        if (!activeStampCard) {
          activeStampCard = await prisma.stampCard.create({ data: { userId: user.id } });
        }

        await prisma.stampEntry.create({
          data: {
            userId: user.id,
            eventId: claimableStamp.eventId,
            stampCardId: activeStampCard.id,
          },
        });

        await prisma.claimableStamp.update({
          where: { id: claimableStamp.id },
          data: {
            currentUses: { increment: 1 },
            redemptions: {
              create: { userId: user.id }
            }
          },
        });
      }
      return user;
    });

    // --- 트랜잭션 종료 ---

    // 3. 회원가입 성공 시 세션 생성 및 리다이렉트
    const session = await lucia.createSession(transactionResult.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    flashSession.flash("toast", {
      type: "success",
      message: claimCode ? "회원가입과 스탬프 적립이 완료되었습니다! 환영합니다." : "회원가입이 완료되었습니다! 환영합니다.",
    });

    // 두 개의 Set-Cookie 헤더를 배열로 전달
    const headers = new Headers();
    headers.append("Set-Cookie", sessionCookie.serialize());
    headers.append("Set-Cookie", await commitSession(flashSession));

    // 스탬프가 적립되었다면 /card 페이지로, 아니면 메인 페이지로 이동
    return redirect(claimCode ? "/card" : "/", { headers });

  } catch (e: unknown) {
    console.error("회원가입/스탬프 적립 중 오류:", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      flashSession.flash("toast", { message: "이미 사용 중인 전화번호입니다.", type: "error" });
    } else if (e instanceof Error) {
      flashSession.flash("toast", { message: e.message, type: "error" });
    } else {
      flashSession.flash("toast", { message: "회원가입 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", type: "error" });
    }

    return redirect(`/signup${claimCode ? `?claimCode=${claimCode}` : ''}`, {
      headers: { "Set-Cookie": await commitSession(flashSession) },
    });
  }
};


const formSchema = z.object({
  name: z.string().min(2, { message: "이름은 2글자 이상이어야 합니다." }),
  phoneNumber: z.string().regex(/^\d{3}-?\d{3,4}-?\d{4}$/, {
    message: '전화번호 형식에 맞게 입력해주세요',
  }).transform((s) => s.replace(/\D/g, '')),
  password: z.string().min(4, { message: "비밀번호는 4자리 이상이어야 합니다." }),
});

export default function SignupPage() {
  const { claimCode } = useLoaderData<typeof loader>(); // loader 데이터 사용
  const fetcher = useFetcher<typeof action>();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      password: "",
    },
  });

  // fetcher.data?.error 처리 제거 (toast로 통일)
  // fetcher.state를 이용한 disabled 상태는 유지

  function onSubmit(values: z.infer<typeof formSchema>) {
    // claimCode가 있다면 폼 데이터에 추가
    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("phoneNumber", values.phoneNumber);
    formData.append("password", values.password);
    if (claimCode) {
      formData.append("claimCode", claimCode);
    }
    fetcher.submit(formData, { method: "post" });
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
          {/* claimCode가 있을 경우 안내 메시지 표시 (shadcn/ui Alert 스타일 적용) */}
          {claimCode && (
            <div className="flex p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400" role="alert">
              <svg className="flex-shrink-0 inline w-4 h-4 me-3 mt-[2px]" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
              </svg>
              <div>
                <span className="font-medium">스탬프 코드가 확인되었습니다!</span> 회원가입을 완료하고 스탬프를 받아보세요.
              </div>
            </div>
          )}

          <Form {...form}>
            {/* hidden input은 더 이상 필요 없습니다. onSubmit에서 FormData에 직접 추가합니다. */}
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
              <Button
                type="submit"
                className="w-full text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-semibold"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? '가입 처리 중...' : '계정 만들기'}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-xs">
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