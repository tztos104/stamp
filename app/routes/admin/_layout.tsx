import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, Form, useLocation } from "react-router";
import { getSessionWithPermission } from "~/lib/auth.server";
import { Home, Package, Users, LogOut, Menu, Monitor, Smartphone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import { commitSession, getFlashSession } from "~/lib/session.server";
import { useEffect } from "react";

type LoaderData = {
  toastMessage: {
    type: "success" | "error";
    message: string;
  } | null; // toastMessage는 객체이거나 null일 수 있습니다.

};


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user } = await getSessionWithPermission(request, "USER");
  
  // 1. URL에서 'view' 파라미터를 읽어옵니다. 없으면 'mobile'이 기본값.
  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "pc" ? "pc" : "mobile";
  const flashSession = await getFlashSession(request.headers.get("Cookie"));
  const toastMessage = flashSession.get("toast") || null;
 
  return json({ user, view, toastMessage }, {
    headers: { "Set-Cookie": await commitSession(flashSession) },
  });
};

// --- PC 버전 레이아웃 컴포넌트 ---
function PCLayout({ user, children }: { user: any, children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full grid-cols-[220px_1fr]">
      {/* PC용 사이드바 */}
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
      {/* 메인 콘텐츠 */}
      <div className="flex flex-col">
        <Header user={user} currentView="pc" />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// --- 모바일 버전 레이아웃 컴포넌트 ---
function MobileLayout({ user, children }: { user: any, children: React.ReactNode }) {
  return (
    <div className="flex flex-col w-full h-full">
      <Header user={user} currentView="mobile" />
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
    
  );
}

// --- 공통 헤더 컴포넌트 ---
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
            <div className="flex h-14 items-center border-b px-4">
              <Link to="/admin" className="flex items-center gap-2 font-semibold">
                <Package className="h-6 w-6" />
                <span>Admin Panel</span>
              </Link>
            </div>
            <SidebarNav />
          </SheetContent>
        </Sheet>
      )}

      <div className="w-full flex-1" />
      
      {/* PC/모바일 전환 버튼 */}
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

// --- 공통 사이드바 네비게이션 ---
function SidebarNav() {
  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      <Link to="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
        <Home className="h-4 w-4" /> 대시보드
      </Link>
     <Link
        to="/admin/events"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
      >
        <Package className="h-4 w-4" />
        이벤트 관리
      </Link>
      <Link to="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
        <Users className="h-4 w-4" /> 회원 관리
      </Link>
    </nav>
  );
}


// --- 최종 레이아웃을 결정하는 메인 컴포넌트 ---
export default function AdminLayout() {
  const { user, view } = useLoaderData<typeof loader>();
  const { toastMessage } = useLoaderData<LoaderData>();
  // 👇 토스트 메시지가 있으면 화면에 띄우는 로직 추가
  useEffect(() => {
    if (toastMessage && typeof toastMessage === 'object' && 'type' in toastMessage && 'message' in toastMessage) {
      if (toastMessage.type === 'success' && typeof toastMessage.message === 'string') {
        toast.success(toastMessage.message);
      }
      // 추후 error, info 등 다른 타입의 토스트도 추가 가능
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