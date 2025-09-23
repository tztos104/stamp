module.exports = {
  apps: [
    {
     name: 'stamp-app',
      script: './build/server/index.js',
      instances: 'max', // 👈 모든 CPU 코어를 사용하는 클러스터 모드로 성능 극대화
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};