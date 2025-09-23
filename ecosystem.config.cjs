// ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'stamp-app',
      script: './build/server/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 👇 이 두 줄을 추가하여 Node.js가 직접 .env 파일을 읽도록 합니다.
      interpreter: 'node',
      interpreter_args: '--env-file=.env',
   
    },
  ],
};