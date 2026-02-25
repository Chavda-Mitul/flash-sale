# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlashCommerce is a high-traffic flash sale backend built with Node.js/TypeScript and Fastify. The system handles concurrent inventory management during time-limited sales using Redis for atomic locking and PostgreSQL for persistent storage.

## Commands

```bash
npm run dev          # Start dev server with hot-reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production server
npm test             # Run Jest tests
npm run type-check   # TypeScript validation without emit
npm run db:migrate   # Run database migrations (idempotent, safe to re-run)
npm run db:seed      # Seed database (NOTE: src/db/seed.ts does not exist yet)
```

## Architecture

**Modular Monolith Pattern**: Single Fastify server (`src/server.ts`) with feature modules in `src/modules/`. Each module contains:
- `routes.ts` — Route handlers with Fastify schema validation
- `service.ts` — Business logic and database queries

**Module Responsibilities**:
- `auth/` — JWT authentication, login, register, token refresh
- `product/` — Product catalog CRUD, flash sale listings
- `inventory/` — Redis-based inventory locking, reservations with TTL
- `checkout/` — Checkout flow: initiate → reserve → confirm/cancel
- `order/` — Order creation and status tracking

**Data Flow for Flash Sales**:
1. Checkout initiate → Reserve inventory atomically in Redis (Lua script)
2. Reservation stored with 15-minute TTL (`RESERVATION_TTL_SECONDS = 900`)
3. Payment succeeds → Confirm order, delete reservation, update PostgreSQL
4. Payment fails/timeout → Cancel releases Redis inventory via INCRBY

**Database Layer** (`src/db/`):
- `connection.ts` — PostgreSQL pool (max 20 connections, 2s timeout). Exports `query()` and `getClient()`
- `migrate.ts` — Schema migrations for users, products, inventory, orders, order_items, payments

## Key Implementation Patterns

**ESM modules**: The project uses `"type": "module"`. All internal imports must use `.js` extensions (e.g., `import ... from './service.js'`).

**Auth guards**: Two decorators registered in `server.ts`:
- `fastify.authenticate` — Verifies JWT. Use as `preHandler: [fastify.authenticate]`.
- `fastify.authenticateAdmin` — Verifies JWT and checks `role === 'admin'`, returns 403 otherwise.
- JWT payload shape: `{ userId, email, role }` accessed via `request.user`.

**Redis passed as parameter**: Services in `inventory/` and `checkout/` receive `redis` as a function argument (not imported directly). Routes pass `fastify.redis` to service functions.

**DB row mapping**: PostgreSQL uses `snake_case` columns; TypeScript interfaces use `camelCase`. Each service has a private `mapX(row)` function to convert (e.g., `mapInventory`, `mapUser`).

**Circular dependency workaround**: `checkout/service.ts` statically imports `createOrder` from `order/service.ts`, but uses dynamic `await import('../order/service.js')` inside `confirmCheckout` and `cancelCheckout` to import `updateOrderStatus` and `updateStripePaymentId`, avoiding a circular import cycle.

**Multi-item inventory rollback**: When `initiateCheckout` fails mid-loop, it increments back all previously decremented items before returning an error.

**Global rate limiting**: `@fastify/rate-limit` is registered globally at 100 requests per minute.

## Redis Key Conventions

Defined in `src/types/index.ts` as the `REDIS_KEYS` const (each is a function):
```ts
REDIS_KEYS.INVENTORY(productId, variantId)   // "inventory:{productId}:{variantId|default}"
REDIS_KEYS.RESERVATION(orderId)              // "reservation:{orderId}"
REDIS_KEYS.SESSION(sessionId)                // "session:{sessionId}"
REDIS_KEYS.RATE_LIMIT(userId, endpoint)      // "ratelimit:{userId}:{endpoint}"
REDIS_KEYS.QUEUE(saleId)                     // "queue:{saleId}"
```

## Lua Script for Inventory Decrement

Located in `src/modules/inventory/service.ts` as `DECREMENT_INVENTORY_SCRIPT`. Return codes:
- `>= 0` — Success; value is new inventory count
- `-1` — Insufficient inventory
- `-2` — Inventory key not found in Redis (must call `initializeRedisInventory` first)

Redis inventory must be seeded before a sale via `initializeRedisInventory(redis, productId, variantId)`, which reads available quantity from PostgreSQL and sets it in Redis.

## API Routes

All routes prefixed with `/api/`. Health check at `/health` (no prefix). Swagger UI at `/docs`.

- `/api/auth/*` — register, login, refresh, /me
- `/api/products/*` — Product catalog
- `/api/inventory/*` — Inventory management; `POST /:productId/init-cache` requires auth
- `/api/orders/*` — Order management
- `/api/checkout/initiate` — Auth required; `confirm` and `cancel/:orderId` are separate

## Environment Variables

Copy `.env.example` to `.env`. Key vars:
- `PORT` — Server port (default: 3000)
- `FRONTEND_URL` — Controls CORS allowed origin (default: `http://localhost:3001`)
- PostgreSQL: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`
- Stripe (Phase 3): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
