# Dockerfile (최종 디버깅용)

# --- 1. 빌드(builder) 단계 (변경 없음) ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm build
RUN pnpm prune --prod

# --- 2. 실행(runner) 단계 (수정) ---
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

# 빌드 단계에서 필요한 파일들만 복사
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY scripts/ ./scripts/
# 👇 ecosystem.config.cjs는 더 이상 사용하지 않으므로 복사 라인을 주석 처리하거나 삭제합니다.
# COPY ecosystem.config.cjs .
COPY .env*.enc .

ENV NODE_ENV=production

ENTRYPOINT ["/app/scripts/entrypoint.sh"]

CMD ["pnpm", "exec", "pm2-runtime", "start", "ecosystem.config.cjs"]