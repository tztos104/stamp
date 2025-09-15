
import fs from "fs-jetpack";
import path from "path";

const { writeAsync } = fs;

/**
 * 업로드된 파일을 public/uploads 폴더에 저장하고,
 * 접근 가능한 URL 경로를 반환합니다.
 * @param file 업로드된 File 객체
 * @returns 저장된 파일의 URL 경로 (예: /uploads/image-12345.png)
 */
export async function uploadImage(file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  const filename = `image-${Date.now()}${path.extname(file.name)}`;
  const publicPath = path.join(process.cwd(), "public/uploads", filename);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeAsync(publicPath, buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error("파일 업로드 실패:", error);
    return null;
  }
}