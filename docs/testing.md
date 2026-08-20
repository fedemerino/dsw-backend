# Testing

El proyecto usa [Jest](https://jestjs.io/) (con `babel-jest` para poder usar ES Modules) y [Supertest](https://github.com/ladjs/supertest) para los tests de integración.

## Estrategia

- **Tests unitarios**: cada controller, service y middleware tiene su archivo `*.test.js` colocado junto al código, con Prisma (y las demás dependencias externas: MercadoPago, Cloudinary, Nodemailer) mockeadas con `jest.mock`. Cubren el camino feliz, las validaciones de negocio (403/404/400) y el catch genérico de error (500) de cada función exportada.
  - Nota técnica: varios controllers (`auth`, `users`, `listings`, `bookings`, `reviews`, `provinces`, `cities`, `amenities`) instancian `new PrismaClient()` a nivel de módulo. Por las reglas de evaluación de ESM, ese `new PrismaClient()` corre *antes* que cualquier `const` del archivo de test — así que en vez de pasarle los mocks por clausura, los tests toman la instancia real que el controller construyó vía `PrismaClient.mock.results[0].value` (ver cualquier `*.controller.test.js` para el patrón).
- **Tests de integración**: levantan la app de Express real (`src/app.js`) con [Supertest](https://github.com/ladjs/supertest) contra una **base de datos Postgres real** (no mocks de Prisma), ejercitando la pila completa ruta → middleware → controller → Prisma → DB. Solo se mockea la llamada de red externa a la API de MercadoPago (`Preference.create`), ya que un test de integración no debe depender de un servicio de terceros real.
  - `auth.integration.test.js`: signup → login → acceso a ruta protegida con JWT → rechazo sin token.
  - `bookings.integration.test.js`: creación de listing → creación de booking (con preference de MercadoPago) → rechazo de solapamiento de fechas → cancelación de booking → rechazo de cancelación por un usuario que no es el dueño de la reserva.
- **Tests de ruta livianos**: `app.test.js` (health check) y `mercadopago.route.test.js` (delegación al service del webhook) sin pasar por la DB.

El foco original era priorizar la lógica de negocio con más riesgo (autenticación, pagos, reservas), pero se terminó extendiendo la cobertura a prácticamente todos los controllers, services, middlewares, schemas y rutas — ver el reporte de cobertura abajo.

## Setup (una sola vez)

Los tests de integración necesitan una base de datos separada de la de desarrollo, para no pisar datos reales. Se usa el mismo contenedor Postgres que ya corre en desarrollo (`postgres_local`, ver `docker-compose.yml`), con una base nueva `bookings_test`:

```bash
# 1. Crear la base de test (una sola vez)
docker exec postgres_local psql -U postgres -c "CREATE DATABASE bookings_test;"

# 2. Aplicar las migraciones a esa base
#    bash / git-bash:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookings_test?schema=public" npx prisma migrate deploy

#    PowerShell:
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bookings_test?schema=public"; npx prisma migrate deploy
```

`.jest/setEnvVars.js` ya apunta `DATABASE_URL` a `bookings_test` automáticamente para cualquier corrida de `npm test`, así que no hace falta setear nada más manualmente después de este paso inicial. Si preferís usar otra base, podés sobreescribirla con la variable `TEST_DATABASE_URL`.

## Correr los tests

```bash
npm test               # todos los tests
npm run test-coverage  # todos los tests + reporte de cobertura
```

## Evidencia de ejecución (`npm run test-coverage`)

Corrida real sobre `bookings_test`, 2026-08-20:

```
> bookings-backend@1.0.0 test-coverage
> jest --coverage

PASS src/__tests__/app.test.js
PASS src/__tests__/integration/bookings.integration.test.js
PASS src/__tests__/integration/auth.integration.test.js
(+ 18 suites más: controllers, services, middlewares, schemas, routes)
--------------------------|---------|----------|---------|---------|--------------------------
File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------------|---------|----------|---------|---------|--------------------------
All files                 |   97.74 |     86.4 |   96.34 |   98.36 |
 src                      |     100 |       50 |     100 |     100 |
  app.js                  |     100 |       50 |     100 |     100 | 22
 src/config               |   83.33 |       75 |     100 |   83.33 |
  mail.config.js          |      75 |       75 |     100 |      75 | 6
  swagger.js              |     100 |      100 |     100 |     100 |
 src/controllers          |   97.63 |    86.89 |   96.55 |   98.15 |
  amenities.controller.js |     100 |      100 |     100 |     100 |
  auth.controller.js      |     100 |      100 |     100 |     100 |
  bookings.controller.js  |   95.76 |    69.73 |   88.88 |   98.24 | 180,302
  cities.controller.js    |   97.05 |     87.5 |     100 |   96.87 | 62
  files.controller.js     |     100 |      100 |     100 |     100 |
  listings.controller.js  |   95.83 |    93.54 |   95.23 |   95.77 | 191-197
  provinces.controller.js |     100 |      100 |     100 |     100 |
  reviews.controller.js   |     100 |      100 |     100 |     100 |
  users.controller.js     |   98.46 |    94.44 |     100 |   98.43 | 45
 src/middlewares          |   95.45 |    91.66 |     100 |   95.23 |
  auth.middleware.js      |   95.45 |    91.66 |     100 |   95.23 | 46
 src/routes               |     100 |      100 |     100 |     100 |
  (los 10 routers)        |     100 |      100 |     100 |     100 |
 src/schemas              |     100 |      100 |     100 |     100 |
  auth.schema.js          |     100 |      100 |     100 |     100 |
  bookings.schema.js      |     100 |      100 |     100 |     100 |
  cities.schema.js        |     100 |      100 |     100 |     100 |
  listings.schema.js      |     100 |      100 |     100 |     100 |
  review.schema.js        |     100 |      100 |     100 |     100 |
  users.schema.js         |     100 |      100 |     100 |     100 |
 src/services             |   97.14 |    85.71 |    90.9 |     100 |
  cloudinary.service.js   |     100 |      100 |     100 |     100 |
  mail.service.js         |     100 |      100 |     100 |     100 |
  mercadopago.service.js  |   96.55 |       84 |   85.71 |     100 | 50,89-93,111,143-154,160
 src/utils                |     100 |    85.71 |     100 |     100 |
  utils.js                |     100 |    85.71 |     100 |     100 | 13,18,48-52
--------------------------|---------|----------|---------|---------|--------------------------

Test Suites: 21 passed, 21 total
Tests:       207 passed, 207 total
Snapshots:   0 total
Time:        ~8 s
Ran all test suites.
```

207 tests, 21 suites, todos en verde. `npm run lint` también corre limpio (0 errores). El `coverageThreshold` de `jest.config.js` está fijado unos puntos por debajo de estos números (branches 80%, functions 90%, lines 95%, statements 95%) como piso de no-regresión real — si un cambio futuro baja la cobertura de forma significativa, `npm run test-coverage` va a fallar (y el job de CI también, ver `docs/deployment.md`).

Lo que queda sin cubrir son en su mayoría ramas defensivas de bajo riesgo: el branch `origin` del CORS por defecto en `app.js`, el `throw` de `mail.config.js` si faltan credenciales de Gmail (falla al bootear, no en runtime), y algunos detalles de logging opcional en `mercadopago.service.js` (`mpError?.cause`, `mpError?.body`).

### Verificación manual del upgrade a `mercadopago` v3

Los tests unitarios/integración mockean el SDK de MercadoPago a nivel de módulo (`jest.mock('mercadopago', ...)`), así que no detectan si cambió la forma real en que el paquete expone `MercadoPagoConfig`/`Preference`/`Payment` entre versiones mayores. Al actualizar `mercadopago` de `2.13.0` a `3.4.0` (ver "Dependencias" abajo) se hizo además una prueba manual contra la API real de MercadoPago (credenciales de test): se creó una reserva real vía `POST /api/bookings`, se obtuvo un `initPoint` válido y se abrió en el navegador — el checkout de MercadoPago cargó correctamente con el ítem y el monto esperados. Confirma que el cambio de versión no rompió la integración real.

## Dependencias

`npm audit --omit=dev --audit-level=high` está en 0 vulnerabilidades (chequeado 2026-08-20). Dos cambios para llegar ahí:
- `mercadopago` `2.13.0` → `3.4.0` (major — arrastraba una versión vulnerable de `uuid`). Ver la verificación manual arriba.
- `prisma` (el CLI, devDependency) `^6.17.1` → `^6.12.0` (arrastraba una versión de `@prisma/config`/`deepmerge-ts` vulnerable). No afecta a `@prisma/client` (que sigue en `^6.17.1`, sin cambios) ni a las migraciones — verificado con `npx prisma generate` + `npx prisma migrate deploy` + la suite completa, todo en verde.

## Bugs reales encontrados escribiendo estos tests

Vale la pena documentarlo porque es evidencia de que los tests no son cosméticos:

1. **`createBooking` guardaba `startDate`/`endDate` como el string crudo del body** en vez del `Date` ya parseado y validado (`requestedStartDate`/`requestedEndDate`), lo que rompía con un `PrismaClientKnownRequestError` si el body no traía un ISO-8601 completo con horario. Lo detectó `bookings.integration.test.js`. Fix en `src/controllers/bookings.controller.js`.
2. **`generateRefreshToken` podía generar el mismo JWT dos veces** si se llamaba dos veces en el mismo segundo (sin ningún claim único más allá de `iat`), lo que violaba el `@unique` de `RefreshToken.token` y tiraba un 500 en el segundo login. Lo detectó `auth.integration.test.js` al hacer signup + login en la misma corrida. Fix: se agregó un claim `jti` (UUID) en `src/controllers/auth.controller.js`.
3. **`logout` no limpiaba la cookie de refresh token** porque `res.clearCookie` usaba un `path` (`/api/auth/refresh`) distinto al que se usó para setearla (`/api/auth`) — el navegador nunca hacía match y la cookie vieja quedaba viva. Fix en `src/controllers/auth.controller.js`.
