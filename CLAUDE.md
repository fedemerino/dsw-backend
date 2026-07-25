# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start server with nodemon (auto-reload)
npm test             # Run Jest tests
npm run test-coverage  # Run tests with coverage report
npm run lint         # Run ESLint
npm run lint-fix     # Auto-fix ESLint issues
npm run format       # Format with Prettier

# Database
npm run migrate:new -- <name>   # Create a new migration
npm run migrate:up               # Apply pending migrations
npm run migrate:reset            # Reset DB (drops all data, skips seed)
npm run seed                     # Run seed script
```

## Environment Variables

Required in `.env`:
- `NODE_ENV` — `development` / `production` / `test`; controls the `secure` flag on cookies and how much error detail responses expose
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — token signing secrets
- `FRONTEND_URL` — used for MercadoPago redirect URLs
- `BACKEND_URL` — used for MercadoPago webhook `notification_url`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — image uploads
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` — payment processing
- `GOOGLE_APP_USER`, `GOOGLE_APP_PASSWORD` — nodemailer for password reset emails

`.env.prod` is a production template (placeholders, no real secrets) — see `docs/deployment.md`.

## Architecture

Express.js REST API using ES modules (`"type": "module"`). Each resource follows a `route → controller → service/Prisma` pattern.

**Entry point:** `src/app.js` builds and exports the Express app (registers all routers under `/api/<resource>`); `src/index.js` imports it and calls `app.listen`.

**Layers:**
- `src/routes/` — Express routers, apply `authenticateToken` / `requireAdmin` middleware where needed
- `src/controllers/` — request handlers; instantiate `PrismaClient` directly at module level
- `src/services/` — `cloudinary.service.js` (signed image upload URLs), `mercadopago.service.js` (payment preferences + webhook), `mail.service.js` (password reset emails)
- `src/schemas/` — Zod validation schemas; controllers call `.parse()` or `.safeParse()` on request bodies
- `src/middlewares/` — `auth.middleware.js` (JWT verification, role check)

**Auth flow:** Access tokens (15 min, Bearer header) + refresh tokens (7 days, httpOnly cookie at `/api/auth`). The decoded access token is attached as `req.user` with `email` and `roles` fields. Role-based access uses `requireAdmin` middleware.

**Payment flow:** `POST /api/bookings` creates a `Booking` (status: PENDING) + a `Payment` record, then calls MercadoPago to create a preference and returns `initPoint` (redirect URL). MercadoPago posts to `POST /api/mercadopago/webhook` which updates `Payment.status` and sets `Booking.status = CONFIRMED` on approval.

**Database:** PostgreSQL via Prisma. Schema in `prisma/schema.prisma`. The `User` primary key is `email` (not an integer id). Seeder at `prisma/seeders/seed.js`.

**Image uploads:** Images go straight to Cloudinary via a signed URL (`files.controller.js` → `cloudinary.service.js`); the backend never stores files itself (no `multer`, no `/uploads`).

**Tests:** Jest with babel-jest transform (`src/app.js` exports the Express app separately from `src/index.js`'s `app.listen`, so it can be exercised with Supertest). 185 tests across unit tests (Prisma/external services mocked — see the `PrismaClient.mock.results[0].value` pattern used throughout, needed because several controllers do `new PrismaClient()` at module scope) and integration tests (`src/__tests__/integration/`, real Postgres `bookings_test` DB, only the MercadoPago network call is mocked). Setup/evidence: `docs/testing.md`. Coverage floor in `jest.config.js`: 80% branches / 90% functions / 95% lines+statements.

**Docs & CI/CD:** Full docs in `docs/` (installation, architecture, API reference, testing, deployment). `.github/workflows/ci-cd.yml` runs security checks (TruffleHog + `npm audit`) → lint/format/tests (with a Postgres service container) → SSH deploy to the VPS (PM2 + `ecosystem.config.cjs`) on push to `master`.
