import { Outlet } from "react-router";
import { Home, User, ShoppingCart } from "lucide-react"; // 아이콘 라이브러리

// pnpm add lucide-react 명령어로 아이콘을 설치해주세요!
// 위 import 문을 사용하기 전에 터미널에서 pnpm add lucide-react 를 실행해야 합니다.

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
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4">
        {/* 이 부분에 각 페이지의 실제 내용이 들어옵니다 */}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}