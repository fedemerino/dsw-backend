# Documentación de la API

API REST expuesta bajo el prefijo `/api`. Formato de request/response: JSON (salvo donde se indique). Base URL en desarrollo: `http://localhost:3000`.

**Documentación interactiva (Swagger UI)**: con el server corriendo, `http://localhost:3000/api-docs`. El spec OpenAPI fuente está en [`openapi.yaml`](./openapi.yaml).

## Autenticación

La mayoría de las rutas protegidas esperan un **access token** JWT en el header:

```
Authorization: Bearer <accessToken>
```

- El **access token** dura 15 minutos y se obtiene en `login`/`signUp`/`refresh`.
- El **refresh token** dura 7 días y viaja en una cookie `httpOnly` (`refreshToken`), con `path=/api/auth`. Se usa automáticamente al pegarle a `GET /api/auth/refresh`.
- Roles disponibles: `USER` (default al registrarse), `HOST`, `ADMIN`. Un usuario puede tener más de un rol (tabla `userRoles`).
- Las rutas marcadas **🔒 Auth** requieren access token válido. Las marcadas **🔒 Admin** requieren además el rol `ADMIN` (middleware `requireAdmin`).

Errores comunes: `401` (sin token / token inválido o expirado), `403` (autenticado pero sin permiso sobre el recurso), `404` (no encontrado), `400` (validación), `500` (error interno).

---

## Auth — `/api/auth`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/signUp` | — | Crea un usuario nuevo (rol `USER` por defecto) |
| POST | `/login` | — | Login con email + password |
| GET | `/refresh` | cookie `refreshToken` | Renueva el access token |
| POST | `/logout` | — | Invalida el refresh token y limpia la cookie |
| POST | `/forgotPassword` | — | Envía un email con link de reseteo de contraseña |
| POST | `/resetPassword` | — | Cambia la contraseña usando el token recibido por email |

**POST `/api/auth/signUp`**
```json
// body
{
  "email": "user@example.com",
  "fullName": "Jane Doe",
  "password": "password123",
  "confirmPassword": "password123",
  "phoneNumber": "1122334455" // opcional
}
// 201
{
  "user": { "email": "...", "fullName": "...", "roles": [{ "role": "USER" }], "...": "..." },
  "accessToken": "eyJ...",
  "message": "User created successfully"
}
```

**POST `/api/auth/login`**
```json
// body
{ "email": "user@example.com", "password": "password123" }
// 200
{ "user": { "...": "..." }, "accessToken": "eyJ...", "message": "Login successful" }
```

---

## Users — `/api/users`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/` | 🔒 Admin | Lista todos los usuarios |
| GET | `/:email` | 🔒 Auth | Obtiene un usuario por email |
| PUT | `/update` | 🔒 Auth | Actualiza el propio perfil (o cualquiera si es Admin) |
| PATCH | `/:email/block` | 🔒 Admin | Bloquea a un usuario (reversible: no puede loguearse hasta ser desbloqueado) |
| PATCH | `/:email/unblock` | 🔒 Admin | Desbloquea a un usuario previamente bloqueado |
| DELETE | `/:email` | 🔒 Admin | Baja lógica de un usuario (`active = false`) |

Un usuario **bloqueado** (`blocked = true`) conserva su cuenta y sus datos pero no puede iniciar sesión ni renovar su token hasta que un admin lo desbloquee — es una sanción reversible, distinta de la baja lógica (`DELETE`, `active = false`) que da de baja la cuenta.

**PUT `/api/users/update`**
```json
// body
{ "email": "user@example.com", "fullName": "Jane D.", "phoneNumber": "1122334455", "avatarUrl": "https://..." }
// 200
{ "user": { "...": "..." }, "message": "User updated successfully" }
```

---

## Listings — `/api/listings`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista/filtra publicaciones (ver query params abajo) |
| GET | `/featured` | — | Publicaciones destacadas (hasta 6) |
| GET | `/myListings` | 🔒 Auth | Publicaciones del usuario autenticado |
| GET | `/favorites` | 🔒 Auth | Publicaciones favoritas del usuario autenticado |
| GET | `/:id` | — | Detalle de una publicación (con reviews, imágenes, amenities) |
| GET | `/bookings/:id` | — | Reservas activas/pendientes de una publicación (para el calendario) |
| POST | `/` | 🔒 Auth | Crea una publicación |
| POST | `/favorites` | 🔒 Auth | Marca/desmarca una publicación como favorita (toggle) |
| PUT | `/:id` | 🔒 Auth (dueño) | Actualiza una publicación propia |
| DELETE | `/:id` | 🔒 Auth (dueño) | Elimina una publicación propia (si no tiene reservas activas) |

**Query params de `GET /api/listings`**: `propertyType`, `priceFrom`, `priceTo`, `ratingFrom`, `amenities` (ids separados por coma), `cityId`, `startDate`, `endDate`, `guests`, `search`, `limit` (máx. 100, default 20).

**POST `/api/listings`**
```json
// body
{
  "title": "Depto en el centro",
  "description": "...",
  "address": "San Martín 123",
  "pricePerNight": 15000,
  "propertyType": "APARTMENT",
  "rooms": 2, "bathrooms": 1, "beds": 2, "maxGuests": 4,
  "petFriendly": false,
  "cityId": "<uuid de una ciudad>",
  "images": ["https://res.cloudinary.com/.../1.jpg", "https://res.cloudinary.com/.../2.jpg"],
  "amenities": ["<uuid de amenity>"]
}
// 201 -> el listing creado
```
Reglas: `images` requiere mínimo 2 URLs, `amenities` mínimo 1. Las imágenes se suben antes a Cloudinary (ver sección Files) y acá solo se guardan las URLs.

---

## Bookings — `/api/bookings`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/host` | 🔒 Auth | Reservas recibidas en las publicaciones del usuario (como anfitrión) |
| GET | `/user/:userEmail/count` | 🔒 Auth (propio o Admin) | Cantidad total y próximas reservas de un usuario |
| GET | `/user/:userEmail` | 🔒 Auth (propio o Admin) | Historial completo de reservas de un usuario |
| POST | `/` | 🔒 Auth | Crea una reserva y una preferencia de pago en MercadoPago |
| PUT | `/:bookingId` | 🔒 Auth (dueño de la reserva) | Actualiza fechas/huéspedes de una reserva `PENDING` |
| DELETE | `/:bookingId` | 🔒 Auth (dueño de la reserva) | Cancela una reserva |

**POST `/api/bookings`**
```json
// body
{ "listingId": "<uuid>", "startDate": "2027-01-10T00:00:00.000Z", "endDate": "2027-01-15T00:00:00.000Z", "guests": 2 }
// 201
{
  "booking": { "id": "...", "status": "PENDING", "totalPrice": 82500, "...": "..." },
  "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "preferenceId": "..."
}
```
`startDate`/`endDate` deben ser fechas ISO-8601 completas. Si las fechas se solapan con otra reserva `PENDING`/`CONFIRMED` de la misma publicación, devuelve `400`. El precio total incluye un 10% de recargo de servicio. Si MercadoPago no puede generar el link de pago, la reserva igual queda creada (`PENDING`, sin `initPoint`) y responde `502`.

**PUT `/api/bookings/:bookingId`**
```json
// body
{ "startDate": "2027-01-12T00:00:00.000Z", "endDate": "2027-01-16T00:00:00.000Z", "guests": 3 }
```
Solo el dueño de la reserva puede editarla, y solo mientras esté `PENDING` (una vez `CONFIRMED` o `CANCELLED` no se puede modificar: hay que cancelar y crear una nueva). Recalcula `totalPrice` con las nuevas fechas y revalida solapamiento con otras reservas de la misma publicación.

---

## Reviews — `/api/reviews`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/` | 🔒 Auth | Crea o actualiza (si ya existe) la reseña del usuario para una publicación |
| GET | `/:id` | — | Obtiene una reseña puntual |
| PUT | `/:id` | 🔒 Auth (autor) | Actualiza la propia reseña |
| DELETE | `/:id` | 🔒 Auth (autor) | Elimina la propia reseña |

**POST `/api/reviews`**
```json
// body
{ "listingId": "<uuid>", "rating": 5, "comment": "Excelente estadía" }
```
Solo se puede reseñar una publicación si el usuario tiene una reserva `CONFIRMED` con `endDate` en el pasado (403 si no).

---

## Provincias — `/api/provinces` y Localidades — `/api/cities`

Datos de referencia oficiales (API de Nación), cargados una vez por el seeder ([`prisma/seeders/seed.js`](../prisma/seeders/seed.js)) y expuestos solo en lectura — no son datos que un usuario cree o edite, por eso no tienen CRUD de escritura:

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/provinces` | — | Lista todas las provincias |
| GET | `/api/cities` | — | Lista/busca ciudades (`?search=`, `?limit=`) |
| GET | `/api/cities/popular` | — | Top 4 ciudades con más publicaciones |
| GET | `/api/cities/province/:provinceId` | — | Ciudades de una provincia |

## Amenities — `/api/amenities`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/` | — | Lista todas las amenities disponibles (para usar en el form de publicación) |

## Files — `/api/files`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/imageUploadUrl` | — | Genera los parámetros firmados para subir una imagen directo a Cloudinary desde el frontend |

## MercadoPago — `/api/mercadopago`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/webhook` | — (firma validada) | Notificación de MercadoPago cuando cambia el estado de un pago |

El webhook valida la firma `x-signature` con `MERCADOPAGO_WEBHOOK_SECRET` (si está configurado), busca el pago por `external_reference`, actualiza `Payment.status` y, si el pago fue aprobado, pasa el `Booking` a `CONFIRMED` (o `CANCELLED` si fue rechazado). Ver `docs/arquitectura.md` para el flujo completo.

---

## Health check

`GET /health` → `200 OK` (texto plano), sin autenticación. Útil para probes de infraestructura (nginx, PM2, monitoreo).
