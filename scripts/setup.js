import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const DEFAULT_LOCAL_ADMIN_PASSWORD = '123456789';
const skipDev = process.argv.includes('--no-dev');

const log = (msg) => console.log(msg);
const step = (msg) => console.log(`\n▶ ${msg}`);

const run = (cmd, options = {}) =>
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', ...options });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureEnvFile() {
  step('Verificando .env');
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');

  if (existsSync(envPath)) {
    log('  .env ya existe, lo dejo como está.');
    return;
  }

  copyFileSync(envExamplePath, envPath);
  log('  Creé .env a partir de .env.example.');
  log('');
  log('  ⚠️  Antes de seguir, completá en .env:');
  log('     - JWT_SECRET / JWT_REFRESH_SECRET (podés generarlos con:');
  log('       node -e "console.log(crypto.randomUUID())")');
  log('     - MERCADOPAGO_ACCESS_TOKEN (credenciales de test)');
  log('     - CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET');
  log('     - GOOGLE_APP_USER / GOOGLE_APP_PASSWORD / EMAIL_FROM');
  log('     - BACKEND_URL (URL de ngrok u otro túnel hacia localhost:3000,');
  log('       solo hace falta si vas a probar el flujo de pago)');
  log('');
  log('  Ver docs/instalacion.md para el detalle. Volvé a correr');
  log('  "npm run setup" cuando lo hayas completado.');
  process.exit(0);
}

function checkDocker() {
  step('Verificando Docker');
  try {
    run('docker --version', { stdio: 'pipe' });
  } catch {
    console.error(
      '\n❌ No encontré Docker. Instalalo desde https://www.docker.com/ y volvé a correr este script.'
    );
    process.exit(1);
  }
  log('  Docker OK.');
}

function startDatabase() {
  step('Levantando Postgres (docker compose up -d)');
  run('docker compose up -d');
}

async function waitForDatabase() {
  step('Esperando a que Postgres esté listo');
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      run('docker compose exec -T postgres pg_isready -U postgres', {
        stdio: 'pipe',
      });
      log('  Postgres listo.');
      return;
    } catch {
      process.stdout.write('.');
      await sleep(1000);
    }
  }
  console.error(
    '\n❌ Postgres no respondió a tiempo. Revisá "docker compose logs postgres".'
  );
  process.exit(1);
}

function installDependencies() {
  step('Instalando dependencias (npm install)');
  run('npm install');
}

function runMigrations() {
  step('Aplicando migraciones de Prisma');
  run('npx prisma migrate deploy');
}

function runSeed() {
  step('Corriendo el seed');
  const adminPassword =
    process.env.SETUP_ADMIN_PASSWORD || DEFAULT_LOCAL_ADMIN_PASSWORD;
  log(
    `  Usando contraseña de admin "${adminPassword}" (solo para desarrollo local).`
  );
  log(
    '  Para elegir otra: SETUP_ADMIN_PASSWORD=<otra> npm run setup, o npm run seed -- --password=<otra>'
  );
  run(`npm run seed -- --password=${adminPassword}`);
}

function printSummary() {
  const adminPassword =
    process.env.SETUP_ADMIN_PASSWORD || DEFAULT_LOCAL_ADMIN_PASSWORD;
  console.log(`
✅ Setup completo.

  API:            http://localhost:3000
  Health check:   http://localhost:3000/health
  Docs (Swagger): http://localhost:3000/api-docs
  Admin:          admin@reservar.com / ${adminPassword}
`);
}

function startDevServer() {
  step('Levantando el servidor (npm run dev)');
  run('npm run dev');
}

async function main() {
  console.log('🚀 Setup de Reservar backend\n');

  ensureEnvFile();
  checkDocker();
  startDatabase();
  await waitForDatabase();
  installDependencies();
  runMigrations();
  runSeed();
  printSummary();

  if (!skipDev) {
    startDevServer();
  } else {
    log(
      '(--no-dev) No levanté el servidor. Corré "npm run dev" cuando quieras.'
    );
  }
}

main().catch((err) => {
  console.error('\n❌ Setup falló:', err.message);
  process.exit(1);
});
