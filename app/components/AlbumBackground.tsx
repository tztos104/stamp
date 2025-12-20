export default function AlbumBackground() {
    return (
        // 0. 베이스: 아주 깊은 바닷속 색상
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020c1b]">

            {/* =================================================================
          🌊 1. 빛줄기 (Light Rays) - 수면에서 깊은 곳으로 비추는 빛
         ================================================================= */}

            {/* 왼쪽에서 비추는 푸른 빛줄기 */}
            <div
                className="absolute top-[-50%] left-[-20%] w-[60vw] h-[200vh] 
        bg-gradient-to-b from-cyan-500/20 via-teal-900/5 to-transparent
        rotate-[-25deg] blur-[100px] animate-pulse"
                style={{ animationDuration: '12s' }}
            ></div>

            {/* 오른쪽에서 비추는 깊은 청록색 빛줄기 */}
            <div
                className="absolute top-[-60%] right-[-10%] w-[70vw] h-[200vh] 
        bg-gradient-to-b from-teal-400/10 via-blue-900/5 to-transparent
        rotate-[15deg] blur-[120px] animate-pulse"
                style={{ animationDuration: '18s', animationDelay: '2s' }}
            ></div>


            {/* =================================================================
          🫧 2. 심해 질감 및 부유물 (Deep Texture)
         ================================================================= */}

            {/* 바닥에서 올라오는 어둠 (깊이감 추가) */}
            <div className="absolute bottom-0 left-0 w-full h-[50vh] bg-gradient-to-t from-[#01060f] to-transparent opacity-80"></div>

            {/* 미세한 물결 노이즈 (이전과 다른 패턴) */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            ></div>

            {/* =================================================================
          ✨ 3. 떠다니는 빛의 입자 (심해의 먼지나 플랑크톤 느낌)
         ================================================================= */}
            <div className="absolute top-1/3 left-1/4 w-2 h-2 bg-cyan-300/40 rounded-full blur-[1px] animate-star-float" style={{ animationDuration: '15s' }}></div>
            <div className="absolute top-2/3 right-1/3 w-3 h-3 bg-teal-300/30 rounded-full blur-[2px] animate-star-float" style={{ animationDuration: '20s', animationDelay: '5s' }}></div>
            <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-white/40 rounded-full blur-[1px] animate-star-float" style={{ animationDuration: '18s', animationDelay: '2s' }}></div>

            {/* 전체적인 비네팅 (가장자리 어둡게) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_0%,#020c1b_100%)] opacity-60"></div>
        </div>
    );
}