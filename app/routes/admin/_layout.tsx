// app/routes/admin/_layout.tsx (수정 완료)


import { Link, Outlet, useLoaderData, Form, useLocation,type LoaderFunctionArgs } from "react-router";
import { getSessionWithPermission } from "~/lib/auth.server";
import { Home, Package, Users, LogOut, Menu, Monitor, Smartphone, Ticket } from "lucide-react"; // Ticket 아이콘 추가
import {
  Sheet,
  SheetContent,
  SheetHeader,      // 👈 SheetHeader 추가
  SheetTitle,       // 👈 SheetTitle 추가
  SheetDescription, // 👈 SheetDescription 추가
  SheetTrigger,
  SheetClose,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import {  commitSession, getFlashSession } from "~/lib/session.server";
import { useEffect } from "react";
import { json } from "@remix-run/node";

type LoaderData = {
  toastMessage: {
    type: "success" | "error";
    message: string;
  } | null;

};

export const loader = async ({ request }: LoaderFunctionArgs) => {
   const { user } = await getSessionWithPermission(request, "ADMIN");
  
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "pc" ? "pc" : "mobile";
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  const toastMessage = flashSession.get("toast") || null;
  flashSession.unset("toast");

 const data = { user, view, toastMessage };
  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(flashSession),
    },
  });
};

// --- PC 버전 레이아웃 컴포넌트 (변경 없음) ---
function PCLayout({ user, children }: { user: any, children: React.ReactNode }) {
  // ... (이전과 동일)
  return (
    <div className="grid min-h-screen w-full grid-cols-[220px_1fr]">
      <div className="border-r bg-muted/40">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/admin" className="flex items-center gap-2 font-semibold">
              <Package className="h-6 w-6" />
              <span>Admin Panel</span>
            </Link>
          </div>
          <div className="flex-1">
            <SidebarNav />
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <Header user={user} currentView="pc" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// --- 모바일 버전 레이아웃 컴포넌트 (변경 없음) ---
function MobileLayout({ user, children }: { user: any, children: React.ReactNode }) {
  // ... (이전과 동일)
   return (
    <div className="flex flex-col w-full h-full">
      <Header user={user} currentView="mobile" />
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}

// --- 공통 헤더 컴포넌트 (SheetContent 수정) ---
function Header({ user, currentView }: { user: any, currentView: 'pc' | 'mobile' }) {
    const location = useLocation();
    const toggleView = currentView === 'pc' ? 'mobile' : 'pc';
    const togglePath = `${location.pathname}?view=${toggleView}`;

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      {currentView === 'mobile' && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex flex-col">
            {/* 👇 SheetHeader, Title, Description 추가로 접근성 문제 해결 */}
            <SheetHeader className="border-b px-4 py-5 text-left">
              <SheetTitle>
                <Link to="/admin" className="flex items-center gap-2 font-semibold">
                    <Package className="h-6 w-6" />
                    <span>Admin Panel</span>
                </Link>
              </SheetTitle>
              <SheetDescription>
                관리자 메뉴를 통해 각 항목으로 이동하세요.
              </SheetDescription>
            </SheetHeader>
            <SidebarNav />
          </SheetContent>
        </Sheet>
      )}

      <div className="w-full flex-1" />
      
      <Button variant="outline" size="icon" asChild>
          <Link to={togglePath}>
              {currentView === 'pc' ? <Smartphone className="h-5 w-5"/> : <Monitor className="h-5 w-5"/>}
          </Link>
      </Button>

      <span className="text-sm text-muted-foreground hidden sm:inline">
        {user.name}({user.role})
      </span>
      <Form action="/logout" method="post">
        <Button variant="ghost" size="icon" type="submit" aria-label="로그아웃">
          <LogOut className="h-5 w-5" />
        </Button>
      </Form>
    </header>
  );
}

// --- 공통 사이드바 네비게이션 (링크 수정 및 추가) ---
function SidebarNav() {
  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 mt-4">
      {/* 👇 각 Link를 SheetClose로 감싸줍니다. asChild prop이 핵심입니다. */}
      <SheetClose asChild>
        <Link to="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
          <Home className="h-4 w-4" /> 대시보드
        </Link>
      </SheetClose>
      <SheetClose asChild>
       <Link
          to="/admin/events"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
        >
          <Package className="h-4 w-4" />
          이벤트 관리
        </Link>
      </SheetClose>
      <SheetClose asChild>
        <Link to="/admin/users" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
          <Users className="h-4 w-4" /> 회원 관리
        </Link>
      </SheetClose>
      <SheetClose asChild>
        <Link to="/admin/coupons" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
          <Ticket className="h-4 w-4" /> 쿠폰 관리
        </Link>
      </SheetClose>
    </nav>
  );
}


// --- 최종 레이아웃을 결정하는 메인 컴포넌트 (변경 없음) ---
export default function AdminLayout() {
  // ... (이전과 동일)
  const { user, view } = useLoaderData<typeof loader>();
  const { toastMessage } = useLoaderData<LoaderData>();
  useEffect(() => {
    if (toastMessage && typeof toastMessage === 'object' && 'type' in toastMessage && 'message' in toastMessage) {
      if (toastMessage.type === 'success' && typeof toastMessage.message === 'string') {
        toast.success(toastMessage.message);
      }
    }
  }, [toastMessage]);

  if (view === "pc") {
    return (
      <>
        <PCLayout user={user}><Outlet /></PCLayout>
        <Toaster richColors />
      </>
    );
  }
  
  return (
   <>
      <div className="min-h-screen w-full bg-muted/40 flex justify-center">
        <div className="w-full max-w-md bg-background shadow-lg">
          <MobileLayout user={user}><Outlet /></MobileLayout>
        </div>
      </div>
      <Toaster richColors />
    </>
  );
}