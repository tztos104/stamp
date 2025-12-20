import axios from "axios";
import sharp from "sharp";

// 1. 기본 서버 주소 (http://192.168.0.200:4000 또는 https://img.tcroom.kr)
const STORAGE_BASE_URL = process.env.STORAGE_SERVER_URL;
const INTERNAL_UPLOAD_URL = "http://192.168.0.200:4000";
const PUBLIC_VIEW_URL = "https://img.tcroom.kr";

// 3. 최종 업로드 엔드포인트 조립 (예: http://.../upload/dev)
const UPLOAD_ENDPOINT = `${STORAGE_BASE_URL}`;

export async function processAndUploadImage(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;

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

    // 🚨 [핵심 변경] 쿼리 스트링 없이 깔끔한 주소로 전송
    const { data } = await axios.post(`${INTERNAL_UPLOAD_URL}/upload/local`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (data.success) {
      // 리턴값: https://img.tcroom.kr/images/dev/파일.webp
      return `${PUBLIC_VIEW_URL}${data.url}`;
    }

    return null;

  } catch (error) {
    console.error("클라우드 서버 업로드 실패:", error);
    return null;
  }
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(file => processAndUploadImage(file));
  const urls = await Promise.all(uploadPromises);
  return urls.filter((url): url is string => url !== null);
}

/**
 * 저장소 서버에 있는 이미지 파일을 삭제합니다.
 * @param fullUrl 예: https://img.tcroom.kr/images/prod/file.webp
 */
export async function deleteImage(fullUrl: string) {
  if (!fullUrl) return;

  try {
    // 전체 URL에서 도메인을 떼고 경로만 추출 (/images/prod/file.webp)
    const urlObj = new URL(fullUrl);
    const pathOnly = urlObj.pathname;

    // 200번 서버 삭제 API 호출
    await axios.delete(`${STORAGE_BASE_URL}/delete`, {
      data: { path: pathOnly }, // Body에 경로 전달
    });

  } catch (error) {
    // 이미지가 이미 없거나 에러가 나도, DB 삭제는 진행되어야 하므로 로그만 남김
    console.error(`이미지 삭제 실패 (${fullUrl}):`, error);
  }
}

/**
 * 여러 이미지를 한 번에 삭제
 */
export async function deleteImages(urls: string[]) {
  await Promise.all(urls.map(url => deleteImage(url)));
}