# Reservar — Backend

API REST del backend de **Reservar**, una aplicación de reservas de alojamientos para alquiler temporario (tipo Airbnb): publicar alojamientos, buscar y reservar con pago integrado (MercadoPago), dejar reseñas y gestionar favoritos.

TP de la materia Desarrollo de Software (DSW) — ver [`proposal.md`](./proposal.md) para el alcance funcional completo.

## Stack

Node.js + Express 5 · PostgreSQL + Prisma · JWT (access + refresh) con roles (`USER`/`HOST`/`ADMIN`) · Zod · MercadoPago · Cloudinary · Jest + Supertest.

## Quick start

```bash
cp .env.example .env   # completar los valores reales (ver docs/instalacion.md)
npm run setup           # instala deps, levanta Docker+Postgres, migra, seedea y levanta el server
```

Admin de prueba: `admin@reservar.com` / `123456789` (contraseña fija para desarrollo local, configurable con `SETUP_ADMIN_PASSWORD`).

Paso a paso manual, requisitos previos (Docker, ngrok, MercadoPago, Cloudinary, Gmail) y detalle de cada variable de entorno en [`docs/instalacion.md`](./docs/instalacion.md).

## Documentación

Toda la documentación del proyecto vive en [`docs/`](./docs/README.md):

- [Instalación](./docs/instalacion.md)
- [Arquitectura](./docs/arquitectura.md)
- [API](./docs/api.md)
- [Testing](./docs/testing.md)
- [Deployment](./docs/deployment.md)
- [Flujo de trabajo (git + Jira)](./docs/workflow.md)

## Scripts principales

```bash
npm run dev             # servidor con recarga automática
npm test                # tests (unitarios + integración)
npm run test-coverage   # tests con reporte de cobertura
npm run lint             # ESLint
```

Ver la lista completa en [`docs/instalacion.md`](./docs/instalacion.md#scripts-disponibles).
