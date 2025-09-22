# Dockerfile (수정)

# --- 1. 빌드(builder) 단계 (변경 없음) ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm build
RUN pnpm prune --prod

# --- 2. 실행(runner) 단계 (수정) ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

# 빌드 단계에서 필요한 파일들만 복사
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# 👇 scripts 폴더 전체를 복사하도록 변경
COPY scripts/ ./scripts/

ENV NODE_ENV=production

# 👇 entrypoint.sh의 경로를 수정한 경로로 지정
ENTRYPOINT ["/app/scripts/entrypoint.sh"]

# entrypoint.sh가 최종적으로 실행할 명령어
CMD ["pnpm", "start"]