import pkg from '@prisma/client';
// 👇 1. "타입"은 따로 명확하게 가져옵니다 (이름을 충돌 안 나게 PrismaClientType으로 별명 지음)
import type { PrismaClient as PrismaClientType } from "@prisma/client";

// 👇 2. "값(실행용)"은 pkg에서 꺼내 씁니다.
const { PrismaClient } = pkg;

// 👇 3. 변수 선언할 때는 "타입"을 사용합니다.
let db: PrismaClientType;

declare global {
  // 👇 4. 여기도 "타입"을 사용합니다.
  var __db: PrismaClientType | undefined;
}

if (process.env.NODE_ENV === "production") {
  db = new PrismaClient();
} else {
  if (!global.__db) {
    global.__db = new PrismaClient();
  }
  db = global.__db;
}

export { db };