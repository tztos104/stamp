// app/lib/upload.server.ts (최종 수정)
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
  for await (const chunk of data) {
    processedImageStream.write(chunk);
  }
  processedImageStream.end();

  // 👇 여기가 핵심 수정사항입니다!
  // .done()을 한 번만 호출하고 결과를 변수에 저장합니다.
  const result = await upload.done();

  // 저장된 결과에서 Key를 사용하여 URL을 만듭니다.
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${result.Key}`;
  return url;
};