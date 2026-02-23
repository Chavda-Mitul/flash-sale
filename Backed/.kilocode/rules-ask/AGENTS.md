# AGENTS.md - Ask Mode

This file provides guidance for agents when explaining or analyzing code in this repository.

## Documentation Context (Non-Obvious)

### Project Organization
- Modular monolith: Single Fastify server with feature modules in `src/modules/`
- Each module has `routes.ts` (Fastify schemas) + `service.ts` (business logic)
- PostgreSQL for persistent storage, Redis for atomic inventory operations

### Key Modules
- `auth/` - JWT authentication, login, register
- `product/` - Product catalog CRUD
- `inventory/` - Redis-based inventory locking, reservations with TTL
- `checkout/` - Checkout flow: initiate → reserve → confirm/cancel
- `order/` - Order creation and status tracking

### Flash Sale Flow
1. Checkout initiate → Reserve inventory atomically in Redis (Lua script)
2. Reservation stored with 15-minute TTL
3. Payment succeeds → Confirm order, delete reservation, update PostgreSQL
4. Payment fails/timeout → Cancel releases Redis inventory via INCRBY

### Environment Variables
- `PORT` - Server port (default: 3000)
- `FRONTEND_URL` - Controls CORS allowed origin
- PostgreSQL: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`

### API Routes
- All routes prefixed with `/api/`
- Health check at `/health` (no prefix)
- Swagger UI at `/docs`
