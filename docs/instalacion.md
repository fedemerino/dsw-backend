# Instalación y ejecución local

Instrucciones para levantar el backend de Reservar en tu máquina sin conocer el código.

## Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior (usa `--env-file`, disponible desde Node 20.6).
- [Docker](https://www.docker.com/) (para la base de datos PostgreSQL).
- Una cuenta de [MercadoPago](https://www.mercadopago.com.ar/developers) (credenciales de test) si vas a probar el flujo de pagos.
- Una cuenta de [Cloudinary](https://cloudinary.com/) (para el upload de imágenes).

## 1. Clonar el repositorio

```bash
git clone <url-del-repositorio-backend>
cd dsw-backend
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Levantar la base de datos

El proyecto incluye un `docker-compose.yml` con un Postgres 15 listo para desarrollo:

```bash
docker compose up -d
```

Esto levanta un contenedor `postgres_local` en `localhost:5432` con la base `bookings` (usuario/clave `postgres`/`postgres`).

## 4. Configurar variables de entorno

Copiar el archivo `.env` de ejemplo (o crear uno nuevo) con al menos:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookings?schema=public"
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="https://tu-tunel-ngrok.ngrok-free.dev"

JWT_SECRET=<un-secreto-cualquiera>
JWT_REFRESH_SECRET=<otro-secreto-cualquiera>

MERCADOPAGO_PUBLIC_KEY=<tu-public-key-de-test>
MERCADOPAGO_ACCESS_TOKEN=<tu-access-token-de-test>
MERCADOPAGO_WEBHOOK_SECRET=<tu-webhook-secret>

CLOUDINARY_CLOUD_NAME=<tu-cloud-name>
CLOUDINARY_API_KEY=<tu-api-key>
CLOUDINARY_API_SECRET=<tu-api-secret>

GOOGLE_APP_USER=<email-para-enviar-mails>
GOOGLE_APP_PASSWORD=<app-password-de-gmail>
```

> `BACKEND_URL` tiene que ser una URL accesible desde internet para que MercadoPago pueda pegarle al webhook (`/api/mercadopago/webhook`) en desarrollo. Se puede usar [ngrok](https://ngrok.com/) apuntando al puerto 3000.

Ver el detalle de cada variable en [`arquitectura.md`](./arquitectura.md#variables-de-entorno).

## 5. Correr las migraciones y el seed

```bash
npx prisma migrate deploy
npm run seed
```

El seed carga provincias, localidades, amenities, y crea un usuario administrador:

- **Email:** `admin@reservar.com`
- **Password:** la que esté hasheada en `prisma/seeders/seed.js` (contactar al equipo, o generar un usuario propio vía `POST /api/auth/signUp` y asignarle el rol `ADMIN` manualmente en la base).

## 6. Levantar el servidor

```bash
npm run dev
```

El servidor queda escuchando en `http://localhost:3000`. Podés verificar que está vivo con:

```bash
curl http://localhost:3000/health
```

## Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run dev` | Levanta el server con recarga automática (nodemon) |
| `npm start` | Levanta el server en modo producción (sin nodemon) |
| `npm test` | Corre la suite de tests (unitarios + integración) |
| `npm run test-coverage` | Corre los tests con reporte de cobertura |
| `npm run lint` / `npm run lint-fix` | Linting con ESLint |
| `npm run format` / `npm run format-check` | Formateo con Prettier |
| `npm run migrate:new -- <nombre>` | Crea una nueva migración de Prisma |
| `npm run migrate:up` | Aplica migraciones pendientes |
| `npm run migrate:reset` | Resetea la base (borra todo) |
| `npm run seed` | Corre el seeder |

Para correr los tests hace falta un paso extra de setup (base de datos de test) — ver [`testing.md`](./testing.md).
