// PM2 config file. Named .cjs on purpose: package.json has "type": "module",
// and PM2 loads this with require(), which needs CommonJS.
module.exports = {
  apps: [
    {
      name: 'reservar-backend',
      script: 'src/index.js',
      cwd: __dirname,
      interpreter: 'node',
      // Loads .env.prod at process start (Node's native --env-file, no dotenv dependency needed).
      node_args: '--env-file=.env.prod',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
