// ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'stamp-app', // PM2에서 관리할 앱의 이름
      script: './build/server/index.js', // pnpm start가 실행하던 바로 그 파일
      instances: 'max', // 사용 가능한 모든 CPU 코어를 사용하여 앱을 실행
      exec_mode: 'cluster', // 클러스터 모드로 실행하여 성능 극대화
      autorestart: true, // 앱이 꺼지면 자동으로 재시작
      watch: false, // 파일 변경 감지는 사용 안 함 (Docker에서는 불필요)
      max_memory_restart: '1G', // 메모리 사용량이 1GB를 초과하면 재시작
    },
  ],
};