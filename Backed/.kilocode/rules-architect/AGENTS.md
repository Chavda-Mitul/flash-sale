# AGENTS.md - Architect Mode

This file provides architectural guidance for agents working in this repository.

## Architecture Rules (Non-Obvious)

### Redis as Inventory Cache
- Redis acts as authoritative source during flash sales, not PostgreSQL
- Inventory must be seeded to Redis via `initializeRedisInventory()` before sales
- Lua script ensures atomic decrement - prevents overselling under concurrent load

### Checkout Transaction Pattern
- Inventory decrement in Redis happens before database order creation
- On order creation failure, inventory is rolled back via `incrementInventory()`
- Reservations have 15-minute TTL - automatic expiry releases inventory

### Circular Dependency Workaround
- Checkout module uses dynamic `await import('../order/service.js')` 
- Order service imports from auth for order number generation
- Static import would create circular dependency

### Stateless Services
- Inventory and checkout services receive redis as parameter
- Allows proper dependency injection and testability
- Routes pass `fastify.redis` to service functions

### Database Pool Sizing
- Pool max 20 connections with 2s timeout
- Under high flash sale load, connections may exhaust
- Consider connection pooling at application level for scale

### Reservation Cleanup
- Currently relies on TTL expiration only
- No background job for orphaned reservations
- Consider adding cleanup mechanism for production

### Auth Decorator Pattern
- `fastify.authenticate` is Fastify decorator, not middleware
- Must be added as `preHandler` array on protected routes
- JWT payload: `{ userId, email, role }`
