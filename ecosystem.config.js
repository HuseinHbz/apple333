const fs = require('node:fs');
const path = require('node:path');

/**
 * This is the single canonical PM2 definition for the bare-metal deployment
 * lane. Docker Compose scripts under deploy/bin remain a separate, mutually
 * exclusive lane and must never share this process or port.
 *
 * The standalone server does not load dotenv files itself. Parse the protected
 * KEY=value file without evaluating it, then let PM2 inject those values into
 * the runtime. deploy/environment-check.sh validates file permissions and all
 * required production values before PM2 is ever called.
 */
function loadPlainEnvironment(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (!match) {
      throw new Error(`Invalid production environment entry on line ${index + 1}.`);
    }

    const [, key, rawValue] = match;
    const isQuoted =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")));
    values[key] = isQuoted ? rawValue.slice(1, -1) : rawValue;
  }

  return values;
}

const appRoot = path.resolve(process.env.APPLE333_APP_ROOT ?? __dirname);
const environmentFile = path.resolve(
  process.env.APPLE333_PM2_ENV_FILE ?? path.join(appRoot, '.env.production')
);
const fileEnvironment = loadPlainEnvironment(environmentFile);
const port = String(process.env.PORT ?? fileEnvironment.PORT ?? 3000);
const logDirectory =
  process.env.APPLE333_PM2_LOG_DIR ??
  fileEnvironment.APPLE333_PM2_LOG_DIR ??
  '/var/log/apple333';
const instances =
  process.env.APPLE333_PM2_INSTANCES ?? fileEnvironment.APPLE333_PM2_INSTANCES ?? 'max';

const runtimeEnvironment = {
  ...fileEnvironment,
  PORT: port,
  HOSTNAME: '127.0.0.1'
};

module.exports = {
  apps: [
    {
      name: 'apple333',
      cwd: appRoot,
      script: path.join(appRoot, '.next', 'standalone', 'server.js'),
      interpreter: 'node',
      instances,
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
        ...runtimeEnvironment,
        NODE_ENV: 'development',
        APPLE333_RUNTIME_ENVIRONMENT: 'development'
      },
      env_staging: {
        ...runtimeEnvironment,
        NODE_ENV: 'production',
        APPLE333_RUNTIME_ENVIRONMENT: 'staging'
      },
      env_production: {
        ...runtimeEnvironment,
        NODE_ENV: 'production',
        APPLE333_RUNTIME_ENVIRONMENT: 'production'
      }
    }
  ]
};
