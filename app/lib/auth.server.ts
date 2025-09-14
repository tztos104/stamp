
import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { db } from "./db.server";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const adapter = new PrismaAdapter(db.session, db.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      name: attributes.name,
      phoneNumber: attributes.phoneNumber,
      role: attributes.role,
    };
  },
});


declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      name: string;
      phoneNumber: string;
      role: "USER" | "MEMBER" | "ADMIN" | null;
    };
  }
}

export function hashPassword(password: string, salt?: string) {
  let theSalt = salt;
  if (!theSalt || theSalt.length !== 16) {
    theSalt = randomBytes(8).toString('hex'); // 16자리 salt 생성
  }
  const hashed = createHash('sha256')
    .update(`${theSalt}:${password}`)
    .digest('base64');
  return `${theSalt}${hashed}`;
}

/**
 * 저장된 해시와 입력된 비밀번호가 일치하는지 확인합니다.
 */
export function verifyPassword(hash: string, password: string) {
  const salt = hash.slice(0, 16);
  return hash === hashPassword(password, salt);
}
