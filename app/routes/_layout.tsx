import { useEffect } from "react";
import { Link, Outlet, useLoaderData } from "react-router";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { Home, User, ShoppingCart, Settings, LogOut, LogIn } from "lucide-react";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { getFlashSession, commitSession } from "~/lib/session.server"; // 👈 세션 유틸리티 import
import { Form } from "react-router";
import { getSession } from "~/lib/auth.server";
type LoaderData = {
  toastMessage: {
    type: "success" | "error";
    message: string;
  } | null; // toastMessage는 객체이거나 null일 수 있습니다.
  user: {
    name: string;
    phoneNumber: string;
    role: "USER" | "MEMBER" | "ADMIN" | null;
  } | null;
};

// 2. loader 함수가 LoaderData 타입을 반환하도록 명시합니다.
export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response> => {
  const session = await getSession(request);
  const user = session.user;
  const FlashSession = await getFlashSession(request.headers.get("Cookie"));
  const toastMessage = FlashSession.get("toast") || null;

  const data: LoaderData = { toastMessage ,user};

  return json(data, {
    headers: { "Set-Cookie": await commitSession(FlashSession) },
  });
};

function Header() {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="h-16 flex items-center justify-center">
        <h1 className="text-lg font-bold">STAMP APP</h1>
      </div>
    </header>
  );
}

function BottomNav({ user }: { user: {
    name: string;
    phoneNumber: string;
    role: "USER" | "MEMBER" | "ADMIN" | null;
  } | null }) {
  return (
    <nav className="bg-white border-t sticky bottom-0">
      <div className="h-16 flex justify-around items-center max-w-md mx-auto">
        <Link to="/" className="flex flex-col items-center gap-1 text-gray-500">
          <Home size={24} />
          <span className="text-xs font-bold">홈</span>
        </Link>
        <Link to="#" className="flex flex-col items-center gap-1 text-gray-500">
          <ShoppingCart size={24} />
          <span className="text-xs">스탬프</span>
        </Link>
        
        {/* 👇 user 정보 유무에 따라 로그인 또는 마이페이지 메뉴를 보여줍니다. */}
        {user ? (
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-1 text-gray-500">
                <User size={24} />
                <span className="text-xs">마이페이지</span>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{user.name}님</SheetTitle>
                <SheetDescription>
                  무엇을 도와드릴까요?
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <Button variant="outline" asChild>
                  <Link to="#">
                    <Settings className="mr-2 h-4 w-4" /> 내 정보 수정
                  </Link>
                </Button>
                {/* 로그아웃 버튼 */}
                <Form action="/logout" method="post">
                  <Button type="submit" variant="destructive" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" /> 로그아웃
                  </Button>
                </Form>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Link to="/login" className="flex flex-col items-center gap-1 text-gray-500">
            <LogIn size={24} />
            <span className="text-xs">로그인</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function MobileLayout() {
  const { user, toastMessage } = useLoaderData<LoaderData>();
  useEffect(() => {
    if (toastMessage) {
      if (toastMessage.type === 'success') {
        toast.success(toastMessage.message);
      }
      // 추후 error, info 등 다른 타입의 토스트도 추가할 수 있습니다.
    }
  }, [toastMessage]);
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4">
        {/* 이 부분에 각 페이지의 실제 내용이 들어옵니다 */}
        <Outlet />
      </main>
      <BottomNav user={user} />
       <Toaster richColors /> 
    </div>
  );
}