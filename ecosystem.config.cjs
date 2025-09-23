module.exports = {
  apps: [
    {
      name: 'stamp-app',
      script: './build/server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 👇 Node.js가 직접 .env 파일을 읽도록 interpreter 옵션을 사용합니다.
      interpreter: 'node',
      interpreter_args: '--env-file=.env',
    },
  ],
};