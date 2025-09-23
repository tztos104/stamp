#!/bin/sh
# scripts/entrypoint.sh (수정)

# SECURE_KEY_CONTENT 환경변수가 없으면 오류를 출력하고 종료
if [ -z "$SECURE_KEY_CONTENT" ]; then
  echo "Error: SECURE_KEY_CONTENT is not set."
  exit 1

fi
echo "$SECURE_KEY_CONTENT" > /app/secure.key
echo "Decrypting environment files..."
node /app/scripts/crypt.mjs decrypt
if [ -f "/app/.env.staging" ]; then
  echo "Found .env.staging, renaming to .env"
  mv /app/.env.staging /app/.env
elif [ -f "/app/.env" ]; then
  echo "Found .env, no rename needed."
fi

# 👇 2. 복호화된 .env 파일의 변수들을 현재 셸 환경으로 로드
if [ -f /app/.env ]; then
  echo "Loading environment variables from .env file..."
  export $(cat /app/.env | xargs)
else
  echo "FATAL: .env file not found after decryption. Halting."
  exit 1
fi

# 👇 1. 데이터베이스 마이그레이션 실행
echo "Running database migration..."
npx prisma migrate deploy

# 👇 2. 데이터베이스 시딩 실행 (선택 사항이지만, 첫 배포 시 유용)
echo "Running database seed..."
npx prisma db seed

# 복호화가 끝나면 메인 애플리케이션 실행
echo "Starting the application..."
exec "$@"