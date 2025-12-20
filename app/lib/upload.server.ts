import axios from "axios";
import sharp from "sharp";

// 1. 환경 변수 체크
const ENV_UPLOAD_URL = process.env.STORAGE_SERVER_URL || "";
const INTERNAL_HOST = "http://192.168.0.200:4000";
const PUBLIC_VIEW_ROOT = "https://img.tcroom.kr";

export async function processAndUploadImage(file: File): Promise<string | null> {
  // [디버깅] 파일이 들어왔는지 확인
  if (!file || file.size === 0) {
    console.log("❌ [Upload] 파일이 비어있음");
    return null;
  }

  // [디버깅] 환경변수 확인
  if (!ENV_UPLOAD_URL) {
    console.error("❌ [Upload] .env에 STORAGE_SERVER_URL이 없습니다! (현재값 비어있음)");
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const optimizedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(optimizedBuffer)], { type: 'image/webp' });
    formData.append('file', blob, filename);

    // URL 생성 로직
    const urlObj = new URL(ENV_UPLOAD_URL);
    const targetPath = urlObj.pathname;
    const internalUploadUrl = `${INTERNAL_HOST}${targetPath}`;

    // [디버깅] 실제로 요청하는 주소 출력
    console.log(`🚀 [Upload] 요청 시작: ${internalUploadUrl}`);
    console.log(`ℹ️ [Upload] 타겟 폴더: ${targetPath}`);

    // 전송
    const { data } = await axios.post(internalUploadUrl, formData, {
      // [중요] Node.js 환경에서 Axios가 헤더를 못 잡을 경우를 대비해 명시 (보통은 자동이지만 안전하게)
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    if (data.success) {
      console.log(`✅ [Upload] 성공! 리턴 URL: ${PUBLIC_VIEW_ROOT}${data.url}`);
      return `${PUBLIC_VIEW_ROOT}${data.url}`;
    }

    console.error(`❌ [Upload] 서버 응답 에러:`, data);
    return null;

  } catch (error: any) {
    // [디버깅] 상세 에러 출력
    console.error("❌ [Upload] 통신 중 치명적 오류 발생");
    if (error.code === 'ECONNREFUSED') {
      console.error("👉 원인: 200번 서버(192.168.0.200)가 꺼져있거나 포트가 막혔습니다.");
    } else if (axios.isAxiosError(error) && error.response) {
      console.error(`👉 서버 응답(${error.response.status}):`, error.response.data);
    } else {
      console.error("👉 에러 내용:", error.message);
    }
    return null;
  }
}

// ... 나머지 함수들(uploadImages, deleteImage 등)은 그대로 두셔도 됩니다.
export async function uploadImages(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(file => processAndUploadImage(file));
  const urls = await Promise.all(uploadPromises);
  return urls.filter((url): url is string => url !== null);
}

export async function deleteImage(fullUrl: string) {
  if (!fullUrl) return;
  try {
    const urlObj = new URL(fullUrl);
    const pathOnly = urlObj.pathname;
    await axios.delete(`${INTERNAL_HOST}/delete`, { data: { path: pathOnly } });
  } catch (error) {
    console.error(`이미지 삭제 실패 (${fullUrl}):`, error);
  }
}

export async function deleteImages(urls: string[]) {
  await Promise.all(urls.map(url => deleteImage(url)));
}