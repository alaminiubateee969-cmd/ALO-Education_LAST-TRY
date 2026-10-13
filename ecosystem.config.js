// PM2 production config — verified VPS (see DEPLOYMENT.md):
//   app: learn-aloeducation · dir: /home/aloedu/projects/learn-aloeducation
//   Node 22 · Next.js standalone · 127.0.0.1:3017 behind Nginx (80/443)
// __dirname keeps cwd correct wherever PM2 is started from on the VPS.
module.exports = {
  apps: [
    {
      name: "learn-aloeducation",
      script: ".next/standalone/server.js",
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
