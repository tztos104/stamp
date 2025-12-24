module.exports = {
  apps: [{
    name: "stamp-prod",
    // ✅ 수정 1: server.js 대신 npm start 명령어를 실행 (가장 확실함)
    script: "pnpm",
    args: "start",

    // ✅ 수정 2: npm start로 실행할 땐 cluster 모드보다 fork가 안전합니다.
    // (포트 충돌 방지, 홈 서버에선 인스턴스 1개로도 충분)
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',

    // ✅ 공통 설정
    env: {
      NODE_ENV: "development",
    },
    // 🏭 운영 서버 (LXC 210) 설정
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
      // ⚠️ DATABASE_URL 줄 삭제함 (앱이 .env 파일을 직접 읽도록 둠)
    },
    // 🚧 개발 서버 (LXC 220) 설정
    env_development: {
      NODE_ENV: "development",
      PORT: 3000
    }
  }]
}