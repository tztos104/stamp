import type { Config } from "tailwindcss";

export default {
    content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                // ✍️ 앨범용 손글씨 폰트
                handwriting: ['"Nanum Pen Script"', "cursive"],
                sans: [
                    '"Inter"',
                    "ui-sans-serif",
                    "system-ui",
                    "sans-serif",
                    '"Apple Color Emoji"',
                    '"Segoe UI Emoji"',
                    '"Segoe UI Symbol"',
                    '"Noto Color Emoji"',
                ],
            },
            keyframes: {
                // ============================================================
                // 🌠 1. 우주 & 갤럭시 관련 효과
                // ============================================================
                float: {
                    "0%, 100%": { transform: "translateY(0px) rotate(var(--tw-rotate, 0deg))" },
                    "50%": { transform: "translateY(-15px) rotate(var(--tw-rotate, 0deg))" },
                },

                twinkle: {
                    "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
                    "50%": { opacity: "1", transform: "scale(1.2)", boxShadow: "0 0 20px currentColor" },
                },
                "twinkle-slow": {
                    "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
                    "50%": { opacity: "0.8", transform: "scale(1)" },
                },
                "spin-slow": {
                    "0%": { transform: "translate(-50%, -50%) rotate(0deg)" },
                    "100%": { transform: "translate(-50%, -50%) rotate(180deg)" },
                },
                "nebula-drift": {
                    "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.3" },
                    "50%": { transform: "translate(-30px, 20px) scale(1.1)", opacity: "0.5" },
                },
                "particle-burst": {
                    "0%": { opacity: "1", transform: "translate(0, 0) scale(1)" },
                    "100%": {
                        opacity: "0",
                        transform: "translate(var(--tw-translate-x, 20px), var(--tw-translate-y, -20px)) scale(0)"
                    },
                },

                // ============================================================
                // 📸 2. 앨범 & UI 등장 효과 (이 부분이 추가됨!)
                // ============================================================
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "pop-in-up": {
                    "0%": { opacity: "0", transform: "translateY(40px) scale(0.8)" },
                    "70%": { opacity: "1", transform: "translateY(-10px) scale(1.05)" },
                    "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
                },

                // ============================================================
                // 🚪 3. 입장/퇴장 효과
                // ============================================================
                fadeOut: {
                    "0%": { opacity: "1" },
                    "100%": { opacity: "0" },
                },
                bigBang: {
                    "0%": { transform: "scale(0)", opacity: "1" },
                    "50%": { opacity: "1" },
                    "100%": { transform: "scale(20)", opacity: "0" },
                }
            },

            animation: {
                // 우주
                float: "float 4s ease-in-out infinite",

                twinkle: "twinkle 5s ease-in-out infinite",
                "twinkle-slow": "twinkle-slow 5s ease-in-out infinite",
                "spin-slow": "spin-slow 8s linear infinite",
                nebula: "nebula-drift 20s ease-in-out infinite alternate",
                particle: "particle-burst 1s ease-out forwards",

                // 앨범 & UI (✅ 추가됨)
                "fade-in": "fadeIn 0.5s ease-out forwards",
                "fade-in-up": "fadeInUp 0.8s ease-out forwards",
                "pop-in": "pop-in-up 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards",
                "pop-in-up": "pop-in-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) backwards", // 이름 통일

                // 입장
                "fade-out": "fadeOut 1.5s ease-in-out forwards",
                "big-bang": "bigBang 2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            },
        },
    },
    plugins: [],
} satisfies Config;