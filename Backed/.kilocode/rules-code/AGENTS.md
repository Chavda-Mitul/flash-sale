# AGENTS.md - Code Mode

This file provides coding-specific guidance for agents working in this repository.

## Non-Obvious Coding Rules

### ESM Imports
- Always use `.js` extension in imports despite TypeScript: `import from './service.js'`
- Package.json has `"type": "module"`

### Redis Passed as Parameter
- Services in `inventory/` and `checkout/` receive `redis` as function argument, not imported directly
- Routes pass `fastify.redis` to service functions

### DB Row Mapping
- PostgreSQL uses `snake_case` columns; TypeScript interfaces use `camelCase`
- Each service has private `mapX(row)` function to convert (e.g., `mapInventory`, `mapUser`)

### Dynamic Import for Order Service
- Use `await import('../order/service.js')` instead of static import in checkout module to avoid circular dependency

### Auth Guard Usage
- `fastify.authenticate` decorator must be used as `preHandler: [fastify.authenticate]` on protected routes
- JWT payload accessed via `request.user` has shape `{ userId, email, role }`

### Inventory Lua Script Return Values
- Check return value from `decrementInventory()`: returns `{ success: boolean }`
- Lua script returns `-1` for insufficient inventory, `-2` for key not found

### Variant ID Default
- Always default variantId to `"default"` string, not null/undefined
- See [`REDIS_KEYS`](src/types/index.ts:152)
