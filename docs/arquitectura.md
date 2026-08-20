# Arquitectura

## Stack

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Framework**: Express 5
- **Base de datos**: PostgreSQL, corriendo en Docker
- **ORM**: Prisma (`prisma/schema.prisma`, 12 modelos)
- **Validación**: Zod
- **Auth**: JWT (access + refresh) con `bcrypt` para hashear contraseñas
- **Pagos**: MercadoPago (SDK oficial)
- **Imágenes**: Cloudinary (upload directo desde el frontend con firma generada por el backend)
- **Emails**: Nodemailer (Gmail) para recuperación de contraseña
- **Tests**: Jest + Supertest

## Capas

```
routes/        →  Express routers, aplican authenticateToken / requireAdmin donde corresponde
controllers/    →  Manejan el request/response, validan con Zod, llaman a Prisma
services/       →  Integraciones externas (Cloudinary, MercadoPago, Mail)
schemas/        →  Esquemas de validación Zod
middlewares/    →  auth.middleware.js (JWT + roles)
```

`src/app.js` arma la app de Express (middlewares globales + montaje de routers). `src/index.js` la importa y la levanta con `app.listen`. Esta separación es la que permite testear con Supertest sin abrir un puerto real.

## Modelo de datos (resumen)

- `User` — PK es el **email**, no un id numérico. Tiene `roles: UserRole[]` (many-to-many implícito vía tabla intermedia con PK compuesta `[userEmail, role]`).
- `Listing` — pertenece a un `User` (host) y a una `City`. Tiene `Image[]`, `ListingAmenity[]` (join table con `Amenity`), `Booking[]`, `Favorite[]`, `Review[]`.
- `Booking` — pertenece a un `Listing` y a un `User` (guest). Tiene un `Payment` (1 a 1).
- `Payment` — estado del pago (`PENDING`/`APPROVED`/`REJECTED`/`REFUNDED`), guarda `preferenceId`/`paymentId`/`initPoint` de MercadoPago.
- `Province` / `City` — datos de referencia (seed), solo lectura vía API.

## Roles y niveles de acceso

| Rol | Se asigna | Puede |
|---|---|---|
| `USER` | Automático al registrarse | CRUD de sus propias publicaciones, reservas, reseñas, favoritos — cualquier `USER` ya puede publicar alojamientos, no existe un rol `HOST` separado |
| `ADMIN` | Manual / seed (`admin@reservar.com`) | Todo lo anterior + `GET /api/users`, `DELETE /api/users/:email` |

La protección de rutas es explícita por middleware (`authenticateToken`, `requireAdmin`), no implícita — ver `docs/api.md` para el detalle de cada endpoint.

## Flujo de autenticación

1. `POST /api/auth/signUp` o `/login` → el backend genera un **access token** (JWT, 15 min, viaja en el body de la respuesta) y un **refresh token** (JWT, 7 días, se guarda en la tabla `refreshTokens` y se manda como cookie `httpOnly`, `path=/api/auth`).
2. El frontend guarda el access token en memoria y lo manda como `Authorization: Bearer <token>` en cada request protegido.
3. Cuando el access token expira (`401` con `code: TOKEN_EXPIRED`), el frontend pega a `GET /api/auth/refresh` (la cookie viaja sola) para obtener un access token nuevo sin pedir credenciales de nuevo.
4. `authenticateToken` decodifica el JWT, valida que sea de tipo `access` y adjunta el payload (sin `iat`/`exp`/`type`) en `req.user`. `requireAdmin` chequea que `req.user.roles` incluya `{ role: 'ADMIN' }`.

## Flujo de pago (MercadoPago)

1. `POST /api/bookings` valida disponibilidad de fechas, crea un `Booking` (`PENDING`) y un `Payment` (`PENDING`) en una sola operación de Prisma.
2. Llama a `MercadoPagoService.createPreference(...)`, que crea una **Preference** en MercadoPago con `external_reference = payment.id` (así se puede correlacionar la notificación del webhook con nuestro registro) y `notification_url = BACKEND_URL/api/mercadopago/webhook`.
3. Devuelve al frontend el `initPoint` (URL de Checkout Pro) para redirigir al usuario a pagar.
4. Cuando el pago cambia de estado en MercadoPago, este pega a `POST /api/mercadopago/webhook`. `MercadoPagoService` valida la firma (`x-signature`, HMAC-SHA256 con `MERCADOPAGO_WEBHOOK_SECRET`), busca el pago real por id, y actualiza `Payment.status` según el mapeo `approved → APPROVED`, `rejected/cancelled → REJECTED`, `refunded → REFUNDED`.
5. Si el pago quedó `APPROVED`, el `Booking` pasa a `CONFIRMED`. Si quedó `REJECTED`, el `Booking` pasa a `CANCELLED`.

El webhook siempre responde `200` (salvo firma inválida) porque MercadoPago reintenta si no recibe un `200` dentro de ~22s, y no queremos reintentos infinitos por errores que no se van a resolver solos.

## Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP del backend |
| `NODE_ENV` | `development` / `production` / `test` — controla el flag `secure` de las cookies y el nivel de detalle de los errores devueltos |
| `DATABASE_URL` | Connection string de PostgreSQL (Prisma) |
| `FRONTEND_URL` | Usada por CORS y por las `back_urls` de MercadoPago (debe ser `https://` en producción) |
| `BACKEND_URL` | Usada como `notification_url` del webhook de MercadoPago (debe ser `https://` en producción) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Firma de los JWT de access/refresh |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial del servidor para crear preferencias y consultar pagos |
| `MERCADOPAGO_WEBHOOK_SECRET` | Validación de firma del webhook (opcional pero recomendado) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Firma de uploads de imágenes |
| `GOOGLE_APP_USER` / `GOOGLE_APP_PASSWORD` | Cuenta de Gmail usada por Nodemailer para el mail de recuperación de contraseña |
| `EMAIL_FROM` | Remitente que figura en ese mail (normalmente igual a `GOOGLE_APP_USER`) |
