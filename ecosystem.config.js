/* eslint-disable @typescript-eslint/no-require-imports -- PM2 config is CommonJS by design */
// PM2 production config. Deployed layout (scripts/deploy-production.sh):
//   /home/aloedu/projects/learn-aloeducation/current -> releases/<sha>
// PM2 loads this file from `current/`, so __dirname is the active release.
// Absolute script path + explicit cwd avoid ENOENT: uv_cwd if a directory
// PM2 was started from is later replaced.
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "learn-aloeducation",
      script: path.join(__dirname, ".next/standalone/server.js"),
      interpreter: "node",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: 3017,
        HOSTNAME: "127.0.0.1",
      },
    },
  ],
};
