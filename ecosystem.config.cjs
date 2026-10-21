// pm2 services. Start: npm run pm2:start (worker only) or npx pm2 start ecosystem.config.cjs (both).
// Logs: npx pm2 logs tytsaas-worker · status: npx pm2 status
module.exports = {
  apps: [
    {
      name: "tytsaas-worker",
      script: "worker/index.js",
      node_args: "--env-file=.env",
      cwd: __dirname,
      // One tick every SCAN_INTERVAL_MINUTES; restarted if it crashes, with a growing delay.
      autorestart: true,
      exp_backoff_restart_delay: 5000,
      max_memory_restart: "1G",
      // SIGINT lets the current queries finish before the process exits.
      kill_timeout: 10000,
      time: true,
      out_file: "logs/worker.out.log",
      error_file: "logs/worker.err.log",
      merge_logs: true,
    },
    {
      name: "tytsaas-api",
      script: "server.js",
      node_args: "--env-file=.env",
      cwd: __dirname,
      autorestart: true,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "1G",
      time: true,
      out_file: "logs/api.out.log",
      error_file: "logs/api.err.log",
      merge_logs: true,
    },
  ],
};
