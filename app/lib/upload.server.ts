import fs from "fs-jetpack";
import path from "path";
import sharp from "sharp";

/**
 * 업로드된 이미지 파일을 WebP 형식으로 변환하고,
 * public/uploads 폴더에 저장한 뒤 URL 경로를 반환합니다.
 * @param file 업로드된 File 객체
 * @returns 저장된 파일의 URL 경로 (예: /uploads/image-12345.webp)
 */
async function processAndSaveImage(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const filename = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
  const publicPath = path.join(process.cwd(), "public/uploads", filename);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // sharp를 사용해 이미지를 리사이징하고 WebP로 압축합니다.
    await sharp(buffer)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }) // 최대 800x800
      .webp({ quality: 80 }) // 80% 품질의 WebP로 변환
      .toFile(publicPath);

    return `/uploads/${filename}`;
  } catch (error) {
    console.error("파일 처리 실패:", error);
    return null;
  }
}

/**
 * 여러 개의 이미지 파일을 받아 처리하고 URL 배열을 반환합니다.
 * @param files File 객체의 배열
 * @returns 저장된 파일들의 URL 경로 배열
 */
export async function uploadImages(files: File[]): Promise<string[]> {
    const uploadPromises = files.map(file => processAndSaveImage(file));
    const urls = await Promise.all(uploadPromises);
    return urls.filter((url): url is string => url !== null); // null이 아닌 URL만 필터링
}