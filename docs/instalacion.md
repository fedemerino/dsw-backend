# Instalación y ejecución local

Instrucciones para levantar el backend de Reservar en tu máquina sin conocer el código.

## Opción rápida: script de setup

Si ya tenés Docker instalado y las cuentas externas creadas (ver [Requisitos previos](#requisitos-previos)), un solo comando hace todo lo de las secciones 1 a 6 (instalar dependencias, levantar Postgres con Docker, correr migraciones y seed, y levantar el server):

```bash
git clone <url-del-repositorio-backend>
cd dsw-backend
cp .env.example .env   # completar los valores reales, ver abajo
npm run setup
```

Si corrés `npm run setup` sin haber creado `.env` todavía, el script lo crea por vos a partir de `.env.example` y te dice exactamente qué completar antes de seguir (después volvés a correr `npm run setup`). La contraseña del usuario admin queda fija en `123456789` para desarrollo local (se puede cambiar con `SETUP_ADMIN_PASSWORD=<otra> npm run setup`). Para correr todo menos el servidor (por ejemplo si vas a usar `npm run dev` con nodemon aparte), usá `npm run setup -- --no-dev`.

El resto de esta guía explica cada paso por separado, para cuando el script no aplica (ya tenés algo levantado, querés entender qué hace cada cosa, o estás en un entorno donde Docker no es una opción).

## Requisitos previos

- [Node.js](https://nodejs.org/) 20 o superior (usa `--env-file`, disponible desde Node 20.6) y npm (viene con Node).
- [Docker](https://www.docker.com/) con Docker Compose (para levantar PostgreSQL local vía `docker-compose.yml`). Si no querés usar Docker, cualquier Postgres 15+ accesible sirve — solo hay que apuntar `DATABASE_URL` a esa instancia.
- Una cuenta de [MercadoPago Developers](https://www.mercadopago.com.ar/developers) con credenciales de **test** (`MERCADOPAGO_ACCESS_TOKEN`) — necesaria para crear reservas, no solo para "probar pagos": `POST /api/bookings` llama a MercadoPago siempre.
- [ngrok](https://ngrok.com/) (o cualquier otro túnel HTTP, ej. Cloudflare Tunnel) para exponer tu `localhost:3000` a internet — MercadoPago necesita poder pegarle al webhook (`BACKEND_URL`). Sin esto, las reservas se crean igual pero quedan `PENDING` para siempre (nunca reciben la confirmación de pago).
- Una cuenta de [Cloudinary](https://cloudinary.com/) (para el upload de imágenes de las publicaciones).
- Una cuenta de Gmail con una [contraseña de aplicación](https://myaccount.google.com/apppasswords) generada (para que Nodemailer pueda mandar el mail de recuperación de contraseña). No hace falta si no vas a probar ese flujo puntual.

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

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

y completar los valores reales. Estas son todas las variables que usa el backend:

| Variable | Para qué es | ¿Hace falta? |
|---|---|---|
| `PORT` | Puerto HTTP del servidor | Opcional, default `3000` |
| `NODE_ENV` | `development` / `production` / `test` — controla el flag `secure` de las cookies y el detalle de los errores devueltos | Sí |
| `DATABASE_URL` | Connection string de PostgreSQL (Prisma) | Sí |
| `FRONTEND_URL` | Origen permitido por CORS y usada en las `back_urls` de MercadoPago y en el link del mail de recuperación de contraseña | Sí |
| `BACKEND_URL` | URL pública (ngrok u otro túnel) usada como `notification_url` del webhook de MercadoPago | Sí, para que las reservas se confirmen solas |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Firma de los JWT de access/refresh | Sí |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial del servidor para crear preferencias de pago y consultar pagos | Sí |
| `MERCADOPAGO_WEBHOOK_SECRET` | Valida la firma `x-signature` del webhook | Opcional pero recomendado |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Firma de uploads de imágenes | Sí, para publicar alojamientos con fotos |
| `GOOGLE_APP_USER` / `GOOGLE_APP_PASSWORD` | Cuenta de Gmail usada por Nodemailer | Solo para el flujo de recuperar contraseña |
| `EMAIL_FROM` | Remitente del mail de recuperación (normalmente igual a `GOOGLE_APP_USER`) | Solo para el flujo de recuperar contraseña |

`MERCADOPAGO_PUBLIC_KEY` y `CLOUDINARY_URL` pueden aparecer en tu `.env` por costumbre/copiado, pero **el backend no los lee** (el `PUBLIC_KEY` lo usa el *frontend*, vía `VITE_MP_PUBLIC_KEY`) — no pasa nada si no los tenés.

> `BACKEND_URL` tiene que ser una URL accesible desde internet para que MercadoPago pueda pegarle al webhook (`/api/mercadopago/webhook`) en desarrollo. Se puede usar [ngrok](https://ngrok.com/) apuntando al puerto 3000: `ngrok http 3000`, y copiar la URL `https://...ngrok-free.dev` que te da a `BACKEND_URL`. Como el plan gratis de ngrok cambia la URL cada vez que lo reiniciás, tenés que actualizar `BACKEND_URL` (y reiniciar el server) cada vez que reiniciás el túnel.

Ver también el detalle narrativo en [`arquitectura.md`](./arquitectura.md#variables-de-entorno).

## 5. Correr las migraciones y el seed

```bash
npx prisma migrate deploy
npm run seed -- --password=<contraseña-para-el-admin>
```

El seed carga provincias, localidades, amenities, y crea un usuario administrador:

- **Email:** `admin@reservar.com`
- **Password:** la que le pases en `--password` (mínimo 8 caracteres). También se puede definir vía variable de entorno `ADMIN_PASSWORD` en vez de pasarla por línea de comandos.

Si `admin@reservar.com` ya existe, el seed no toca su contraseña — podés correr `npm run seed` sin `--password` en los reseeds siguientes (por ejemplo para recargar provincias/localidades/amenities). Si el admin **no** existe todavía y no indicás una contraseña, el seed falla con un mensaje explicando cómo pasarla.

## 6. Levantar el servidor

```bash
npm run dev
```

El servidor queda escuchando en `http://localhost:3000`. Podés verificar que está vivo con:

```bash
curl http://localhost:3000/health
```

La documentación interactiva de la API queda en `http://localhost:3000/api-docs` (Swagger UI).

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
| `npm run seed -- --password=<pwd>` | Corre el seeder (pide `--password` la primera vez, para crear el admin) |
| `npm run setup` | Instala, levanta Docker+Postgres, migra, seedea (admin `123456789`) y levanta el server, todo en un paso — ver [arriba](#opción-rápida-script-de-setup) |

Para correr los tests hace falta un paso extra de setup (base de datos de test) — ver [`testing.md`](./testing.md).
