/**
 * PM2 Ecosystem 설정
 * OpenClaw 백그라운드 실행 및 관리
 * Windows 호환 - node --import tsx 사용
 */

module.exports = {
  apps: [
    {
      name: 'openclaw-moltbook',
      script: 'scripts/moltbook-scheduler.mts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/moltbook-error.log',
      out_file: './logs/moltbook-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      time: true
    },
    {
      name: 'openclaw-daily',
      script: 'src/cli/index.ts',
      args: 'daily run',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      cron_restart: '0 9 * * *',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/daily-error.log',
      out_file: './logs/daily-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      time: true
    }
  ]
};
