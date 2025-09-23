
# --- 1. 빌드(builder) 단계 ---
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
# 👇 PM2 설정 파일을 이미지 안으로 복사
COPY ecosystem.config.cjs .
COPY .env.*.enc .
COPY server.js .

ENV NODE_ENV=production

ENTRYPOINT ["/app/scripts/entrypoint.sh"]

# 👇 CMD 명령어를 pm2-runtime을 사용하도록 변경
# "pnpm exec"를 통해 node_modules에 설치된 pm2-runtime을 실행합니다.
CMD ["pnpm", "exec", "pm2-runtime", "start", "ecosystem.config.cjs"]