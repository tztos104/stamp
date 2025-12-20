import axios from "axios";
import sharp from "sharp";

// 1. 환경 변수에서 전체 URL 가져오기
// 예: "https://img.tcroom.kr/upload/main" 또는 "https://img.tcroom.kr/upload/dev"
const ENV_UPLOAD_URL = process.env.STORAGE_SERVER_URL || "";

// 2. 실제 전송할 내부 서버 주소 (고정)
const INTERNAL_HOST = "http://192.168.0.200:4000";

// 3. 사용자에게 보여줄 도메인 (고정)
const PUBLIC_VIEW_ROOT = "https://img.tcroom.kr";

export async function processAndUploadImage(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;

  // 안전장치: .env 설정 확인
  if (!ENV_UPLOAD_URL) {
    console.error("❌ .env에 STORAGE_SERVER_URL이 설정되지 않았습니다.");
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 이미지 최적화
    const optimizedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(optimizedBuffer)], { type: 'image/webp' });
    formData.append('file', blob, filename);

    // ✨ [핵심 로직] 도메인 교체 (외부 도메인 -> 내부 IP)
    // 1. .env 주소("https://img.tcroom.kr/upload/main")를 파싱
    const urlObj = new URL(ENV_UPLOAD_URL);

    // 2. 경로만 추출 ("/upload/main")
    const targetPath = urlObj.pathname;

    // 3. 내부 IP와 결합 ("http://192.168.0.200:4000/upload/main")
    const internalUploadUrl = `${INTERNAL_HOST}${targetPath}`;

    // 4. 내부망으로 고속 전송
    const { data } = await axios.post(internalUploadUrl, formData);

    if (data.success) {
      // 리턴값: https://img.tcroom.kr/images/main/파일.webp
      return `${PUBLIC_VIEW_ROOT}${data.url}`;
    }

    console.error(`업로드 실패 (${internalUploadUrl}):`, data);
    return null;

  } catch (error) {
    console.error("이미지 서버 통신 오류:", error);
    return null;
  }
}

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

    // 삭제 요청도 내부 IP로 전송
    await axios.delete(`${INTERNAL_HOST}/delete`, {
      data: { path: pathOnly },
    });

  } catch (error) {
    console.error(`이미지 삭제 실패 (${fullUrl}):`, error);
  }
}

export async function deleteImages(urls: string[]) {
  await Promise.all(urls.map(url => deleteImage(url)));
}