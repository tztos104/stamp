// app/components/StampSlot.tsx

import { useFetcher } from "react-router"; // react-router-dom으로 변경
import { useState } from "react";
import { Gift } from "lucide-react";
import { DefaultStamp } from "./stamp";

// Stamp 타입에 eventId를 포함하도록 수정합니다.
type Stamp = {
  id: number;
  isViewed: boolean;
  eventId: string; // 👈 이벤트 ID 추가!
  event: {
    name: string;
  };
};

// 부모 컴포넌트로부터 stamp 객체와 클릭 핸들러 함수를 props로 받습니다.
interface StampSlotProps {
  stamp: Stamp;
  onStampClick: (eventId: string) => void; // 👈 클릭 시 eventId를 전달할 함수
}

export function StampSlot({ stamp, onStampClick }: StampSlotProps) {
  const fetcher = useFetcher();
  const [isRevealed, setIsRevealed] = useState(stamp.isViewed);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleOpenStamp = () => {
    if (isRevealed) return;
    setIsAnimating(true);
    setTimeout(() => {
      setIsRevealed(true);
      setIsAnimating(false);
      const formData = new FormData();
      formData.append("stampEntryId", String(stamp.id));
      fetcher.submit(formData, {
        method: "post",
        action: "/api/stamps/view", // 이 action 경로는 유효해야 합니다.
      });
    }, 500);
  };

  // 아직 열어보지 않은 스탬프 (기존과 동일)
  if (!isRevealed) {
    return (
      <button
        onClick={handleOpenStamp}
        className="aspect-square w-full rounded-full border-2 border-dashed bg-yellow-100/50 flex flex-col items-center justify-center text-yellow-600 hover:bg-yellow-100 transition-all transform hover:scale-105"
      >
        <Gift className={`h-8 w-8 ${isAnimating ? 'animate-bounce' : ''}`} />
        <span className="text-xs mt-1 font-semibold">열어보기</span>
      </button>
    );
  }

  // 👇 이미 열어본 스탬프: 클릭 가능한 버튼으로 감싸고 onClick 핸들러 추가
  return (
    <button
      onClick={() => onStampClick(stamp.eventId)}
      className="aspect-square w-full rounded-full transition-all transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      aria-label={`${stamp.event.name} 이벤트 정보 보기`}
    >
      <DefaultStamp>
        {/* 도장 안에 이벤트 이름을 넣을 수도 있습니다 (선택 사항) */}
        {/* <span className="text-xs text-center">{stamp.event.name}</span> */}
      </DefaultStamp>
    </button>
  );
}