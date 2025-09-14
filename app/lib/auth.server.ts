
import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { db } from "./db.server";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { redirect } from "react-router";

type UserRole = 'ADMIN' | 'MEMBER' | 'USER';
const adapter = new PrismaAdapter(db.session, db.user);
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

export function getSessionId(request: Request) {
  return lucia.readSessionCookie(request.headers.get('cookie') ?? '');
}

export class PermissionError extends Error {
  constructor() {
    super('권한이 없습니다.');
  }
}

export class NotMatchedPermissionError extends Error {
  constructor(role: string) {
    super(`${role} 역할의 권한 레벨을 확인할 수 없습니다.`);
  }
}


/**
 * 요청에서 세션 정보를 가져와 검증합니다.
 * 세션이 없으면 { user: null, session: null }을 반환합니다.
 */
export async function getSession(request: Request) {
  const sessionId = getSessionId(request);
  if (!sessionId) {
    return { user: null, session: null };
  }
  return await lucia.validateSession(sessionId);
}

type NonNullableSession = Exclude<
  Awaited<ReturnType<typeof getSession>>,
  { user: null; session: null }
>;

/**
 * 최소 권한 이상인 경우에만 세션 정보를 반환합니다.
 * 여기서는 간단하게 역할 우선순위를 사용합니다.
 */
export async function getSessionWithPermission(
  request: Request,
  minimumRole: UserRole
) {
  const session = await getSession(request);
  const userRole = session.user?.role as UserRole | undefined;
  if (!userRole) {
    throw redirect( `/login?error=permission&redirectTo=${encodeURIComponent(request.url)}`);
  }
  // 역할 우선순위: 숫자가 낮을수록 높은 권한 (ADMIN:1, MEMBER:2, USER:3)
  const rolePriority: Record<UserRole, number> = {
    ADMIN: 1,
    MEMBER: 2,
    USER: 3,
  };
  const requiredPriority = rolePriority[minimumRole];
  const userPriority = rolePriority[userRole];
  if (userPriority > requiredPriority) {
    throw redirect( `/login?error=permission&redirectTo=${encodeURIComponent(request.url)}`);
  }
  return session as NonNullableSession;
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
