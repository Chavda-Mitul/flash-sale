# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Patterns (Non-Obvious)

### Inventory Atomic Operations
- Lua script `DECREMENT_INVENTORY_SCRIPT` in [`src/modules/inventory/service.ts:78`](src/modules/inventory/service.ts:78) returns `-1` for insufficient inventory, `-2` for not found
- Always check return codes from `decrementInventory()` - returns `{ success: boolean }`

### Redis Key Conventions
- Variant ID defaults to `"default"` string (not null/undefined) - see [`REDIS_KEYS`](src/types/index.ts:152)
- Reservation TTL is 900 seconds (15 minutes) - [`RESERVATION_TTL_SECONDS`](src/modules/inventory/service.ts:4)

### Checkout Flow
- Uses dynamic imports for order service: `await import('../order/service.js')` instead of static import - see [`src/modules/checkout/service.ts:93`](src/modules/checkout/service.ts:93)
- Must call `updateOrderStatus()` after payment confirm, not update directly

### Database
- Pool max 20 connections, 2s timeout - [`src/db/connection.ts:14-16`](src/db/connection.ts:14)
- All queries logged with duration - see query wrapper

### API Access
- Swagger UI at `/docs` (not `/api/docs`)
- All routes prefixed with `/api/`

### ESM Imports
- Use `.js` extension in imports despite TypeScript: `import from './service.js'`
- Package.json has `"type": "module"`

### Redis Passed as Parameter
- Services in `inventory/` and `checkout/` receive `redis` as function argument, not imported directly
- Routes pass `fastify.redis` to service functions

### DB Row Mapping
- PostgreSQL uses `snake_case` columns; TypeScript interfaces use `camelCase`
- Each service has private `mapX(row)` function to convert (e.g., `mapInventory`, `mapUser`)

### Auth Guard
- `fastify.authenticate` is a decorator registered in [`server.ts:58`](src/server.ts:58)
- Use on protected routes as `preHandler: [fastify.authenticate]`
- JWT payload accessed via `request.user` has shape `{ userId, email, role }`

### Checkout Rollback
- On `initiateCheckout` failure mid-loop, increments back all previously decremented items - see [`src/modules/checkout/service.ts:33-37`](src/modules/checkout/service.ts:33)
