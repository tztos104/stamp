import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import dotenv from "dotenv";

// .env 파일 로드
dotenv.config();

const db = new PrismaClient();

// S3 설정
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.S3_BUCKET_NAME;

// 🏠 집 내부망 200번 서버 주소 (기본)
const TARGET_BASE_URL = "http://192.168.0.200:4000";

// 🚨 [설정] 이사할 폴더를 지정하세요! ('prod' 또는 'dev')
// 첫 번째 버킷 돌릴 땐 'prod', 두 번째 버킷 돌릴 땐 'dev'로 수정해서 실행
const TARGET_FOLDER = "main";

// 🌐 외부 접속용 도메인 (DB에 저장될 실제 주소)
const PUBLIC_DOMAIN = "https://img.tcroom.kr";

async function main() {
    console.log(`🚀 [S3 -> 개인서버] 이사 시작...`);
    console.log(`📂 대상 버킷: ${BUCKET}`);
    console.log(`🎯 타겟 폴더: ${TARGET_FOLDER} (${TARGET_BASE_URL}/upload/${TARGET_FOLDER})`);

    let continuationToken: string | undefined = undefined;
    let successCount = 0;
    let failCount = 0;

    do {
        // 1. S3 파일 목록 가져오기
        const command: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: BUCKET,
            ContinuationToken: continuationToken,
        });
        const { Contents, NextContinuationToken } = await s3.send(command);

        if (!Contents) {
            console.log("📭 버킷이 비어있습니다.");
            break;
        }

        for (const item of Contents) {
            if (!item.Key || item.Key.endsWith("/")) continue;

            process.stdout.write(`📦 이동 중: ${item.Key} ... `);

            try {
                // 2. S3에서 파일 다운로드
                const getObject = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: item.Key }));

                // Node.js 환경에서 Body stream을 Buffer로 변환
                // @ts-ignore: 최신 AWS SDK는 transformToByteArray 지원
                const byteArray = await getObject.Body?.transformToByteArray();
                if (!byteArray) throw new Error("Failed to read file from S3");
                const buffer = Buffer.from(byteArray);

                // 3. FormData 생성
                const formData = new FormData();
                const blob = new Blob([buffer], { type: getObject.ContentType || 'image/jpeg' });

                const filename = item.Key.split("/").pop() || item.Key; // 경로 제거하고 파일명만
                formData.append("file", blob, filename);

                // 4. 내 서버(200번)로 업로드
                // 🚨 [핵심 변경] URL 뒤에 폴더명(/prod 또는 /dev)을 붙여서 전송
                const { data } = await axios.post(`${TARGET_BASE_URL}/upload/${TARGET_FOLDER}`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity,
                });

                if (data.success) {
                    // ✅ 성공 시 DB 주소 변경 (Old -> New)

                    // Old: https://버킷명.s3.리전.amazonaws.com/폴더/파일명
                    const oldS3Url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`;

                    // New: https://img.tcroom.kr/images/prod/파일명
                    const newCloudUrl = `${PUBLIC_DOMAIN}${data.url}`;

                    console.log(`✅ OK`);

                    // 🔥 [DB 업데이트 1] EventImage 테이블
                    const updateImage = await db.eventImage.updateMany({
                        where: { url: oldS3Url },
                        data: { url: newCloudUrl }
                    });

                    // 🔥 [DB 업데이트 2] Event 테이블
                    const updateEvent = await db.event.updateMany({
                        where: { imageUrl: oldS3Url },
                        data: { imageUrl: newCloudUrl }
                    });

                    if (updateImage.count > 0 || updateEvent.count > 0) {
                        console.log(`   └ 🔄 DB 변경완료: EventImage(${updateImage.count}), Event(${updateEvent.count})`);
                    }

                    successCount++;
                }

            } catch (e: any) {
                console.log(`❌ 실패`);
                console.error(`   └ 오류: ${e.message}`);
                failCount++;
            }
        }

        continuationToken = NextContinuationToken;

    } while (continuationToken);

    console.log(`\n🎉 모든 작업 완료! (성공: ${successCount}, 실패: ${failCount})`);
}

main()
    .catch((e) => console.error("\n🔥 치명적 오류:", e))
    .finally(async () => {
        await db.$disconnect();
    });