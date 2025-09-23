module.exports = {
  apps: [
    {
      name: 'stamp-app',
      script: './build/server/index.js',
      // 👇 instances를 1로, exec_mode를 'fork'로 변경합니다.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 👇 dotenv를 사용하기로 했으므로, 이 부분은 삭제합니다.
      // interpreter: 'node',
      // interpreter_args: '--env-file=.env',
    },
  ],
};