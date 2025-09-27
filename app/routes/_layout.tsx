import { useEffect } from "react";
import { Link, Outlet, useLoaderData, useLocation,type LoaderFunctionArgs } from "react-router";

import { Home, User, ShoppingCart, Settings, LogOut, LogIn,BookHeart, LayoutDashboard, Phone  } from "lucide-react";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import {
  Sheet,
  SheetClose,
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
export type LoaderData = {
  toastMessage: {
    type: "success" | "error"| "info" | "warning";
    message: string;
  } | null; // toastMessage는 객체이거나 null일 수 있습니다.
  user: {
    name: string;
    phoneNumber: string;
    role: "USER" | "MEMBER" | "ADMIN" | null;
  } | null;
};

// 2. loader 함수가 LoaderData 타입을 반환하도록 명시합니다.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request);
  const user = session.user;
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  const toastMessage = flashSession.get("toast") || null;
  flashSession.unset("toast");
  const data: LoaderData = { toastMessage ,user};

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": await commitSession(flashSession),
    },
  });
};

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="h-16 flex items-center justify-between px-4 relative max-w-md mx-auto"> {/* justify-between 추가, relative 추가 */}
        {/* 왼쪽 로고 */}
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Stampify Logo" className="h-16 w-auto" /> {/* 로고 크기 h-8로 줄임 */}
        </Link>
        
        {/* 중앙 텍스트 */}
        <div className="absolute left-1/2 -translate-x-1/2"> {/* 중앙 정렬 */}
          <h1 className="text-lg font-bold text-gray-900">Stamp App</h1>
        </div>

        {/* 오른쪽 빈 공간 (균형을 위해) */}
        <div className="w-8"></div> {/* 로고와 같은 너비로 빈 공간 추가 (h-8 이미지에 맞춰 너비도 8로 설정) */}
      </div>
    </header>
  );
}

function BottomNav({ user }: { user: LoaderData['user'] }) {

     const { pathname } = useLocation(); // useLocation 훅 추가
  
  const getNavLinkClass = (path: string) => 
    `flex flex-col items-center gap-1 py-2 px-2 rounded-md transition-colors duration-200 ${
      pathname === path 
        ? "text-primary bg-green-100" // 활성 링크 스타일
        : "text-gray-600 hover:text-primary-foreground hover:bg-gray-100" // 비활성 링크 스타일
    }`;
   return (
    <nav className="bg-white border-t border-gray-200 sticky bottom-0 z-10 shadow-sm">
      <div className="h-16 flex justify-around items-center max-w-md mx-auto">
        <Link to="/" className={getNavLinkClass("/")}>
          <Home size={22} />
          <span className="text-xs font-medium">홈</span>
        </Link>
        <Link to="/card" className={getNavLinkClass("/card")}>
          <ShoppingCart size={22} />
          <span className="text-xs font-medium">스탬프</span>
        </Link>
        <Link to="/events" className={getNavLinkClass("/events")}>
          <BookHeart size={22} />
          <span className="text-xs font-medium">이벤트</span>
        </Link>

        {user ? (
          <Sheet>
            <SheetTrigger asChild>
             <Link to="/mypage" className={getNavLinkClass("/mypage")}>
                <User size={22} />
                <span className="text-xs font-medium">마이페이지</span>
              </Link>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]"> {/* Sheet 너비 조정 */}
              <SheetHeader className="mb-6">
                <SheetTitle className="text-2xl font-bold text-gray-800">{user.name}님</SheetTitle>
               <SheetDescription asChild>
                  <div className="text-gray-600 text-base"> {/* 이 div가 SheetDescription의 유일한 자식이 됨 */}
                    <div className="flex items-center gap-2 mt-2">
                      <Phone size={16} className="text-gray-500" /> {user.phoneNumber}
                    </div>
                   
                  </div>
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                {user.role === "ADMIN" && ( // 관리자일 경우에만 관리자 페이지 링크 표시
                   <SheetClose asChild>
                    <Button variant="outline" asChild className="justify-start">
                      <Link to="/admin" className="text-gray-800">
                        <LayoutDashboard className="mr-2 h-5 w-5" /> 관리자 페이지
                      </Link>
                    </Button>
                  </SheetClose>
                )}
                      <SheetClose asChild>
                  <Button variant="outline" asChild className="justify-start">
                    <Link to="/mypage" className="text-gray-800">
                      <Settings className="mr-2 h-5 w-5 text-gray-600" /> 내 정보 수정
                    </Link>
                  </Button>
                </SheetClose>
                <Form action="/logout" method="post" className="mt-4">
                  <Button type="submit" variant="destructive" className="w-full justify-start">
                    <LogOut className="mr-2 h-5 w-5" /> 로그아웃
                  </Button>
                </Form>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Link to="/login" className={getNavLinkClass("/login")}>
            <LogIn size={22} />
            <span className="text-xs font-medium">로그인</span>
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
      switch (toastMessage.type) {
        case 'success':
          toast.success(toastMessage.message);
          break;
        case 'error':
          toast.error(toastMessage.message);
          break;
        // 추후 info, warning 등 다른 타입도 추가 가능
        default:
          toast(toastMessage.message);
          break;
      }
    }
  }, [toastMessage]);
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 ">
        {/* 이 부분에 각 페이지의 실제 내용이 들어옵니다 */}
        <Outlet />
      </main>
      <BottomNav user={user} />
       <Toaster richColors /> 
    </div>
  );
}