// app/lib/upload.server.ts (S3 업로드 방식으로 수정)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// S3 클라이언트 초기화. 
// AWS 자격 증명(Access Key, Secret Key)은 환경 변수에서 자동으로 읽어옵니다.
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

/**
 * 업로드된 이미지 파일을 WebP 형식으로 변환하여 S3에 업로드하고,
 * 해당 파일의 URL을 반환합니다.
 * @param file 업로드된 File 객체
 * @returns 저장된 파일의 URL 경로 (예: https://bucket-name.s3.region.amazonaws.com/uploads/image.webp)
 */
async function processAndUploadImage(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // sharp를 사용해 이미지를 리사이징하고 WebP 버퍼로 변환
    const optimizedBuffer = await sharp(buffer)
      .rotate() 
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const filename = `uploads/image-${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;

    // S3에 업로드하기 위한 명령어 생성
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: optimizedBuffer,
      ContentType: 'image/webp',
      
    });

    // S3로 명령어 전송 (업로드 실행)
    await s3Client.send(command);

    // 업로드된 파일의 최종 URL 반환
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;

  } catch (error) {
    console.error("S3 업로드 실패:", error);
    return null;
  }
}

/**
 * 여러 개의 이미지 파일을 받아 처리하고 URL 배열을 반환합니다.
 * @param files File 객체의 배열
 * @returns 저장된 파일들의 URL 경로 배열
 */
export async function uploadImages(files: File[]): Promise<string[]> {
    const uploadPromises = files.map(file => processAndUploadImage(file));
    const urls = await Promise.all(uploadPromises);
    return urls.filter((url): url is string => url !== null);
}