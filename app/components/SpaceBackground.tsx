import { useEffect, useState } from "react";

export default function SpaceBackground() {
    // 클라이언트에서만 랜덤값을 확정하기 위해 useEffect 사용 (Hydration Error 방지)
    const [stars, setStars] = useState<{ id: number; top: string; left: string; size: string; opacity: number; animDuration: string }[]>([]);

    useEffect(() => {
        // ✨ 랜덤한 별 200개 생성 (바둑판 배열 금지!)
        const newStars = Array.from({ length: 200 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,      // 0~100% 랜덤 위치
            left: `${Math.random() * 100}%`,
            size: `${Math.random() * 2 + 1}px`,  // 1px ~ 3px 크기 랜덤
            opacity: Math.random() * 0.7 + 0.3,  // 투명도 랜덤
            animDuration: `${Math.random() * 3 + 2}s` // 반짝임 속도 랜덤
        }));
        setStars(newStars);
    }, []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050314]">

            {/* ==========================================================
          🌌 1. 은하수 성운 (Nebula) - 보라/핑크/블루 그라데이션
         ========================================================== */}

            {/* 메인 보라색 성운 (중앙 좌측) */}
            <div
                className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] 
        bg-purple-800/20 rounded-full blur-[100px] mix-blend-screen animate-pulse"
                style={{ animationDuration: '8s' }}
            ></div>

            {/* 딥 블루 성운 (우측 하단) */}
            <div
                className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] 
        bg-indigo-900/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"
                style={{ animationDuration: '12s', animationDelay: '1s' }}
            ></div>

            {/* 핑크 포인트 (중앙) - 은하수의 밝은 부분 */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
        w-[60vw] h-[30vw] bg-pink-600/10 rounded-full blur-[80px] rotate-12 mix-blend-screen animate-pulse"
                style={{ animationDuration: '6s', animationDelay: '-2s' }}
            ></div>

            {/* 대각선으로 흐르는 은하수 띠 (가장 중요!) */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
        w-[120vw] h-[50vh] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent
        rotate-[-45deg] blur-[60px]"
            ></div>


            {/* ==========================================================
          ✨ 2. 리얼한 별 (Stars) - 랜덤 위치
         ========================================================== */}
            {stars.map((star) => (
                <div
                    key={star.id}
                    className="absolute bg-white rounded-full animate-twinkle"
                    style={{
                        top: star.top,
                        left: star.left,
                        width: star.size,
                        height: star.size,
                        opacity: star.opacity,
                        animationDuration: star.animDuration,
                        boxShadow: `0 0 ${parseInt(star.size) * 2}px rgba(255, 255, 255, 0.8)` // 별 빛 번짐 효과
                    }}
                />
            ))}

            {/* ==========================================================
          🌑 3. 비네팅 (가장자리 어둡게 처리하여 깊이감 추가)
         ========================================================== */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020005_100%)] opacity-80"></div>

        </div>
    );
}