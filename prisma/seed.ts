// prisma/seed.ts

import { PrismaClient, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const db = new PrismaClient();

// Lucia의 hashPassword 함수와 동일한 로직
function hashPassword(password: string, salt?: string) {
  const theSalt = salt || randomBytes(8).toString('hex');
  const hashed = createHash('sha256')
    .update(`${theSalt}:${password}`)
    .digest('base64');
  return `${theSalt}${hashed}`;
}

async function main() {
  console.log('Seeding started...');

  // 1. 관리자(ADMIN) 사용자 생성
  const adminPhoneNumber = '01023112390';
  let adminUser = await db.user.findUnique({ where: { phoneNumber: adminPhoneNumber } });

  if (!adminUser) {
    adminUser = await db.user.create({
      data: {
        name: '이영준',
        phoneNumber: adminPhoneNumber,
        status: 'ACTIVE',
        role: Role.ADMIN,
      },
    });
    // 관리자 비밀번호 설정 (Key 테이블)
    await db.key.create({
      data: {
        id: `password:${adminPhoneNumber}`,
        userId: adminUser.id,
        hashedPassword: hashPassword('5425'), // 실제 운영시에는 더 안전한 비밀번호 사용
      },
    });
    console.log('✅ Admin user created.');
  } else {
    console.log('ℹ️ Admin user already exists.');
  }
  
  // 2. 일반 사용자(USER) 생성 (테스트용)
  const testUserPhoneNumber = '01000000000';
  let testUser = await db.user.findUnique({ where: { phoneNumber: testUserPhoneNumber }});

  if (!testUser) {
      testUser = await db.user.create({
          data: {
              name: '테스트유저',
              phoneNumber: testUserPhoneNumber,
              status: 'ACTIVE',
              role: Role.USER,
          }
      });
      await db.key.create({
          data: {
              id: `password:${testUserPhoneNumber}`,
              userId: testUser.id,
              hashedPassword: hashPassword('user123'),
          }
      });
      console.log('✅ Test user created.');
  } else {
      console.log('ℹ️ Test user already exists.');
  }


  // 3. 기본 카테고리 생성
  const categories = ['방탈출', '보육원봉사', '장애인봉사'];
  for (const name of categories) {
    await db.eventCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✅ Default categories created.');




  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });