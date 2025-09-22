#!/bin/sh
# scripts/entrypoint.sh (수정)

# SECURE_KEY_CONTENT 환경변수가 없으면 오류를 출력하고 종료
if [ -z "$SECURE_KEY_CONTENT" ]; then
  echo "Error: SECURE_KEY_CONTENT is not set."
  exit 1
fi

# 환경변수로 받은 키 내용을 secure.key 파일로 생성
echo "$SECURE_KEY_CONTENT" > /app/secure.key

# 복호화 스크립트 실행 (경로 수정)
echo "Decrypting environment files..."
node /app/scripts/crypt.mjs decrypt

# 복호화가 끝나면 메인 애플리케이션 실행
echo "Starting the application..."
exec "$@"