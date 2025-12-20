import { useEffect, useState } from "react";
import type { MemoryPost } from "@prisma/client";

interface Props {
    title: string;
    posts: MemoryPost[];
}

export default function SpaceAlbum({ title, posts }: Props) {
    const sortedPosts = [...posts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const startDate = sortedPosts.length > 0 ? sortedPosts[sortedPosts.length - 1].createdAt : null;
    const endDate = sortedPosts.length > 0 ? sortedPosts[0].createdAt : null;
    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    };
    return (
        <div className="w-full min-h-screen pb-20">

            {/* 📘 1. 타이틀 영역 (수정됨: 배경 없이 글씨만 크게!) */}
            <div className="relative w-full pt-24 pb-16 flex flex-col items-center justify-center text-center z-10">

                {/* 장식용 소제목 */}
                <span className="text-white/50 tracking-[0.5em] text-xs md:text-sm uppercase font-bold mb-4 animate-fade-in-up">
                    Time Capsule
                </span>

                {/* 메인 타이틀: 아주 크고 시원하게 */}
                <h2 className="text-5xl md:text-7xl lg:text-8xl font-handwriting text-[#fdfbf7] drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] rotate-[-2deg] animate-pop-in">
                    {title}
                </h2>
                {startDate && endDate && (
                    <p className="mt-6 text-white/60 font-mono text-sm md:text-base tracking-widest animate-fade-in">
                        {formatDate(startDate)}
                        {/* 시작일과 종료일이 다를 때만 물결표(~) 표시 */}
                        {formatDate(startDate) !== formatDate(endDate) && ` ~ ${formatDate(endDate)}`}
                    </p>
                )}
                {/* 하단 장식 선 */}
                <div className="mt-8 w-16 h-1 bg-white/20 rounded-full"></div>
            </div>

            {/* 📸 2. 폴라로이드 갤러리 (기존 유지) */}
            <div className="container mx-auto px-4">
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-8 space-y-10 px-4">

                    {sortedPosts.map((photo, index) => (
                        <div
                            key={photo.id}
                            className="break-inside-avoid relative inline-block w-full"
                            style={{ animation: `fadeInUp 0.6s ease-out ${index * 0.1}s backwards` }}
                        >
                            <PolaroidCard post={photo} index={index} />
                        </div>
                    ))}

                    {sortedPosts.length === 0 && (
                        <div className="col-span-full text-center text-white/40 py-20 font-handwriting text-2xl">
                            <p>앨범이 비어있어요.</p>
                            <p className="text-sm mt-2 font-sans">첫 번째 추억을 남겨주세요 ✨</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

// 🎞️ 마스킹 테이프 컴포넌트
function MaskingTape({ className, color = "bg-yellow-100/80", style }: { className?: string, color?: string, style?: React.CSSProperties }) {
    return (
        <div
            className={`${className} ${color} shadow-sm backdrop-blur-[1px]`}
            style={{
                clipPath: 'polygon(2% 0%, 98% 0%, 100% 10%, 98% 20%, 100% 30%, 98% 40%, 100% 50%, 98% 60%, 100% 70%, 98% 80%, 100% 90%, 98% 100%, 2% 100%, 0% 90%, 2% 80%, 0% 70%, 2% 60%, 0% 50%, 2% 40%, 0% 30%, 2% 20%, 0% 10%)',
                ...style
            }}
        >
            <div className="absolute inset-0 bg-white opacity-20 mix-blend-overlay"></div>
        </div>
    );
}

// ✨ 폴라로이드 카드 (사진 위 날짜/이름 + 하단 내용)
function PolaroidCard({ post, index }: { post: MemoryPost, index: number }) {
    const rotation = (index % 5) - 2;
    const isTwoTape = (index % 5 === 0);

    const tapeColors = [
        "bg-yellow-200/80", "bg-rose-200/80", "bg-blue-200/80",
        "bg-green-200/80", "bg-purple-200/80", "bg-orange-200/80",
    ];
    const mainColor = tapeColors[index % tapeColors.length];
    const isDiagonalA = index % 2 === 0;

    return (
        <div
            className="relative bg-white p-3 pb-6 shadow-lg transition-transform duration-300 hover:scale-105 hover:z-20 hover:rotate-0"
            style={{ transform: `rotate(${rotation}deg)` }}
        >
            {/* 테이프 */}
            {isTwoTape ? (
                isDiagonalA ? (
                    <>
                        <MaskingTape className="absolute -top-3 -left-2 w-16 h-5 rotate-[-40deg] z-20" color={mainColor} />
                        <MaskingTape className="absolute -bottom-3 -right-2 w-16 h-5 rotate-[-40deg] z-20" color={mainColor} />
                    </>
                ) : (
                    <>
                        <MaskingTape className="absolute -top-3 -right-2 w-16 h-5 rotate-[40deg] z-20" color={mainColor} />
                        <MaskingTape className="absolute -bottom-3 -left-2 w-16 h-5 rotate-[40deg] z-20" color={mainColor} />
                    </>
                )
            ) : (
                <MaskingTape
                    className="absolute -top-3 left-[55%] -translate-x-1/2 w-28 h-6 z-20"
                    style={{
                        transform: `translateX(-50%) rotate(${(index % 3) - 1.5}deg)`,
                        clipPath: 'polygon(2% 0%, 98% 0%, 100% 10%, 98% 20%, 100% 30%, 98% 40%, 100% 50%, 98% 60%, 100% 70%, 98% 80%, 100% 90%, 98% 100%, 2% 100%, 0% 90%, 2% 80%, 0% 70%, 2% 60%, 0% 50%, 2% 40%, 0% 30%, 2% 20%, 0% 10%)'
                    }}
                    color={mainColor}
                />
            )}

            {/* 🖼️ 사진 + 오버레이 정보 */}
            <div className="relative bg-slate-50 overflow-hidden mb-4 shadow-inner border border-slate-100/50 group">
                <img
                    src={post.mediaUrl || ""}
                    alt="memory"
                    className="w-full h-auto object-cover block filter contrast-[1.05]"
                    loading="lazy"
                />

                {/* 날짜 & 이름 (사진 우측 하단) */}
                <div className="absolute bottom-2 right-2 bg-white/80 backdrop-blur-[2px] px-2 py-1 rounded shadow-sm flex items-center gap-2 z-10">
                    <span className="text-[10px] text-slate-500 font-mono tracking-tighter leading-none">
                        {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <div className="w-[1px] h-2 bg-slate-300"></div>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider leading-none">
                        {post.nickname}
                    </span>
                </div>
            </div>

            {/* 📝 내용 (중앙 정렬, 줄바꿈 지원) */}
            <div className="px-2 text-center">
                <p className="font-handwriting text-slate-800 text-xl leading-relaxed opacity-90 break-all">
                    {post.content}
                </p>
            </div>
        </div>
    );
}