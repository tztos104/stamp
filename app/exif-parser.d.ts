// app/exif-parser.d.ts

declare module 'exif-parser' {
    interface ExifTags {
        DateTimeOriginal?: number; // 우리가 필요한 촬영 날짜 (Unix Timestamp)
        [key: string]: any;
    }

    interface ExifResult {
        tags: ExifTags;
        imageSize: { width: number; height: number };
        thumbnailOffset?: number;
        thumbnailLength?: number;
        thumbnailType?: number;
        app1Offset?: number;
    }

    interface ExifParser {
        parse(): ExifResult;
    }

    // create 함수가 버퍼를 받아서 파서를 반환함
    export function create(buffer: Buffer): ExifParser;
}