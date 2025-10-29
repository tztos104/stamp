
import { CheckCircle, Star, Heart, Award, Trophy, Sparkles, type LucideIcon } from "lucide-react";

// Lucide 아이콘을 props로 받아올 수 있도록 타입을 정의합니다.
// 기본값은 Star 아이콘입니다.
interface StampProps {
  icon?: LucideIcon;
  color?: string; // Tailwind CSS 색상 클래스 (예: "text-red-500")
  bgColor?: string; // Tailwind CSS 배경색 클래스 (예: "bg-red-100")
  borderColor?: string; // Tailwind CSS 테두리 색상 클래스 (예: "border-red-400")
  children?: React.ReactNode; // 도장 안에 추가적인 텍스트 등을 넣을 경우
}

export function Stamp({
  icon: Icon = Star, // 기본 아이콘은 별
  color = "text-green-600",
  bgColor = "bg-green-100/50",
  borderColor = "border-green-400",
  children,
}: StampProps) {
  return (
    <div
      className={`relative aspect-square w-full rounded-full flex flex-col items-center justify-center p-2
                  ${bgColor} ${borderColor} border-2 overflow-hidden
                  transition-all duration-300 ease-in-out`}
    >
      <Icon className={`h-10 w-10 ${color}`} strokeWidth={2} />
      {children && <div className="text-xs font-semibold mt-1">{children}</div>}
      <Sparkles className="absolute top-1 right-1 h-2 w-2 text-white/80" /> {/* 빛나는 효과는 유지 */}
    </div>
  );
}

// 여러 가지 기본 도장 스타일을 미리 정의할 수 있습니다.
export const DefaultStamp = () => <Stamp icon={CheckCircle} color="text-indigo-600" bgColor="bg-indigo-100/50" borderColor="border-indigo-400" />;
export const StarStamp = () => <Stamp icon={Star} color="text-yellow-600" bgColor="bg-yellow-100/50" borderColor="border-yellow-400" />;
export const HeartStamp = () => <Stamp icon={Heart} color="text-pink-600" bgColor="bg-pink-100/50" borderColor="border-pink-400" />;
export const AwardStamp = () => <Stamp icon={Award} color="text-purple-600" bgColor="bg-purple-100/50" borderColor="border-purple-400" />;