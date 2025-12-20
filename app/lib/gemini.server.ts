import { GoogleGenAI } from "@google/genai";

// API 키가 없으면 서버가 시작되지 않도록 방지
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in .env file");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ------------------------------------------------------------------
// 1. [Schema] AI가 뱉어야 할 데이터 구조
// ------------------------------------------------------------------
const messageSchema = {
    type: "OBJECT",
    properties: {
        messages: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    content: { type: "STRING", description: "리얼한 축하 메시지" },
                    nickname: { type: "STRING", description: "완벽한 익명 닉네임" },
                    aiStyle: {
                        type: "OBJECT",
                        properties: {
                            x: { type: "NUMBER" },
                            y: { type: "NUMBER" },
                            theme: { type: "STRING" },
                            animDuration: { type: "STRING" },
                            scale: { type: "NUMBER" },
                        },
                        required: ["x", "y", "theme", "animDuration", "scale"],
                    },
                },
                required: ["content", "nickname", "aiStyle"],
            },
        },
    },
    required: ["messages"],
};

// ------------------------------------------------------------------
// 2. [Function] AI 유령 작가 (입력값: 이름, 나이, 성별 추가)
// ------------------------------------------------------------------
export async function generateAiMessages(
    topic: string,
    count: number,
    // ✨ 추가된 정보: 이걸 받아야 호칭 정리가 됩니다.
    targetInfo: { name: string; age: string; gender: "male" | "female" }
) {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // 1.5-flash가 가장 안정적입니다.
            config: {
                responseMimeType: "application/json",
                responseSchema: messageSchema,
                temperature: 1.5, // 창의성 최대치 (다양한 말투 유도)
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `
                [역할]
                너는 이 롤링페이퍼를 몰래 채워주는 '익명의 지인들'이야.
                AI인 것을 들키면 절대 안 돼. **무조건 사람처럼, 때로는 조금 엉성하게** 써줘.

                [타겟 정보]
                - 이름: "${targetInfo.name}"
                - 나이: "${targetInfo.age}"
                - 성별: "${targetInfo.gender}" (male=남성, female=여성)
                - 주제: "${topic}"

                [1. ⛔ 절대 금지 및 주의사항]
                - "행복하시길 기원합니다", "앞날에 축복이", "진심으로 축하드립니다" 같은 **번역기 말투 절대 금지**.
                - 문장은 길게 쓰지 마. (1~2줄로 짧게)
                - **누군지 특정할 수 있는 닉네임 금지** (예: "너의 베프", "엄마가", "사랑하는 남편" -> X)
                - 성별과 나이를 고려해서 호칭을 틀리지 마. (예: 남자한테 '언니'라고 하지 않기)

                [2. 🗣️ 말투 가이드 (아래 페르소나를 골고루 섞어줘)]
                A. **찐친 (반말, 거침없음):** - "야 ${targetInfo.name}ㅋ 생일이냐? 맛난거 내놔"
                   - "올해는 철 좀 들자^^" 
                   - "ㅇㅇ아 생축. 선물은 나야"
                B. **사회생활/동료 (존댓말, 약간 어색함):**
                   - "${targetInfo.name}님~ 생일 축하드려요! 오늘 칼퇴하시길.."
                   - "대리님 생신 축하드립니다 ㅎㅎ 맛있는거 드세요!"
                C. **새벽 감성/무덤덤:**
                   - "태어나줘서 고맙다."
                   - "해피버스데이." (아주 심플하게)
                D. **인터넷 드립러:**
                   - "생축. 근데 이제 나이를 곁들인.."
                   - "생일 축하해 (대충 폭죽 터지는 이모티콘)"

                [3. 🕵️‍♂️ 익명 닉네임 센스 (추측 불가능하게!)]
                - 관계를 나타내지 말고, **랜덤한 사물, 상태, 음식** 등으로 지어줘.
                - 예: "지나가던 행인1", "민초단 회장", "어제 먹은 치킨", "월급루팡", "익명의 기부자", "방구석 1열", "배고픈 사람"

                [4. 👫 호칭 규칙 (매우 중요!)]
                - 타겟이 남자일 때: 형, 오빠, ${targetInfo.name}아, ${targetInfo.name}님, 너, 야
                - 타겟이 여자일 때: 누나, 언니, ${targetInfo.name}아, ${targetInfo.name}님, 너, 야
                - (작성자가 연상인지 연하인지 동갑인지 랜덤하게 가정하고 호칭을 섞어줘)

                [5. 🎨 배치 디자인 (화면 전체 사용)]
                - 좌표 범위: x(-400 ~ 400), y(-300 ~ 300)
                - 화면 중앙(0,0)에 뭉치지 말고 사방으로 흩뿌려줘.
                - 색상(theme): 핑크, 블루, 옐로우, 퍼플, 그린 등 다양하게.
              `,
                        },
                    ],
                },
            ],
        });

        let jsonText = response.text || "{}";
        jsonText = jsonText.replace(/```json|```/g, "").trim();

        const parsed = JSON.parse(jsonText);
        return Array.isArray(parsed.messages) ? parsed.messages : [];

    } catch (error) {
        console.error("Gemini AI Generate Error:", error);
        return [];
    }
}

// ------------------------------------------------------------------
// 3. [Function] AI 별자리 설계사
// ------------------------------------------------------------------
export async function optimizeLayout(posts: { id: number | string, content: string }[]) {
    if (posts.length === 0) return [];

    const layoutSchema = {
        type: "OBJECT",
        properties: {
            layouts: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        id: { type: "STRING" },
                        aiStyle: {
                            type: "OBJECT",
                            properties: {
                                x: { type: "NUMBER" },
                                y: { type: "NUMBER" },
                                theme: { type: "STRING" },
                                animDuration: { type: "STRING" },
                                scale: { type: "NUMBER" },
                            },
                            required: ["x", "y", "theme", "animDuration", "scale"],
                        },
                    },
                    required: ["id", "aiStyle"],
                },
            },
        },
        required: ["layouts"],
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            config: {
                responseMimeType: "application/json",
                responseSchema: layoutSchema,
                temperature: 1.0,
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `
                여기 ${posts.length}개의 메시지를 우주 공간에 아름답게 배치해줘.

                [입력 데이터]
                ${JSON.stringify(posts.map(p => ({ id: String(p.id), content: p.content.substring(0, 50) })))}

                [배치 미션]
                1. 모든 메시지를 분석해서 별자리 모양으로 배치해줘
                -생일자 생년월일에 맞춘 상징적인 모양이면 더 좋음.
                2. 색상: 분위기에 맞게 (노랑/핑크/블루/퍼플/화이트).
                - **화면 전체를 넓게 사용해서 별자리 모양으로 만들어줘** (가운데 뭉치기 금지!)
                - **좌표 범위:** x(-600 ~ 600), y(-400 ~ 400) 픽셀 단위.
                - **분산:** 서로 겹치지 않게 최대한 멀리 떨어뜨려줘.
                - **색상:** 노랑, 핑크, 블루, 퍼플, 화이트 골고루 섞기.
                - **크기:** 0.8 ~ 1.5 랜덤.

              `,
                        },
                    ],
                },
            ],
        });

        // 🛡️ [안전장치 추가] 마크다운 기호 제거
        let jsonText = response.text || "{}";
        jsonText = jsonText.replace(/```json|```/g, "").trim();

        const parsed = JSON.parse(jsonText);
        return parsed.layouts || [];

    } catch (error) {
        console.error("Gemini AI Layout Error:", error);
        return [];
    }
}