// app/lib/upload.server.ts (스트리밍 방식으로 전면 수정)
import { PassThrough } from "stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { UploadHandler } from "@remix-run/node";
import sharp from "sharp";

// S3 클라이언트 초기화
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// 스트림을 받아서 sharp으로 변환하고 다시 스트림으로 반환하는 함수
function processImageStream() {
  const passthrough = new PassThrough();
  const sharpStream = sharp()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 });
  
  return passthrough.pipe(sharpStream);
}


export const s3UploadHandler: UploadHandler = async ({ name, data, filename }) => {
  // 'images' 필드에 대한 업로드만 처리합니다.
  if (name !== "images" && name !== "newImages") {
    return undefined;
  }

  const processedImageStream = processImageStream();

  // 스트림을 S3로 업로드
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: `uploads/image-${Date.now()}-${filename}.webp`,
      Body: processedImageStream,
      ContentType: "image/webp",
    },
  });

  // 비동기 스트림 데이터를 파이프로 연결
  // data는 AsyncIterable<Uint8Array> 타입입니다.
  for await (const chunk of data) {
    processedImageStream.write(chunk);
  }
  processedImageStream.end();

  await upload.done();

  // 업로드된 파일의 최종 URL 반환
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${(await upload.done()).Key}`;
  return url;
};