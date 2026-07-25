# Deploy a producción (VPS)

Arquitectura de deploy: **PostgreSQL en Docker** + **backend con PM2** (proceso Node nativo) + **nginx** como reverse proxy con HTTPS (Let's Encrypt / certbot). Todo en la misma VPS.

```
Internet ──▶ nginx (443/80) ──▶ PM2 (proceso Node, puerto 3000) ──▶ Postgres (Docker, puerto 5432)
```

## 0. Requisitos en la VPS

- Ubuntu/Debian (o similar) con acceso SSH y un usuario con permisos de `sudo`.
- Un dominio (o subdominio) apuntando a la IP de la VPS, para poder emitir certificado HTTPS.
- Docker y Docker Compose instalados.
- nginx instalado.

### Usuario dedicado para el deploy (no usar `root`)

El backend corre con PM2 como un usuario Linux normal, sin privilegios de `sudo` — no hace falta root para nada del pipeline automatizado (ni siquiera para `pm2 restart`). Con un usuario con `sudo` (o `root`):

```bash
# Crear el usuario sin password (el acceso va a ser solo por clave SSH)
sudo adduser --disabled-password --gecos "" deploy

# Carpeta donde va a vivir el proyecto (no es el home de "deploy", así que necesita chown)
sudo mkdir -p /home/apps
sudo chown deploy:deploy /home/apps
```

Autorizar la clave pública del par SSH dedicado al deploy (generado en tu máquina local con `ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/dsw_backend_deploy -N ""`):

```bash
sudo mkdir -p /home/deploy/.ssh
echo "<contenido de dsw_backend_deploy.pub>" | sudo tee -a /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Verificar desde tu máquina local (debería entrar sin pedir password):

```bash
ssh -i ~/.ssh/dsw_backend_deploy deploy@<IP-de-la-VPS>
```

Instalar Node.js 20+ y [PM2](https://pm2.keymetrics.io/) **para el usuario `deploy`**, vía `nvm`, así no hace falta sudo para `npm install -g`:

```bash
su - deploy
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
npm install -g pm2
```

> No agregues `deploy` al grupo `sudo` ni al grupo `docker` (estar en el grupo `docker` equivale en la práctica a acceso root sobre el host). Las únicas dos cosas que requieren sudo — `pm2 startup` (para que arranque en el boot) y la configuración de nginx — las corrés vos una sola vez con tu propio usuario admin, no forman parte de lo que hace `deploy` en cada deploy.

> **Nota sobre `nvm` + SSH no interactivo:** `nvm` solo se agrega al `PATH` en shells interactivos (vía `~/.bashrc`, que en Ubuntu corta la ejecución apenas detecta que el shell no es interactivo). El script de deploy en `.github/workflows/ci-cd.yml` corre por SSH de forma no interactiva, así que no encuentra `node`/`npm`/`pm2` a menos que cargue `nvm` explícitamente al principio del script (`export NVM_DIR=... && . "$NVM_DIR/nvm.sh" && nvm use default`) — ya está resuelto en el workflow, pero si alguna vez corrés comandos manuales por SSH no interactivo (ej. `ssh deploy@host "npm run algo"`), vas a necesitar el mismo truco.

> Si además `git pull` te tira `detected dubious ownership in repository at '...'`, es la protección de Git (post CVE-2022-24765) que exige que el usuario que corre `git` sea el dueño del directorio. Solucionalo una vez, como el usuario `deploy`: `git config --global --add safe.directory /home/apps/dsw-backend`.

## 1. Base de datos (Docker)

El repo ya trae `docker-compose.yml` con Postgres 15. Con tu usuario admin (no hace falta que sea `deploy`):

```bash
cd /home/apps/dsw-backend
docker compose up -d
docker ps   # verificar que postgres_local está healthy
```

> Si vas a exponer el puerto 5432 públicamente, restringilo con el firewall (`ufw`) — la base solo la necesita el backend, que corre en la misma máquina.

## 2. Backend (PM2)

Como el usuario `deploy`:

```bash
su - deploy
cd /home/apps
git clone <url-del-repositorio-backend> dsw-backend
cd dsw-backend
npm ci --omit=dev
```

Completar `.env.prod` con los valores reales (ver la plantilla en el repo — secretos de JWT nuevos y distintos a los de desarrollo, credenciales de producción de MercadoPago y Cloudinary, `FRONTEND_URL`/`BACKEND_URL` con el dominio real en `https://`).

Correr las migraciones y (una sola vez) el seed:

```bash
DATABASE_URL="<la de .env.prod>" npx prisma migrate deploy
DATABASE_URL="<la de .env.prod>" npm run seed
```

Levantar el proceso con PM2 usando `ecosystem.config.cjs` (en la raíz del repo):

```bash
pm2 start ecosystem.config.cjs
pm2 save          # persiste la lista de procesos
pm2 startup       # imprime el comando para que PM2 arranque solo en el boot de la VPS (correrlo una vez)
```

Comandos útiles:

```bash
pm2 status               # ver el proceso corriendo
pm2 logs reservar-backend
pm2 restart reservar-backend   # tras un nuevo deploy (git pull + npm ci + migrate deploy)
```

## 3. nginx (reverse proxy + HTTPS)

Copiar `docs/deploy/nginx.conf.example` a `/etc/nginx/sites-available/reservar-backend`, ajustar `server_name` con el dominio real, y habilitarlo (con tu usuario admin, no `deploy`):

```bash
sudo cp /home/apps/dsw-backend/docs/deploy/nginx.conf.example /etc/nginx/sites-available/reservar-backend
sudo ln -s /etc/nginx/sites-available/reservar-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Emitir el certificado HTTPS con certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio-backend.com
```

`https://` es obligatorio en `BACKEND_URL`/`FRONTEND_URL` para que el `auto_return` y el `notification_url` de MercadoPago funcionen (MercadoPago no acepta `notification_url` sobre `http://`).

## 4. Verificación

```bash
curl https://tu-dominio-backend.com/health
# -> OK
```

Probar el flujo completo desde el frontend: signup/login, crear una publicación, hacer una reserva y confirmar que el `initPoint` de MercadoPago redirige correctamente y que el webhook confirma la reserva (`Booking.status = CONFIRMED`) tras pagar.

## 5. Actualizar un deploy existente

Como el usuario `deploy`:

```bash
cd /home/apps/dsw-backend
git pull
npm ci --omit=dev
npx prisma migrate deploy   # con DATABASE_URL de producción en el entorno
pm2 restart reservar-backend
```

Este paso 5 es exactamente lo que automatiza el pipeline de CI/CD (ver abajo) — no debería hacer falta correrlo a mano salvo la primera vez.

## Checklist de variables de entorno en producción

Ver `.env.prod` en la raíz del repo (plantilla con placeholders) y el detalle de cada variable en [`arquitectura.md`](./arquitectura.md#variables-de-entorno). En particular, no reutilizar los secretos de `JWT_SECRET`/`JWT_REFRESH_SECRET` de desarrollo, y usar credenciales de **producción** (no de test) de MercadoPago.

## 6. CI/CD (GitHub Actions)

El repo incluye `.github/workflows/ci-cd.yml`, que corre en cada push/PR a `master` con tres jobs encadenados:

1. **`security`** — escanea el repo (incluyendo historial de git) en busca de secretos filtrados con [TruffleHog](https://github.com/trufflesecurity/trufflehog) (open source, corre antes de `npm ci` para no escanear `node_modules`), y corre `npm audit --omit=dev --audit-level=high` para cortar el pipeline si alguna dependencia de producción tiene una vulnerabilidad alta/crítica.
2. **`test`** — levanta un contenedor de Postgres 15 como *service* de GitHub Actions, corre `npm run lint`, `npm run format-check`, aplica las migraciones de Prisma contra esa base efímera y corre `npm run test-coverage` (los 185 tests, con el `coverageThreshold` de `jest.config.js` como gate).
3. **`deploy`** — solo si `security` y `test` pasaron y el push fue a `master`: primero valida que los 4 secrets de VPS estén configurados (si falta alguno, corta el job con `::error::` antes de intentar conectarse — ver más abajo), después se conecta por SSH a la VPS (usando [appleboy/ssh-action](https://github.com/appleboy/ssh-action)) y corre `git pull` + `npm ci --omit=dev` + `prisma migrate deploy` + `pm2 restart reservar-backend`.

### Secrets a configurar en GitHub

El job `deploy` corre contra el **Environment** `prod` (`environment: prod` en el YAML), así que los secrets van en `Settings → Environments → prod → Environment secrets` — no en los repository secrets. Si los configurás como repository secrets en vez de en el Environment `prod` (o le cambiás el nombre al Environment sin actualizar el YAML), el job los va a ver vacíos aunque existan, porque GitHub Actions solo expone los secrets de un Environment a los jobs que declaran ese mismo `environment:`.

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP o dominio de la VPS |
| `VPS_USER` | `deploy` — el usuario dedicado creado en la sección 0 (sin sudo) |
| `VPS_SSH_KEY` | Clave privada SSH (par de claves dedicado para el deploy, no tu clave personal) |
| `VPS_APP_PATH` | `/home/apps/dsw-backend` |

Si falta alguno de estos 4 secrets (o el job no tiene acceso al Environment donde están), el job `deploy` falla explícitamente en el paso "Verify VPS secrets are configured" con un mensaje indicando cuáles faltan, en vez de fallar más adelante con un error críptico de conexión SSH (`appleboy/ssh-action` con `host`/`key` vacíos da un error poco claro).

El script de deploy lee las variables de entorno de producción desde `.env.prod` **en la VPS** (no desde GitHub Actions) — GitHub Actions nunca ve los secretos de MercadoPago/Cloudinary/JWT de producción, solo las credenciales SSH para conectarse.
