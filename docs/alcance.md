# Alcance implementado

Mapeo de los requisitos funcionales de [`proposal.md`](../proposal.md) contra lo efectivamente implementado, como evidencia para la defensa.

## CRUDs

| Entidad | Modelo | Create | Read | Update | Delete | Notas |
|---|---|:-:|:-:|:-:|:-:|---|
| Usuarios | `User` | ✅ `POST /api/auth/signUp` | ✅ `GET /api/users`, `GET /api/users/:email` | ✅ `PUT /api/users/update` | ✅ `DELETE /api/users/:email` (baja lógica) | Además: bloqueo/desbloqueo por admin (`PATCH /api/users/:email/block`, `/unblock`) |
| Publicaciones | `Listing` | ✅ `POST /api/listings` | ✅ `GET /api/listings`, `GET /api/listings/:id` | ✅ `PUT /api/listings/:id` | ✅ `DELETE /api/listings/:id` | Depende de `User` (host) y `City` |
| Imágenes | `Image` | ✅ (embebido en creación/edición de `Listing`, subida directa a Cloudinary) | ✅ (incluidas en el detalle de la publicación) | — | ✅ (al editar/eliminar la publicación) | CRUD dependiente de `Listing`, sin rutas propias |
| Reservas | `Booking` | ✅ `POST /api/bookings` | ✅ `GET /api/bookings/user/:userEmail`, `GET /api/bookings/host` | ✅ `PUT /api/bookings/:bookingId` (solo mientras está `PENDING`) | ✅ `DELETE /api/bookings/:bookingId` (cancelación) | Depende de `User` y `Listing` |
| Reseñas | `Review` | ✅ `POST /api/reviews` | ✅ `GET /api/reviews/:id` | ✅ `PUT /api/reviews/:id` | ✅ `DELETE /api/reviews/:id` | Depende de `User` y `Listing`; solo reseñable tras una estadía `CONFIRMED` completada |
| Favoritos | `Favorite` | ✅ `POST /api/listings/favorites` (toggle) | ✅ `GET /api/listings/favorites` | — (toggle cubre alta/baja) | ✅ (mismo toggle) | Depende de `User` y `Listing` |
| Provincias | `Province` | — | ✅ `GET /api/provinces` | — | — | Dato de referencia oficial (API de Nación), cargado por seeder, solo lectura |
| Localidades | `City` | — | ✅ `GET /api/cities` | — | — | Idem Provincias |

Los métodos de pago se resuelven mediante integración real con **MercadoPago** (Checkout Pro + webhook) en lugar de un CRUD propio — ver `docs/arquitectura.md`.

## Listado con filtro + detalle

- `GET /api/listings` filtra por localidad (`cityId`), fechas (`startDate`/`endDate`), cantidad de huéspedes (`guests`), tipo de propiedad, precio, rating y amenities.
- `GET /api/listings/:id` devuelve el detalle completo (imágenes, amenities, reviews) de la publicación seleccionada.

## Casos de uso / epics

| CUU | Endpoint(s) | Regularidad / Aprobación |
|---|---|---|
| Registrarse en la plataforma | `POST /api/auth/signUp` | Regularidad |
| Iniciar sesión | `POST /api/auth/login` | Regularidad |
| Publicar un alojamiento | `POST /api/listings` | Regularidad |
| Editar o eliminar una publicación propia | `PUT` / `DELETE /api/listings/:id` | Regularidad |
| Buscar y reservar un alojamiento | `GET /api/listings` (filtros) + `POST /api/bookings` (+ pago con MercadoPago) | Regularidad |
| Cancelar una reserva | `DELETE /api/bookings/:bookingId` | Aprobación |
| Reseñar un alojamiento | `POST` / `PUT /api/reviews` | Aprobación |
| Guardar un alojamiento en favoritos | `POST /api/listings/favorites` | Aprobación |
| Ver el historial de reservas | `GET /api/bookings/user/:userEmail` | Aprobación |
| Actualizar perfil de usuario | `PUT /api/users/update` | Aprobación |
| Gestionar publicaciones propias | `GET /api/listings/myListings`, `PUT`/`DELETE /api/listings/:id` | Aprobación |
| Bloquear un usuario | `PATCH /api/users/:email/block` (+ `/unblock`) | Aprobación |
| Recuperar contraseña | `POST /api/auth/forgotPassword`, `POST /api/auth/resetPassword` | Adicional voluntario |

Dos CUUs relacionados entre sí (dato de uno alimenta al otro), como pide el punto de Aprobación: **Realizar una reserva** → la reserva `CONFIRMED` es precondición para **Reseñar una publicación** (`reviews.controller.js` exige una `Booking` propia con `status: 'CONFIRMED'` y `endDate` pasada).

## Roles y niveles de acceso

`USER` (default al registrarse), `HOST` (semántico, mismos permisos que `USER` hoy) y `ADMIN` (gestión de usuarios: listar, bloquear/desbloquear, dar de baja). Ver `docs/arquitectura.md` para el detalle de middleware de protección de rutas.
