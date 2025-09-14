import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { Home, User, ShoppingCart } from "lucide-react";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner"; // 👈 toast 함수 import
import { getSession, commitSession } from "~/lib/session.server"; // 👈 세션 유틸리티 import

type LoaderData = {
  toastMessage: {
    type: "success" | "error";
    message: string;
  } | null; // toastMessage는 객체이거나 null일 수 있습니다.
};

// 2. loader 함수가 LoaderData 타입을 반환하도록 명시합니다.
export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response> => {
  const session = await getSession(request.headers.get("Cookie"));
  const toastMessage = session.get("toast") || null;

  const data: LoaderData = { toastMessage };

  return json(data, {
    headers: { "Set-Cookie": await commitSession(session) },
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

function BottomNav() {
  return (
    <nav className="bg-white border-t sticky bottom-0">
      <div className="h-16 flex justify-around items-center max-w-md mx-auto">
        <a href="#" className="flex flex-col items-center gap-1 text-blue-600">
          <Home size={24} />
          <span className="text-xs font-bold">홈</span>
        </a>
        <a href="#" className="flex flex-col items-center gap-1 text-gray-500">
          <ShoppingCart size={24} />
          <span className="text-xs">스탬프</span>
        </a>
        <a href="#" className="flex flex-col items-center gap-1 text-gray-500">
          <User size={24} />
          <span className="text-xs">마이페이지</span>
        </a>
      </div>
    </nav>
  );
}

export default function MobileLayout() {
  const { toastMessage } = useLoaderData<LoaderData>();
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
      <BottomNav />
       <Toaster richColors /> 
    </div>
  );
}