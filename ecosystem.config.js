const path = require('node:path');

const port = String(process.env.PORT ?? 3000);
const logDirectory = process.env.APPLE333_PM2_LOG_DIR ?? '/var/log/apple333';

/**
 * Bare-metal fallback only. Docker Compose under deploy/ is the canonical
 * production deployment path; never run this process on the same host/port as
 * the Docker app service. PM2 itself is an operator-managed host dependency.
 */
module.exports = {
  apps: [
    {
      name: 'apple333',
      cwd: __dirname,
      script: './node_modules/next/dist/bin/next',
      args: ['start', '-p', port],
      interpreter: 'node',
      instances: process.env.APPLE333_PM2_INSTANCES ?? 'max',
      exec_mode: 'cluster',
      instance_var: 'APPLE333_INSTANCE_ID',
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10_000,
      listen_timeout: 15_000,
      max_memory_restart: '768M',
      merge_logs: true,
      time: true,
      out_file: path.join(logDirectory, 'app.out.log'),
      error_file: path.join(logDirectory, 'app.error.log'),
      env: {
        NODE_ENV: 'development',
        PORT: port
      },
      env_staging: {
        NODE_ENV: 'production',
        APPLE333_RUNTIME_ENVIRONMENT: 'staging',
        PORT: port
      },
      env_production: {
        NODE_ENV: 'production',
        APPLE333_RUNTIME_ENVIRONMENT: 'production',
        PORT: port
      }
    }
  ]
};
